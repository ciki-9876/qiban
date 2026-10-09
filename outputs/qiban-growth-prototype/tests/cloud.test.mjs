import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile,readdir,writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {Readable} from 'node:stream';
import {randomBytes} from 'node:crypto';
import {createCloudApp} from '../cloud-server.mjs';

const origin='https://qiban.example';
function request(server,url,{method='GET',cookie,csrf,token,payload,host='qiban.example',source=url.startsWith('/api/native/')?null:origin,ip='203.0.113.1'}={}){
  return new Promise(resolve=>{const req=Readable.from(payload===undefined?[]:[Buffer.from(JSON.stringify(payload))]);Object.assign(req,{url,method,socket:{remoteAddress:ip},headers:{host,...(cookie?{cookie}:{}),...(token?{authorization:'Bearer '+token}:{}),...(csrf?{'x-qiban-token':csrf}:{}),...(method==='POST'?{...(source?{origin:source}:{}),'content-type':'application/json'}:{})}});const res={destroyed:false,headersSent:false,writeHead(status,headers){this.status=status;this.headers=headers;this.headersSent=true;},end(body){const raw=String(body||'');resolve({status:this.status,headers:this.headers,raw,...(this.headers?.['Content-Type']?.startsWith('application/json')?{body:JSON.parse(raw)}:{})});}};server.emit('request',req,res);});
}
function workspace(goal){return {schema:2,selectedId:'p1',projects:[{schema:1,id:'p1',status:'active',goal,branches:[{id:'stage-1',name:'第一步'}],tasks:[],attempts:[],snapshots:[],customTasks:[],stageRounds:[],closures:[],drafts:{},accepted:{},stageWork:{}}]};}
async function fixture(fn,extra={}){const dir=await mkdtemp(path.join(os.tmpdir(),'qiban-cloud-test-'));try{const {server}=await createCloudApp({dataDir:dir,publicOrigin:origin,...extra});await fn(server,dir);}finally{await rm(dir,{recursive:true,force:true});}}
async function account(server,username,ip='203.0.113.1'){
  const password=randomBytes(18).toString('base64url');const out=await request(server,'/api/auth/register',{method:'POST',payload:{username,password},ip});assert.equal(out.status,200);const cookie=out.headers['Set-Cookie'].split(';')[0];const info=await request(server,'/api/account',{cookie});return {cookie,csrf:info.body.csrf,username,password};
}
test('cloud requires login, enforces secure session cookies, and does not expose the local API or files',()=>fixture(async server=>{
  assert.equal((await request(server,'/')).status,303);
  for(const p of ['/api/workspace','/api/ai/config','/api/ai/artifacts/read'])assert.equal((await request(server,p)).status,401);
  assert.equal((await request(server,'/api/health')).body.mode,'multiuser');
  assert.equal((await request(server,'/login')).status,200);
  assert.equal((await request(server,'/api/health',{host:'attacker.example'})).status,403);
  const a=await account(server,'alice');const home=await request(server,'/',a);assert.match(home.raw,/qiban-cloud/);assert.match(home.raw,/cloud-storage.js/);
  assert.equal((await request(server,'/cloud-server.mjs',a)).status,404);
  const login=await request(server,'/api/auth/login',{method:'POST',payload:{username:a.username,password:a.password}});assert.match(login.headers['Set-Cookie'],/HttpOnly; SameSite=Lax; Max-Age=604800; Secure/);
}));
test('two users have independent workspaces, AI configs, artifacts, and request caches',()=>fixture(async(server,dir)=>{
  const a=await account(server,'alice'),b=await account(server,'bob');
  const saved=await request(server,'/api/workspace',{...a,method:'POST',payload:{revision:0,workspace:workspace('Alice private goal')}});assert.equal(saved.status,200);
  assert.equal((await request(server,'/api/workspace',b)).body.workspace,null);
  assert.equal((await request(server,'/api/workspace',a)).body.workspace.projects[0].goal,'Alice private goal');
  const key=randomBytes(24).toString('hex');const config={baseUrl:'https://api.deepseek.com',model:'test-model',apiKey:key,format:'json_object',tokenField:'max_tokens'};
  assert.equal((await request(server,'/api/ai/config',{...a,method:'POST',payload:config})).status,200);
  assert.equal((await request(server,'/api/ai/config',b)).body.configured,false);
  assert.doesNotMatch((await request(server,'/api/ai/config',a)).raw,new RegExp(key));
  const upload=await request(server,'/api/ai/artifacts/upload',{...a,method:'POST',payload:{name:'note.txt',base64:Buffer.from('Alice private evidence').toString('base64')}});assert.equal(upload.status,200);
  assert.equal((await request(server,'/api/ai/artifacts/read',{...b,method:'POST',payload:{id:upload.body.id}})).status,404);
  assert.equal((await request(server,'/api/ai/artifacts/read',{...a,method:'POST',payload:{id:upload.body.id}})).body.content,'Alice private evidence');
  await request(server,'/api/ai/plan',{...a,method:'POST',payload:{requestId:'same-request-id',context:{goal:'Alice goal'}}});
  assert.equal((await request(server,'/api/ai/plan',{...b,method:'POST',payload:{requestId:'same-request-id',context:{goal:'Bob goal'}}})).status,409);
  const users=await readdir(path.join(dir,'users'));assert.equal(users.length,2);
  for(const p of await readdir(path.join(dir,'accounts'))){const raw=await readFile(path.join(dir,'accounts',p),'utf8');assert.ok(!raw.includes(a.password)&&!raw.includes(b.password));assert.match(raw,/passwordHash/);}
},{modelCall:async(_config,kind,context)=>({result:{stages:[{name:context.goal}]},meta:{model:'mock'}})}));
test('workspace writes reject stale revisions, invalid shapes, cross-origin requests and another account CSRF token',()=>fixture(async server=>{
  const a=await account(server,'alice'),b=await account(server,'bob');const payload={revision:0,workspace:workspace('Private')};
  assert.equal((await request(server,'/api/workspace',{...a,method:'POST',payload,csrf:b.csrf})).status,403);
  assert.equal((await request(server,'/api/workspace',{...a,method:'POST',payload,source:'https://evil.example'})).status,403);
  const results=await Promise.all([request(server,'/api/workspace',{...a,method:'POST',payload}),request(server,'/api/workspace',{...a,method:'POST',payload})]);assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
  assert.equal((await request(server,'/api/workspace',{...a,method:'POST',payload:{revision:1,workspace:{schema:2,projects:[]}}})).status,400);
}));
test('cloud blocks private-network AI endpoints, revokes logout sessions, and persists accounts across restarts',()=>fixture(async(server,dir)=>{
  const a=await account(server,'alice');
  for(const baseUrl of ['http://127.0.0.1:52160','https://localhost','https://metadata.example','https://api.deepseek.com:8443']){const result=await request(server,'/api/ai/config',{...a,method:'POST',payload:{baseUrl,model:'test',apiKey:'not-a-real-key'}});assert.ok([400,422].includes(result.status));}
  const {server:second}=await createCloudApp({dataDir:dir,publicOrigin:origin});assert.equal((await request(second,'/api/account',a)).status,200);
  const renewed=await request(second,'/api/account',a);assert.equal((await request(second,'/api/auth/logout',{cookie:a.cookie,csrf:renewed.body.csrf,method:'POST',payload:{}})).status,200);
  assert.equal((await request(second,'/api/workspace',a)).status,401);
  assert.equal((await request(second,'/api/auth/login',{method:'POST',payload:{username:a.username,password:a.password}})).status,200);
}));
test('expired sessions and account limits are enforced',()=>fixture(async server=>{
  const a=await account(server,'alice');assert.equal((await request(server,'/api/auth/register',{method:'POST',payload:{username:'bob',password:randomBytes(20).toString('hex')}})).status,403);
},{maxUsers:1}));
test('session expiration is checked on every request',async()=>{let time=Date.now();await fixture(async server=>{const a=await account(server,'alice');time+=8*86400000;assert.equal((await request(server,'/api/workspace',a)).status,401);},{now:()=>time});});

