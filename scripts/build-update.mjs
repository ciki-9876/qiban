import {readFile,writeFile,mkdir,readdir,lstat} from 'node:fs/promises';
import path from 'node:path';
import {createHash,sign,createPrivateKey,createPublicKey} from 'node:crypto';
import {zipSync} from 'fflate';
import {runtimeFingerprint} from './runtime-fingerprint.mjs';
const root=path.resolve(import.meta.dirname,'..');
const arguments_=Object.fromEntries(process.argv.slice(2).map(item=>{const at=item.indexOf('=');if(!item.startsWith('--')||at<3)throw Error('Use --name=value options.');return [item.slice(2,at),item.slice(at+1)];}));
const sequence=Number(arguments_.sequence),version=arguments_.version,keyPath=arguments_.key;
if(!Number.isSafeInteger(sequence)||sequence<1||!/^\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?$/.test(version||'')||!path.isAbsolute(keyPath||''))throw Error('Supply --sequence, --version and an absolute --key outside the repository.');
if(path.resolve(keyPath).startsWith(root+path.sep))throw Error('Signing keys must stay outside the repository.');
const config=JSON.parse(await readFile(path.join(root,'clients/updates/config.json'),'utf8'));
const lock=JSON.parse(await readFile(path.join(root,'clients/updates/runtime-lock.json'),'utf8'));
if(lock.runtime!==config.runtime||lock.fingerprint!==await runtimeFingerprint())throw Error('Native runtime changed. Build a new binary/runtime before publishing a web update.');
const key=createPrivateKey(await readFile(keyPath));
if(createPublicKey(key).export({type:'spki',format:'pem'})!==config.publicKey)throw Error('Update signing key does not match the embedded trust anchor.');
const output=path.resolve(arguments_.out||path.join(root,'artifacts/client-updates'));
await mkdir(path.join(output,'bundles'),{recursive:true});await mkdir(path.join(output,'beta'),{recursive:true});
async function list(folder,prefix=''){let all=[];for(const file of await readdir(folder,{withFileTypes:true})){const name=prefix+file.name;if(file.isSymbolicLink())throw Error('Symlinks are not client resources.');all.push(...file.isDirectory()?await list(path.join(folder,file.name),name+'/'):[name]);}return all.sort();}
await mkdir(path.join(output,'inventories'),{recursive:true});
const report=[];
for(const target of ['mobile','windows']) {
  const source=path.join(root,'dist',target),client=JSON.parse(await readFile(path.join(source,'client-files.json'),'utf8'));
  const files=[...client.files,'client-files.json'].sort();
  if(JSON.stringify(files)!==JSON.stringify(await list(source)))throw Error('Client resource allowlist does not match the bundle.');
  const contents={};let unpacked=0;
  for(const file of files){if(!/^[a-z0-9_./-]+$/i.test(file)||file.split('/').some(p=>['..','.',''].includes(p))||/(^|\/)(accounts|sessions|private|work|\.env)(\/|$)/i.test(file)||file.endsWith('.mjs'))throw Error('Invalid client resource.');const bytes=await readFile(path.join(source,file));unpacked+=bytes.length;contents[file]=[bytes,{mtime:new Date(2026,0,1,0,0,0)}];}
  const inventory={schema:1,kind:'qiban-ui-files',runtime:config.runtime,target,sequence,version,files:files.map(name=>({path:name,bytes:contents[name][0].length,sha256:createHash('sha256').update(contents[name][0]).digest('hex')}))};
  const inventoryBytes=Buffer.from(JSON.stringify(inventory));
  const signedInventory=Buffer.from(JSON.stringify({payload:inventoryBytes.toString('base64'),signature:sign('RSA-SHA256',inventoryBytes,key).toString('base64')}));
  contents['qiban-update.json']=[signedInventory,{mtime:new Date(2026,0,1,0,0,0)}];
  const zip=zipSync(contents,{level:6});if(zip.length>32*1024*1024||unpacked>64*1024*1024)throw Error('Update is too large.');
  const checksum=createHash('sha256').update(zip).digest('hex'),bundleId=`qiban2-${sequence}-${checksum.slice(0,16)}`;
  const payload={schema:1,channel:config.channel,runtime:config.runtime,target,sequence,version,bundleId,checksum,bytes:zip.length,url:`https://81.70.181.205/updates/bundles/${checksum}.zip`,signature:sign('RSA-SHA256',zip,key).toString('base64')};
  const bytes=Buffer.from(JSON.stringify(payload));const envelope={payload:bytes.toString('base64'),signature:sign('RSA-SHA256',bytes,key).toString('base64')};
  await writeFile(path.join(output,'bundles',checksum+'.zip'),zip,{flag:'wx'});
  await writeFile(path.join(output,'beta',target+'.json'),JSON.stringify(envelope)+'\n',{flag:'wx'});
  await writeFile(path.join(output,'inventories',target+'.json'),signedInventory,{flag:'wx'});
  report.push({target,sequence,version,bundleId,bytes:zip.length,checksum});
}
await writeFile(path.join(output,'release.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify(report,null,2));
