import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign,createHash,webcrypto} from 'node:crypto';
import {mkdtemp,rm,writeFile,mkdir,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {createRequire} from 'node:module';
import {zipSync} from 'fflate';
import manifest from '../manifest.cjs';
import {createCloudApp} from '../../../outputs/qiban-growth-prototype/cloud-server.mjs';
const require=createRequire(new URL('../../windows/package.json',import.meta.url));
const {LiveUpdateEngine}=require('@capawesome/electron-live-update/engine');
// Disposable synthetic signing identity, never a release or user credential.
const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048,publicKeyEncoding:{type:'spki',format:'pem'},privateKeyEncoding:{type:'pkcs8',format:'pem'}});
const config={channel:'beta',runtime:'qiban-native-2',embeddedSequence:1,publicKey};
const zip=zipSync({'index.html':Buffer.from('<main>synthetic update</main>'),'login.html':Buffer.from('<form></form>')});
function release(overrides={}){const checksum=createHash('sha256').update(zip).digest('hex');return {schema:1,channel:'beta',runtime:config.runtime,target:'windows',sequence:2,version:'0.9.2-beta.1',bundleId:`qiban2-2-${checksum.slice(0,16)}`,checksum,bytes:zip.length,url:`${manifest.ORIGIN}/updates/bundles/${checksum}.zip`,signature:sign('RSA-SHA256',zip,privateKey).toString('base64'),...overrides};}
function envelope(item=release()){const bytes=Buffer.from(JSON.stringify(item));return {payload:bytes.toString('base64'),signature:sign('RSA-SHA256',bytes,privateKey).toString('base64')};}
const verify=(value,c=config,target='windows')=>manifest.verifyManifest(value,c,target,webcrypto.subtle);
function apiFixture({current=null,next=null,blocked=[]}={}){const calls=[];return {calls,getCurrentBundle:async()=>({bundleId:current}),getNextBundle:async()=>({bundleId:next}),getBlockedBundles:async()=>({bundleIds:blocked}),getDownloadedBundles:async()=>({bundleIds:[]}),downloadBundle:async value=>calls.push(['download',value]),setNextBundle:async value=>calls.push(['next',value])};}
test('manifest authenticates metadata; tampering, wrong signer and unsigned metadata are rejected',async()=>{
  const signed=envelope();assert.equal((await verify(signed)).sequence,2);
  await assert.rejects(verify({...signed,payload:Buffer.from(JSON.stringify(release({sequence:99}))).toString('base64')}),/签名/);
  await assert.rejects(verify({payload:signed.payload}),/清单/);
  const other=generateKeyPairSync('rsa',{modulusLength:2048,publicKeyEncoding:{type:'spki',format:'pem'}});await assert.rejects(verify(signed,{...config,publicKey:other.publicKey}),/签名/);
});
test('manifest rejects target/channel confusion, redirects, credentials, invalid size and bundle identity',async()=>{
  for(const value of [{target:'mobile'},{channel:'production'},{url:'http://81.70.181.205/a.zip'},{url:'https://evil.invalid/a.zip'},{url:'https://name:secret@81.70.181.205/a.zip'},{bytes:33*1024*1024},{bytes:0},{bundleId:'../private'},{sequence:-1},{sequence:2.5}])await assert.rejects(verify(envelope(release(value))),/格式/);
});
test('staging never reloads UI; incompatible runtime, old sequence and blocked bundles are not downloaded',async()=>{
  for(const [item,options,status] of [[release({runtime:'qiban-native-3'}),{},'native-required'],[release(),{current:release().bundleId},'current'],[release(),{next:release().bundleId},'ready'],[release(),{blocked:[release().bundleId]},'rolled-back']]){
    const api=apiFixture(options);const result=await manifest.stageUpdate({api,envelope:envelope(item),config,target:'windows',subtle:webcrypto.subtle});assert.equal(result.status,status);assert.deepEqual(api.calls,[]);
  }
  const api=apiFixture();assert.equal((await manifest.stageUpdate({api,envelope:envelope(),config,target:'windows',subtle:webcrypto.subtle})).status,'ready');assert.deepEqual(api.calls.map(c=>c[0]),['download','next']);
});
const quiet={debug(){},info(){},warn(){},error(){}};
test('Windows production update host initializes the real engine in an isolated directory without account credentials',async t=>{
  const {createUpdateHost}=require('./update-host.bundle.cjs');
  const directory=await mkdtemp(path.join(tmpdir(),'qiban-host-integration-'));let calls=0;
  const host=await createUpdateHost({directory,version:'0.9.2-beta.1',fetchManifest:async url=>{assert.equal(url,manifest.ORIGIN+'/updates/beta/windows.json');calls++;return {status:404,data:{}};},rollback:()=>{throw Error('Unexpected rollback of embedded UI');}});
  t.after(async()=>{host.dispose();await rm(directory,{recursive:true,force:true});});
  assert.equal(await host.root(),null);assert.equal((await host.ready()).currentBundleId,null);assert.deepEqual(await host.check(),{status:'current'});assert.equal(calls,1);
});
async function engineFixture(t){
  const directory=await mkdtemp(path.join(tmpdir(),'qiban-update-test-'));const engines=[];
  const server=http.createServer((_req,res)=>{res.writeHead(200,{'Content-Type':'application/zip'});res.end(zip);});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const url=`http://127.0.0.1:${server.address().port}/synthetic.zip`;
  t.after(async()=>{for(const e of engines)e.destroy();await new Promise(resolve=>server.close(resolve));await rm(directory,{recursive:true,force:true});});
  async function make(){const engine=new LiveUpdateEngine({dataDirectory:directory,versionCode:'902',versionName:'0.9.2',platform:'windows',publicKey,readyTimeout:60000,autoBlockRolledBackBundles:true,logger:quiet});engines.push(engine);await engine.initialize();return engine;}
  async function stage(e){await e.downloadBundle({bundleId:release().bundleId,url,signature:release().signature,checksum:release().checksum});await e.setNextBundle({bundleId:release().bundleId});}
  return {make,stage,url,directory};
}
test('real update engine verifies and stages ZIP, activates on restart and retains an acknowledged bundle',async t=>{
  const f=await engineFixture(t),first=await f.make();
  const api=Object.fromEntries(['getCurrentBundle','getNextBundle','getBlockedBundles','getDownloadedBundles','setNextBundle'].map(name=>[name,first[name].bind(first)]));api.downloadBundle=options=>first.downloadBundle({...options,url:f.url});
  assert.equal((await manifest.stageUpdate({api,envelope:envelope(),config,target:'windows',subtle:webcrypto.subtle})).status,'ready');assert.equal((await first.getCurrentBundle()).bundleId,null);first.destroy();
  const second=await f.make();assert.equal((await second.getCurrentBundle()).bundleId,release().bundleId);assert.equal((await second.ready()).currentBundleId,release().bundleId);second.destroy();
  const third=await f.make();assert.equal((await third.getCurrentBundle()).bundleId,release().bundleId);await third.ready();
});
test('Windows independently checks the signed installed file inventory on every boot',async t=>{
  const {verifyActiveBundle}=require('./update-host.bundle.cjs');
  const root=await mkdtemp(path.join(tmpdir(),'qiban-signed-files-'));t.after(()=>rm(root,{recursive:true,force:true}));
  const resources={'index.html':Buffer.from('<main>fixture</main>'),'login.html':Buffer.from('<form></form>'),'client-files.json':Buffer.from(JSON.stringify({files:['index.html','login.html']}))};
  const inventory={schema:1,kind:'qiban-ui-files',runtime:config.runtime,target:'windows',sequence:2,files:Object.entries(resources).map(([name,bytes])=>({path:name,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')}))};
  for(const [name,bytes] of Object.entries(resources))await writeFile(path.join(root,name),bytes);
  await writeFile(path.join(root,'qiban-update.json'),JSON.stringify(envelope(inventory)));
  assert.equal((await verifyActiveBundle(root,config)).size,3);
  await writeFile(path.join(root,'index.html'),'changed');await assert.rejects(verifyActiveBundle(root,config),/integrity/);
  await writeFile(path.join(root,'index.html'),resources['index.html']);await writeFile(path.join(root,'qiban-update.json'),JSON.stringify({...envelope(inventory),signature:'A'.repeat(344)}));await assert.rejects(verifyActiveBundle(root,config));
});
test('real update engine rejects a tampered ZIP signature without replacing the current bundle',async t=>{
  const f=await engineFixture(t),engine=await f.make();const bad=Buffer.from(release().signature,'base64');bad[0]^=1;
  await assert.rejects(engine.downloadBundle({bundleId:release().bundleId,url:f.url,signature:bad.toString('base64')}));assert.equal((await engine.getCurrentBundle()).bundleId,null);assert.equal((await engine.getNextBundle()).bundleId,null);
});
test('process death before readiness rolls back and blocks the bad bundle on next start',async t=>{
  const f=await engineFixture(t),first=await f.make();await f.stage(first);first.destroy();const failed=await f.make();assert.equal((await failed.getCurrentBundle()).bundleId,release().bundleId);failed.destroy();
  const restored=await f.make();assert.equal((await restored.getCurrentBundle()).bundleId,null);assert.ok((await restored.getBlockedBundles()).bundleIds.includes(release().bundleId));await restored.ready();
});
test('on-disk next-bundle tampering is rejected before first activation',async t=>{
  const f=await engineFixture(t),first=await f.make();await f.stage(first);await writeFile(path.join(f.directory,'bundles',release().bundleId,'index.html'),'changed');first.destroy();
  const restored=await f.make();assert.equal((await restored.getCurrentBundle()).bundleId,null);await restored.ready();
});
test('server exposes only public update resources and preserves private API and Web origin restrictions',async t=>{
  const root=await mkdtemp(path.join(tmpdir(),'qiban-update-http-'));const updates=path.join(root,'public');await mkdir(path.join(updates,'beta'),{recursive:true});await mkdir(path.join(updates,'bundles'));await writeFile(path.join(updates,'beta/windows.json'),JSON.stringify(envelope()));await writeFile(path.join(updates,'bundles',release().checksum+'.zip'),zip);await writeFile(path.join(root,'private-fixture'),'not public');await symlink(path.join(root,'private-fixture'),path.join(updates,'beta/mobile.json'));
  const {server}=await createCloudApp({dataDir:path.join(root,'accounts'),publicOrigin:'https://updates.qiban.invalid',updatesDir:updates});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(async()=>{await new Promise(resolve=>server.close(resolve));await rm(root,{recursive:true,force:true});});
  const request=(url,method='GET')=>new Promise((resolve,reject)=>{const req=http.request({hostname:'127.0.0.1',port:server.address().port,path:url,method,headers:{Host:'updates.qiban.invalid','Content-Type':'application/json'}},res=>{let text='';res.on('data',c=>text+=c);res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,text}));});req.on('error',reject);req.end(method==='POST'?'{}':undefined);});
  const good=await request('/updates/beta/windows.json');assert.equal(good.status,200);assert.equal(good.headers['cache-control'],'no-store');await verify(JSON.parse(good.text));
  assert.equal((await request('/updates/bundles/'+release().checksum+'.zip')).status,200);
  for(const p of ['/updates/beta/mobile.json','/updates/../private-fixture','/updates/beta/config.json','/updates/bundles/not-a-digest.zip','/updates/secret.pem'])assert.notEqual((await request(p)).status,200);
  assert.equal((await request('/api/workspace')).status,401);assert.equal((await request('/api/auth/register','POST')).status,403);
});