async function nativeAccount(server,username,ip='203.0.113.1'){
  const password=randomBytes(18).toString('base64url');
  const out=await request(server,'/api/native/auth/register',{method:'POST',payload:{username,password},ip});
  assert.equal(out.status,200);assert.equal(out.headers['Set-Cookie'],undefined);assert.equal(out.headers['Access-Control-Allow-Origin'],undefined);
  assert.match(out.body.token,/^[a-f0-9]{64}$/);assert.match(out.body.accountId,/^[a-f0-9]{32}$/);assert.equal(out.body.username,username);assert.equal(typeof out.body.expires,'number');
  return {...out.body,password};
}
test('native and browser sessions are separate and native authentication never sets cookies or CORS',()=>fixture(async(server,dir)=>{
  const a=await nativeAccount(server,'alice');
  const info=await request(server,'/api/native/account',a);assert.deepEqual(info.body,{accountId:a.accountId,username:'alice',expires:a.expires});assert.equal(info.body.csrf,undefined);
  assert.equal((await request(server,'/api/account',{token:a.token})).status,403);
  assert.equal((await request(server,'/api/account',{cookie:'__Host-qiban='+a.token})).status,401);
  assert.equal((await request(server,'/api/native/account',{cookie:'__Host-qiban='+a.token})).status,403);
  assert.equal((await request(server,'/api/native/account',{...a,source:'https://evil.example',method:'POST',payload:{}})).status,403);
  const web=await request(server,'/api/auth/login',{method:'POST',payload:{username:a.username,password:a.password}});
  const cookie=web.headers['Set-Cookie'].split(';')[0],webToken=cookie.split('=')[1];
  const webInfo=await request(server,'/api/account',{cookie});assert.equal(webInfo.body.accountId,a.accountId);assert.equal(typeof webInfo.body.expires,'number');
  assert.equal((await request(server,'/api/native/account',{token:webToken})).status,401);
  assert.equal((await request(server,'/api/native/account',{cookie,token:a.token})).status,403);
  assert.equal((await request(server,'/api/workspace',{cookie,token:a.token})).status,403);
  // Persisted sessions contain identifiers and channel information, never raw tokens.
  for(const file of await readdir(path.join(dir,'sessions'))){const content=await readFile(path.join(dir,'sessions',file),'utf8');assert.ok(!content.includes(a.token)&&!content.includes(webToken));assert.match(content,/"channel":"(?:native|web)"/);}
}));
test('native requests reuse isolated workspaces, provider validation, artifact ownership and AI cache protection',()=>fixture(async server=>{
  const a=await nativeAccount(server,'alice'),b=await nativeAccount(server,'bob');
  const value={revision:0,workspace:workspace('Native private goal')};
  assert.equal((await request(server,'/api/native/workspace',{...a,method:'POST',payload:value})).status,200);
  assert.equal((await request(server,'/api/native/workspace',b)).body.workspace,null);
  assert.equal((await request(server,'/api/native/workspace?accountId='+b.accountId,a)).body.workspace.projects[0].goal,'Native private goal');
  assert.equal((await request(server,'/api/native/workspace',{...a,method:'POST',payload:value})).status,409);
  assert.equal((await request(server,'/api/native/workspace',{...a,method:'POST',payload:{revision:1,workspace:{schema:2,projects:[]}}})).status,400);
  assert.equal((await request(server,'/api/native/workspace/alice',a)).status,404);
  assert.equal((await request(server,'/api/native/ai/config',{...a,method:'POST',payload:{baseUrl:'http://127.0.0.1',model:'test',apiKey:'synthetic-fixture-key'}})).status,422);
  const config={baseUrl:'https://api.deepseek.com',model:'mock',apiKey:randomBytes(18).toString('hex'),format:'json_object',tokenField:'max_tokens'};
  assert.equal((await request(server,'/api/native/ai/config',{...a,method:'POST',payload:config})).status,200);
  assert.equal((await request(server,'/api/native/ai/config',b)).body.configured,false);
  const upload=await request(server,'/api/native/ai/artifacts/upload',{...a,method:'POST',payload:{name:'fixture.txt',base64:Buffer.from('Synthetic evidence').toString('base64')}});
  assert.equal(upload.status,200);assert.equal((await request(server,'/api/native/ai/artifacts/read',{...b,method:'POST',payload:{id:upload.body.id}})).status,404);
  assert.equal((await request(server,'/api/native/ai/artifacts/read',{...a,method:'POST',payload:{id:upload.body.id}})).body.content,'Synthetic evidence');
  const plan=await request(server,'/api/native/ai/plan',{...a,method:'POST',payload:{requestId:'native-fixture-plan',context:{goal:'Native private goal'}}});assert.equal(plan.status,200);
  assert.equal((await request(server,'/api/native/ai/plan',{...b,method:'POST',payload:{requestId:'native-fixture-plan',context:{goal:'Another goal'}}})).status,409);
  assert.equal(plan.headers['Set-Cookie'],undefined);assert.equal(plan.headers['Access-Control-Allow-Origin'],undefined);
},{modelCall:async(_config,_kind,context)=>({result:{stages:[{name:context.goal}]},meta:{model:'mock'}})}));
test('native logout is revoked across restart and checks expiration on every request',async()=>{
  let time=Date.now();await fixture(async(server,dir)=>{
    const a=await nativeAccount(server,'alice');
    const {server:second}=await createCloudApp({dataDir:dir,publicOrigin:origin,now:()=>time});
    assert.equal((await request(second,'/api/native/account',a)).status,200);
    const logout=await request(second,'/api/native/auth/logout',{...a,method:'POST',payload:{}});assert.equal(logout.status,200);assert.equal(logout.headers['Set-Cookie'],undefined);
    assert.equal((await request(server,'/api/native/workspace',a)).status,401);
    const login=await request(second,'/api/native/auth/login',{method:'POST',payload:{username:a.username,password:a.password}});assert.equal(login.status,200);assert.equal(login.headers['Set-Cookie'],undefined);
    assert.equal((await request(second,'/api/native/account',{token:login.body.token})).status,200);
    time=login.body.expires;assert.equal((await request(second,'/api/native/account',{token:login.body.token})).status,401);
  },{now:()=>time});
});
test('five retained sessions are shared between native and browser channels, including legacy browser sessions',async()=>{
  let time=Date.now();await fixture(async(server,dir)=>{
    const web=await account(server,'alice');
    const oldFile=path.join(dir,'sessions',(await readdir(path.join(dir,'sessions')))[0]);const legacy=JSON.parse(await readFile(oldFile,'utf8'));delete legacy.channel;await writeFile(oldFile,JSON.stringify(legacy));
    assert.equal((await request(server,'/api/account',web)).status,200);
    const tokens=[];
    for(let i=0;i<6;i++){time+=1000;const login=await request(server,'/api/native/auth/login',{method:'POST',payload:{username:web.username,password:web.password}});assert.equal(login.status,200);tokens.push(login.body.token);}
    assert.equal((await readdir(path.join(dir,'sessions'))).length,5);
    assert.equal((await request(server,'/api/account',web)).status,401);
    assert.equal((await request(server,'/api/native/account',{token:tokens[0]})).status,401);
    for(const token of tokens.slice(1))assert.equal((await request(server,'/api/native/account',{token})).status,200);
  },{now:()=>time});
});
test('anonymous shell contains only approved public assets and no session or account content',()=>fixture(async server=>{
  const shell=await request(server,'/app-shell.html');assert.equal(shell.status,200);assert.match(shell.raw,/qiban-cloud/);assert.match(shell.raw,/platform.js/);assert.match(shell.raw,/cloud-storage.js/);assert.doesNotMatch(shell.raw,/qiban-session/);assert.equal((shell.raw.match(/src=["']\/?platform\.js/g)||[]).length,1);assert.equal((shell.raw.match(/src=["']\/?cloud-storage\.js/g)||[]).length,1);assert.equal(shell.headers['Set-Cookie'],undefined);
  const login=await request(server,'/login');assert.equal((login.raw.match(/src=["']\/?platform\.js/g)||[]).length,1);
  for(const asset of ['/app.js','/style.css','/project-state.js','/assets/qixi-editorial.png'])assert.equal((await request(server,asset)).status,200);
  const a=await account(server,'alice');
  for(const denied of ['/cloud-server.mjs','/server.mjs','/ai.mjs','/package.json','/tests/cloud.test.mjs','/icons/../cloud-server.mjs'])assert.equal((await request(server,denied,a)).status,404);
  const health=await request(server,'/api/native/health');assert.deepEqual(health.body,{app:'qiban',version:'0.9.0-beta.1',mode:'multiuser',apiVersion:1});
  assert.equal((await request(server,'/')).status,303);
}));

test('native authentication preserves account limits, error handling and bounded concurrent password work',()=>fixture(async server=>{
  assert.equal((await request(server,'/api/native/account')).status,401);
  assert.equal((await request(server,'/api/native/auth/login',{method:'POST',payload:null})).status,400);
  const a=await nativeAccount(server,'alice');
  assert.equal((await request(server,'/api/native/auth/register',{method:'POST',payload:{username:'bob',password:randomBytes(18).toString('hex')}})).status,403);
  assert.equal((await request(server,'/api/native/auth/login',{method:'POST',payload:{username:a.username,password:'wrong-password-fixture'}})).status,401);
  const logins=await Promise.all(Array.from({length:8},()=>request(server,'/api/native/auth/login',{method:'POST',payload:{username:a.username,password:a.password}})));
  assert.equal(logins.filter(r=>r.status===200).length,3);assert.equal(logins.filter(r=>r.status===429).length,5);
  for(const result of logins){assert.equal(result.headers['Set-Cookie'],undefined);assert.equal(result.headers['Access-Control-Allow-Origin'],undefined);}
},{maxUsers:1}));
