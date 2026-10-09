import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {IDBFactory} from 'fake-indexeddb';

const platform=await readFile(new URL('../platform.js',import.meta.url),'utf8');
const cloud=await readFile(new URL('../cloud-storage.js',import.meta.url),'utf8');
const KEY='qiban.growth.prototype.v1',A='a'.repeat(32),B='b'.repeat(32);
const copy=value=>JSON.parse(JSON.stringify(value));
const locksByDatabase=new WeakMap();
const workspace=goal=>({schema:2,selectedId:'p1',projects:[{schema:1,id:'p1',goal,status:'active',drafts:{}}]});
function serverState(){return {accountId:A,offline:false,writeStatus:200,revision:3,workspace:workspace('自己的云端目标'),writes:[],requests:[]};}
async function browserFixture({state=serverState(),indexedDB=new IDBFactory(),native=false,saveResult={ok:true},vault=new Map(),expectFailure=false}={}){
  const els=new Map(),listeners=new Map(),documentListeners=new Map(),timers=new Map(),ownedLocks=new Set();let timerId=0;
  if(!locksByDatabase.has(indexedDB))locksByDatabase.set(indexedDB,new Set());const heldLocks=locksByDatabase.get(indexedDB);
  const locks={request:async(name,_options,callback)=>{if(heldLocks.has(name))return callback(null);heldLocks.add(name);ownedLocks.add(name);try{return await callback({name});}finally{heldLocks.delete(name);ownedLocks.delete(name);}}};
  const element=()=>({textContent:'',title:'',style:{},children:[],listeners:new Map(),setAttribute(){},append(...children){for(const child of children){this.children.push(child);if(child.id)els.set('#'+child.id,child);}},prepend(child){this.children.unshift(child);},replaceChildren(...children){this.children=[];this.append(...children);},addEventListener(type,fn){this.listeners.set(type,fn);},remove(){els.delete('#'+this.id);},async click(event={}){return (this.onclick||this.listeners.get('click'))?.(event);}});
  els.set('#more-menu',element());els.set('#saved-state',element());
  const document={readyState:'complete',visibilityState:'visible',documentElement:{classList:{add(){}}},body:element(),querySelector:s=>els.get(s)||null,createElement:element,addEventListener:(type,fn)=>documentListeners.set(type,fn)};
  async function transport(path,options={}){
    const method=options.method||'GET',payload=options.body===undefined?undefined:typeof options.body==='string'?JSON.parse(options.body):options.body;
    state.requests.push({path,options:copy({...options,signal:undefined}),payload});
    if(path==='/api/account'&&state.startupError)throw state.startupError;
    if(state.offline)throw TypeError('fixture disconnected');
    if(path==='/api/account'&&state.accountStatus)return {status:state.accountStatus,data:{message:'fixture account expired'}};
    if(path==='/api/account')return {status:200,data:{accountId:state.accountId,username:state.accountId===A?'alice':'bob',csrf:'csrf-'+state.accountId,expires:Date.now()+86400000}};
    if(path==='/api/workspace'&&method==='GET')return {status:200,data:{accountId:state.workspaceAccountId||state.accountId,revision:state.revision,workspace:copy(state.workspace)}};
    if(path==='/api/workspace'&&method==='POST'){
      state.writes.push(payload);
      if(state.gate){const gate=state.gate;state.gate=null;gate.started(payload);await gate.wait;}
      if(state.writeStatus!==200)return {status:state.writeStatus,data:{message:state.writeStatus===409?'另一个页面已保存新内容。':'fixture unavailable'}};
      assert.equal(payload.revision,state.revision);state.workspace=copy(payload.workspace);return {status:200,data:{accountId:state.accountId,revision:++state.revision}};
    }
    return {status:200,data:{ok:true}};
  }
  const nativeState={active:true,saveResult,deleteCalls:0,logoutCalls:0,cacheLastCalls:0,exports:[]};
  const nativeBridge={
    request:options=>transport(options.path,options),auth:async()=>({accountId:state.accountId,username:'alice',expires:Date.now()+86400000}),
    cacheRead:async({accountId})=>{assert.equal(nativeState.active,true);if(state.cacheReadError)throw state.cacheReadError;return copy(vault.get(accountId)||null);},
    cacheWrite:async({accountId,record})=>{assert.equal(nativeState.active,true);vault.set(accountId,copy(record));return {ok:true};},
    cacheDelete:async({accountId})=>{nativeState.deleteCalls++;if(!nativeState.active)throw Error('session revoked');vault.delete(accountId);return {ok:true};},
    cacheRemember:async meta=>{vault.set('last',copy(meta));return {ok:true};},cacheLast:async()=>{nativeState.cacheLastCalls++;return copy(vault.get('last')||null);},cacheForget:async()=>{vault.delete('last');return {ok:true};},
    logout:async()=>{if(state.logoutError)throw state.logoutError;nativeState.logoutCalls++;nativeState.active=false;vault.delete(state.accountId);vault.delete('last');return {ok:true};},
    saveFile:async options=>{nativeState.exports.push(options);return nativeState.saveResult;},openExternal:async()=>({ok:true})
  };
  const box={document,indexedDB,Blob,URL,File,AbortSignal,Map,console,btoa,CustomEvent:class {constructor(type,options={}){this.type=type;this.detail=options.detail;}},navigator:{onLine:!state.offline,locks},location:{href:'https://qiban.example/',origin:'https://qiban.example',replace(url){box.redirect=url;},reload(){box.reloaded=true;}},localStorage:{getItem(){throw Error('must not read another account or local-prototype data');}},setTimeout(fn,delay){const id=++timerId;timers.set(id,{fn,delay});return id;},clearTimeout(id){timers.delete(id);},fetch:async(path,options)=>{const out=await transport(path,options);return {status:out.status,headers:{get:name=>name==='X-Qiban-Account'?state.workspaceAccountId||state.accountId:null},json:async()=>out.data};},...(native?{QibanNative:nativeBridge}:{})};
  box.window=box;box.addEventListener=(type,fn)=>listeners.set(type,fn);box.dispatchEvent=event=>listeners.get(event.type)?.(event);
  vm.runInNewContext(platform,box);vm.runInNewContext(cloud,box);let failure;
  try{await box.QibanCloud.ready;}catch(error){if(!expectFailure)throw error;failure=error;}
  return {box,els,listeners,documentListeners,state,indexedDB,nativeState,vault,timers,failure,close(){for(const name of ownedLocks)heldLocks.delete(name);ownedLocks.clear();}};
}
function button(fixture,label){return fixture.els.get('#more-menu').children.find(el=>el.textContent===label)||fixture.els.get('#cloud-notice')?.children.find(el=>el.textContent===label);}

