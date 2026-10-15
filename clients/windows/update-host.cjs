'use strict';
const {LiveUpdateEngine} = require('@capawesome/electron-live-update/engine');
const {webcrypto,createHash} = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const manifest = require('../updates/manifest.cjs');
const config = require('../updates/config.json');
const quiet = {debug(){},info(){},warn(){},error(){}};
async function verifyActiveBundle(root,trust=config) {
  const inventoryPath=path.join(root,'qiban-update.json'),info=await fs.lstat(inventoryPath);
  if(!info.isFile()||info.isSymbolicLink()||info.size>24000)throw Error('Invalid installed bundle inventory file.');
  const inventory=await manifest.verifiedPayload(JSON.parse(await fs.readFile(inventoryPath,'utf8')),trust,webcrypto.subtle);
  if(inventory.kind!=='qiban-ui-files'||inventory.runtime!==trust.runtime||inventory.target!=='windows'||!Array.isArray(inventory.files)||inventory.files.length>100)throw Error('Invalid installed bundle inventory.');
  const checks=new Map();
  for(const file of inventory.files){
    if(!/^[a-z0-9_./-]+$/i.test(file.path)||file.path.split('/').some(p=>['','.','..'].includes(p))||checks.has(file.path)||!Number.isSafeInteger(file.bytes)||file.bytes<0||file.bytes>32*1024*1024)throw Error('Invalid installed bundle path.');
    const info=await fs.lstat(path.join(root,file.path));if(!info.isFile()||info.isSymbolicLink())throw Error('Invalid installed bundle file.');
    const bytes=await fs.readFile(path.join(root,file.path));
    if(bytes.length!==file.bytes||createHash('sha256').update(bytes).digest('hex')!==file.sha256)throw Error('Installed bundle integrity failed.');
    checks.set(file.path,file.sha256);
  }
  const client=JSON.parse(await fs.readFile(path.join(root,'client-files.json'),'utf8'));
  if(JSON.stringify([...checks.keys()].sort())!==JSON.stringify([...client.files,'client-files.json'].sort()))throw Error('Installed bundle resource allowlist changed.');
  return checks;
}
async function createUpdateHost({directory,version,fetchManifest,rollback}) {
  const engine = new LiveUpdateEngine({dataDirectory:path.join(directory,'ui-updates-v2'),platform:'windows',versionCode:version,versionName:version,publicKey:config.publicKey,readyTimeout:60000,autoBlockRolledBackBundles:true,autoDeleteBundles:true,logger:quiet});
  await engine.initialize();
  engine.on('rolledBack', () => {Promise.resolve(rollback()).catch(()=>{});});
  const blockedFile=path.join(directory,'ui-updates-v2','qiban-rejected.json');let rejected=[];
  try{const value=JSON.parse(await fs.readFile(blockedFile,'utf8'));if(Array.isArray(value))rejected=value.filter(id=>/^qiban2-[0-9]+-[a-f0-9]{16}$/.test(id)).slice(-100);}catch{}
  let checks=null;
  async function rejectActive(){
    const {bundleId}=await engine.getCurrentBundle();if(bundleId){rejected=[...new Set([...rejected,bundleId])].slice(-100);await fs.writeFile(blockedFile+'.tmp',JSON.stringify(rejected));await fs.rename(blockedFile+'.tmp',blockedFile);}
    await engine.reset();await engine.applyNextBundle();checks=null;
  }
  async function root(){
    const current=engine.getCurrentBundlePath();if(!current){checks=null;return null;}
    try{checks=await verifyActiveBundle(current);return current;}catch{await rejectActive();return null;}
  }
  await root();
  const api=Object.create(engine);
  // Keep methods bound to the engine's private state and add persistent local-integrity rejections.
  for(const name of ['getCurrentBundle','getNextBundle','getDownloadedBundles','downloadBundle','setNextBundle'])api[name]=engine[name].bind(engine);
  api.getBlockedBundles=async()=>({bundleIds:[...(await engine.getBlockedBundles()).bundleIds,...rejected]});
  let checking;
  return {
    root,
    verifyAsset:(name,bytes)=>!checks||createHash('sha256').update(bytes).digest('hex')===checks.get(name),
    rejectActive,
    dispose:()=>engine.destroy(),
    ready: () => engine.ready(),
    check: () => checking ||= (async () => {
      const response = await fetchManifest(`${manifest.ORIGIN}/updates/beta/windows.json`);
      if (response.status === 404) return {status:'current'};
      if (response.status !== 200) throw Error('暂时无法检查更新。');
      return manifest.stageUpdate({api,envelope:response.data,config,target:'windows',subtle:webcrypto.subtle});
    })().finally(() => {checking=null;})
  };
}
module.exports = {createUpdateHost,verifyActiveBundle};
