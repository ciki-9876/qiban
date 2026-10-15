// Reproduces an already signed release using PUBLIC metadata only. No signing key is needed on servers or CI.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {createHash,verify,webcrypto} from 'node:crypto';
import {zipSync} from 'fflate';
import manifest from '../clients/updates/manifest.cjs';
import {runtimeFingerprint} from './runtime-fingerprint.mjs';
const root=path.resolve(import.meta.dirname,'..'),output=path.resolve(process.argv[2]||path.join(root,'artifacts/client-updates-rebuilt'));
const config=JSON.parse(await readFile(path.join(root,'clients/updates/config.json'),'utf8'));
const lock=JSON.parse(await readFile(path.join(root,'clients/updates/runtime-lock.json'),'utf8'));
if(lock.fingerprint!==await runtimeFingerprint())throw Error('Native runtime fingerprint mismatch.');
await mkdir(path.join(output,'bundles'),{recursive:true});await mkdir(path.join(output,'beta'),{recursive:true});
for(const target of ['mobile','windows']) {
  const signed=await readFile(path.join(root,'deploy/client-updates/beta',target+'.json'));
  const release=await manifest.verifyManifest(JSON.parse(signed),config,target,webcrypto.subtle);
  if(release.incompatible)throw Error('Incompatible native runtime.');
  const signedInventory=await readFile(path.join(root,'deploy/client-updates/inventories',target+'.json'));
  const inventory=await manifest.verifiedPayload(JSON.parse(signedInventory),config,webcrypto.subtle);
  if(inventory.kind!=='qiban-ui-files'||inventory.runtime!==config.runtime||inventory.target!==target||inventory.sequence!==release.sequence||inventory.version!==release.version)throw Error('Invalid signed resource inventory.');
  const contents={},source=path.join(root,'dist',target),client=JSON.parse(await readFile(path.join(source,'client-files.json'),'utf8'));
  if(JSON.stringify(inventory.files.map(f=>f.path).sort())!==JSON.stringify([...client.files,'client-files.json'].sort()))throw Error('Client resource allowlist mismatch.');
  for(const file of inventory.files){
    if(!/^[a-z0-9_./-]+$/i.test(file.path)||file.path.split('/').some(v=>['','.','..'].includes(v)))throw Error('Invalid signed path.');
    const bytes=await readFile(path.join(source,file.path));if(bytes.length!==file.bytes||createHash('sha256').update(bytes).digest('hex')!==file.sha256)throw Error('Public resource differs from signed release: '+file.path);
    contents[file.path]=[bytes,{mtime:new Date(2026,0,1,0,0,0)}];
  }
  contents['qiban-update.json']=[signedInventory,{mtime:new Date(2026,0,1,0,0,0)}];
  const zip=zipSync(contents,{level:6});
  if(zip.length!==release.bytes||createHash('sha256').update(zip).digest('hex')!==release.checksum||!verify('RSA-SHA256',zip,config.publicKey,Buffer.from(release.signature,'base64')))throw Error('Rebuilt ZIP does not match the signed release.');
  await writeFile(path.join(output,'bundles',release.checksum+'.zip'),zip,{flag:'wx'});await writeFile(path.join(output,'beta',target+'.json'),signed,{flag:'wx'});
  console.log(target+': exact signed ZIP reproduced, '+zip.length+' bytes, sequence '+release.sequence);
}