test('cloud bootstrap uses the real platform, persists before upload, and acknowledges revision and CSRF',async()=>{
  const f=await browserFixture(),C=f.box.QibanCloud;assert.equal(JSON.parse(C.storage.getItem(KEY)).projects[0].goal,'自己的云端目标');
  const next=workspace('中文修改后的目标');C.storage.setItem(KEY,JSON.stringify(next));await C.persisted();
  const local=await f.box.QibanPlatform.cache.read(A);assert.equal(local.dirty,true);assert.equal(local.workspace.projects[0].goal,next.projects[0].goal);
  assert.equal(f.els.get('#saved-state').textContent,'正在同步');await C.flush();assert.equal(f.els.get('#saved-state').textContent,'已同步到账号');
  const write=f.state.requests.find(r=>r.path==='/api/workspace'&&r.options.method==='POST');assert.equal(write.options.headers['X-Qiban-Token'],'csrf-'+A);assert.equal(write.options.credentials,'same-origin');assert.equal(write.payload.revision,3);
  assert.equal((await f.box.QibanPlatform.cache.read(A)).dirty,false);
});
test('cloud bootstrap selects only the current account cache and never imports another account draft',async()=>{
  const indexedDB=new IDBFactory(),alice=await browserFixture({indexedDB});alice.state.offline=true;alice.box.navigator.onLine=false;
  alice.box.QibanCloud.storage.setItem(KEY,JSON.stringify(workspace('Alice 未同步私人草稿')));alice.box.QibanCloud.setForm('goal',{text:'Alice 的输入'});await alice.box.QibanCloud.persisted();
  const bobState=serverState();bobState.accountId=B;bobState.workspace=workspace('Bob 自己的云端内容');const bob=await browserFixture({state:bobState,indexedDB});
  assert.equal(JSON.parse(bob.box.QibanCloud.storage.getItem(KEY)).projects[0].goal,'Bob 自己的云端内容');assert.equal(bob.box.QibanCloud.getForm('goal'),null);
  assert.equal((await bob.box.QibanPlatform.cache.read(A)).workspace.projects[0].goal,'Alice 未同步私人草稿');assert.equal((await bob.box.QibanPlatform.cache.last()).accountId,B);
});
test('offline workspaces and Chinese form drafts survive process recreation in IndexedDB',async()=>{
  const state=serverState(),first=await browserFixture({state});state.offline=true;first.box.navigator.onLine=false;
  first.box.QibanCloud.storage.setItem(KEY,JSON.stringify(workspace('断网后保留的中文记录')));first.box.QibanCloud.setForm('edit-goal',{goal:'还未提交的愿望',scope:'每周一步'});await first.box.QibanCloud.persisted();
  first.close();const restarted=await browserFixture({state,indexedDB:first.indexedDB});assert.equal(JSON.parse(restarted.box.QibanCloud.storage.getItem(KEY)).projects[0].goal,'断网后保留的中文记录');
  assert.deepEqual(copy(restarted.box.QibanCloud.getForm('edit-goal')),{goal:'还未提交的愿望',scope:'每周一步'});assert.equal(restarted.box.QibanCloud.requireOnline(),false);assert.equal(state.writes.length,0);assert.equal(restarted.els.get('#saved-state').textContent,'已保存到本机');
});
test('a 409 stops cloud writes while later typing remains persistent and logout is blocked',async()=>{
  const state=serverState();state.writeStatus=409;const f=await browserFixture({state}),C=f.box.QibanCloud;
  C.storage.setItem(KEY,JSON.stringify(workspace('冲突前的文字')));await C.flush();assert.equal(state.writes.length,1);
  C.storage.setItem(KEY,JSON.stringify(workspace('冲突后继续写的文字')));await C.persisted();await C.flush();assert.equal(state.writes.length,1);
  assert.equal((await f.box.QibanPlatform.cache.read(A)).workspace.projects[0].goal,'冲突后继续写的文字');assert.equal(f.els.get('#saved-state').textContent,'尚未同步');
  let warned=false;f.listeners.get('beforeunload')({preventDefault(){warned=true;}});assert.equal(warned,true);
  await button(f,'退出账号').click();assert.equal(state.requests.some(r=>r.path==='/api/auth/logout'),false);assert.equal(f.box.redirect,undefined);
});
test('canceling a native draft export cannot unlock replacement with the cloud version',async()=>{
  for(const saveResult of [{ok:false},{canceled:true}]){
    const state=serverState();state.writeStatus=409;const f=await browserFixture({state,native:true,saveResult}),C=f.box.QibanCloud;
    C.storage.setItem(KEY,JSON.stringify(workspace('必须保留的本机草稿')));await C.flush();
    try{await C.backup();}catch{}
    await button(f,'先导出，再载入云端版本').click();assert.equal(f.box.reloaded,undefined);assert.equal(JSON.parse(C.storage.getItem(KEY)).projects[0].goal,'必须保留的本机草稿');
    f.nativeState.saveResult={ok:true};await C.backup();await button(f,'先导出，再载入云端版本').click();assert.equal(f.box.reloaded,true);assert.equal(JSON.parse(C.storage.getItem(KEY)).projects[0].goal,'自己的云端目标');
    assert.equal(f.nativeState.exports.at(-1).share,false,'conflict backups must confirm a saved file rather than only launch a share chooser');
  }
});
test('web logout revokes the session, clears the account cache and returns to login',async()=>{
  const f=await browserFixture();await button(f,'退出账号').click();
  assert.equal(f.box.redirect,'/login');assert.equal(await f.box.QibanPlatform.cache.read(A),null);assert.equal(await f.box.QibanPlatform.cache.last(),null);assert.equal(f.box.QibanCloud.storage.getItem(KEY),null);
  const logout=f.state.requests.find(r=>r.path==='/api/auth/logout');assert.equal(logout.options.headers['X-Qiban-Token'],'csrf-'+A);
});
test('native logout relies on the bridge cleanup and does not query a revoked account cache',async()=>{
  const f=await browserFixture({native:true});await button(f,'退出账号').click();assert.equal(f.box.redirect,'login.html');assert.equal(f.nativeState.logoutCalls,1);assert.equal(f.nativeState.deleteCalls,0);assert.equal(f.vault.has(A),false);assert.equal(f.vault.has('last'),false);
});
test('an account change hides the entire old account page, disables export, and keeps its draft',async()=>{
  const f=await browserFixture(),C=f.box.QibanCloud;f.state.offline=true;f.box.navigator.onLine=false;C.storage.setItem(KEY,JSON.stringify(workspace('原账号的草稿')));await C.persisted();
  f.state.accountId=B;f.state.offline=false;f.box.navigator.onLine=true;await f.listeners.get('online')();await C.flush();assert.equal(f.state.writes.length,0);assert.equal(C.getAccount(),null);assert.equal(C.isLocked(),true);assert.equal(C.storage.getItem(KEY),null);assert.equal(f.box.document.body.children.length,1);assert.equal(f.box.document.body.children[0].id,'cloud-session-locked');assert.equal(f.box.document.body.children[0].children.some(el=>/导出/.test(el.textContent)),false);await assert.rejects(C.backup(),e=>e.code==='ACCOUNT_CHANGED');await C.persisted();assert.equal(f.box.redirect,'/login');assert.equal((await f.box.QibanPlatform.cache.read(A)).workspace.projects[0].goal,'原账号的草稿');assert.equal(await f.box.QibanPlatform.cache.read(B),null);
});
test('edits made during an upload keep their local draft and use the acknowledged revision next',async()=>{
  const f=await browserFixture(),C=f.box.QibanCloud;let release,started;const wait=new Promise(resolve=>{release=resolve;}),begin=new Promise(resolve=>{started=resolve;});f.state.gate={wait,started};
  C.storage.setItem(KEY,JSON.stringify(workspace('上传中的第一版')));const upload=C.flush();await begin;
  C.storage.setItem(KEY,JSON.stringify(workspace('上传期间输入的第二版')));await C.persisted();release();await upload;
  const local=await f.box.QibanPlatform.cache.read(A);assert.equal(local.dirty,true);assert.equal(local.revision,4);assert.equal(local.workspace.projects[0].goal,'上传期间输入的第二版');
  await C.flush();assert.deepEqual(f.state.writes.map(write=>write.revision),[3,4]);assert.equal(f.state.workspace.projects[0].goal,'上传期间输入的第二版');
});

test('Web Locks reject a second editor tab before it can overwrite the first tab draft',async()=>{
  const indexedDB=new IDBFactory(),first=await browserFixture({indexedDB});first.box.navigator.onLine=false;
  first.box.QibanCloud.storage.setItem(KEY,JSON.stringify(workspace('第一个窗口未同步的草稿')));await first.box.QibanCloud.persisted();
  await assert.rejects(browserFixture({indexedDB}),/另一个窗口编辑/);
  assert.equal((await first.box.QibanPlatform.cache.read(A)).workspace.projects[0].goal,'第一个窗口未同步的草稿');
  first.close();const reopened=await browserFixture({indexedDB});assert.equal(JSON.parse(reopened.box.QibanCloud.storage.getItem(KEY)).projects[0].goal,'第一个窗口未同步的草稿');
});
test('native Keychain startup failures are initialization errors, not an offline fallback or empty export',async()=>{
  const state=serverState();state.startupError=Object.assign(Error('本机安全存储初始化失败（-34018）。'),{code:'NATIVE_KEYCHAIN_-34018'});
  const f=await browserFixture({state,native:true,expectFailure:true});assert.equal(f.failure.code,'NATIVE_KEYCHAIN_-34018');assert.equal(f.nativeState.cacheLastCalls,0);assert.equal(f.vault.size,0);
  const page=f.els.get('#cloud-startup-error');assert.ok(page);assert.match(page.children[1].textContent,/-34018/);assert.equal(page.children.some(child=>child.textContent==='导出未同步记录'),false);
  await page.children.find(child=>child.textContent==='重试初始化').click();assert.equal(f.box.reloaded,true);await page.children.find(child=>child.textContent==='回到登录').click();assert.equal(f.box.redirect,'login.html');
});
test('a native cache read failure preserves the unreadable draft and does not fetch or overwrite cloud records',async()=>{
  const state=serverState();state.cacheReadError=Object.assign(Error('本机缓存无法读取。'),{code:'NATIVE_STORAGE'});
  const original={revision:3,dirty:true,workspace:workspace('不可覆盖的原有草稿')},vault=new Map([[A,original]]);
  const f=await browserFixture({state,native:true,vault,expectFailure:true});assert.equal(f.failure.code,'NATIVE_STORAGE');assert.equal(f.vault.get(A),original);assert.equal(state.requests.length,1);assert.equal(state.writes.length,0);assert.ok(f.els.get('#cloud-startup-error'));
});


test('workspace identity changes during bootstrap cannot overwrite an unread original-account draft',async()=>{
  const state=serverState();state.workspaceAccountId=B;state.workspace=workspace('B 的内容不应进入 A 缓存');
  const original={revision:3,dirty:true,workspace:workspace('A 已保存的私人草稿')},vault=new Map([[A,original]]);
  const f=await browserFixture({state,native:true,vault,expectFailure:true});
  assert.equal(f.failure.code,'ACCOUNT_CHANGED');assert.equal(f.box.QibanCloud.isLocked(),true);assert.equal(f.vault.get(A),original);assert.equal(f.vault.has(B),false);assert.equal(f.vault.has('last'),false);assert.equal(f.box.QibanCloud.storage.getItem(KEY),null);assert.equal(f.box.document.body.children[0].id,'cloud-session-locked');
});
test('expired sessions hide cached records while preserving them for the original account login',async()=>{
  const f=await browserFixture(),C=f.box.QibanCloud;f.box.navigator.onLine=false;C.storage.setItem(KEY,JSON.stringify(workspace('会话过期前已保存的文字')));await C.persisted();
  f.state.accountStatus=401;f.box.navigator.onLine=true;await f.listeners.get('online')();await C.persisted();
  assert.equal(C.isLocked(),true);assert.equal(C.getForm('goal'),null);assert.equal(C.requireOnline(),false);assert.equal(C.storage.getItem(KEY),null);await assert.rejects(C.backup(),e=>e.code==='ACCOUNT_CHANGED');assert.equal((await f.box.QibanPlatform.cache.read(A)).workspace.projects[0].goal,'会话过期前已保存的文字');
});
test('a late upload response cannot restore account content or notices after the page locks',async()=>{
  const f=await browserFixture(),C=f.box.QibanCloud;let release,started;const wait=new Promise(resolve=>{release=resolve;}),begin=new Promise(resolve=>{started=resolve;});f.state.gate={wait,started};
  C.storage.setItem(KEY,JSON.stringify(workspace('正在上传的 A 草稿')));const upload=C.flush();await begin;
  f.state.accountId=B;await f.listeners.get('online')();release();await upload;await C.persisted();
  assert.equal(C.isLocked(),true);assert.equal(C.storage.getItem(KEY),null);assert.equal(f.box.document.body.children.length,1);assert.equal(f.box.document.body.children[0].id,'cloud-session-locked');assert.equal((await f.box.QibanPlatform.cache.read(A)).workspace.projects[0].goal,'正在上传的 A 草稿');assert.equal(await f.box.QibanPlatform.cache.read(B),null);
});
test('native logout account-change errors lock the page without deleting another account cache',async()=>{
  const state=serverState();state.logoutError=Object.assign(Error('账号已变化'),{code:'ACCOUNT_CHANGED'});
  const f=await browserFixture({state,native:true});await button(f,'退出账号').click();await f.box.QibanCloud.persisted();
  assert.equal(f.box.QibanCloud.isLocked(),true);assert.equal(f.nativeState.deleteCalls,0);assert.equal(f.vault.has(A),true);assert.equal(f.box.document.body.children[0].id,'cloud-session-locked');
});
