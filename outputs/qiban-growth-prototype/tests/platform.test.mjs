import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {IDBFactory} from 'fake-indexeddb';

const platform=await readFile(new URL('../platform.js',import.meta.url),'utf8');
const worker=await readFile(new URL('../service-worker.js',import.meta.url),'utf8');
const A='a'.repeat(32),B='b'.repeat(32),copy=value=>JSON.parse(JSON.stringify(value));
function fixture({indexedDB=new IDBFactory(),native,navigator={},meta=null,fetcher}={}){
  const requests=[],listeners=new Map(),documentListeners=new Map();
  const element=()=>({append(){},click(){},remove(){}});
  const box={indexedDB,document:{readyState:'complete',documentElement:{classList:{add(){}}},querySelector:()=>meta,body:element(),createElement:element,addEventListener:(type,fn)=>documentListeners.set(type,fn)},navigator,location:{href:'https://qiban.example/',origin:'https://qiban.example',replace(url){box.redirect=url;}},Blob,URL,File,AbortSignal,Map,btoa,CustomEvent:class{constructor(type){this.type=type;}},setTimeout(){},console,fetch:async(path,options)=>{requests.push({path,options});return fetcher?fetcher(path,options):{status:200,headers:{get:()=>A},json:async()=>({ok:true})};},...(native?{QibanNative:native}:{})};
  box.window=box;box.addEventListener=(type,fn)=>listeners.set(type,fn);box.dispatchEvent=event=>listeners.get(event.type)?.(event);vm.runInNewContext(platform,box);return {box,P:box.QibanPlatform,requests,listeners,documentListeners,indexedDB};
}
test('IndexedDB drafts are isolated by account and last-account metadata contains no credentials',async()=>{
  const f=fixture(),alice={revision:1,workspace:{goal:'Alice 私人草稿'},dirty:true},bob={revision:2,workspace:{goal:'Bob 私人草稿'},dirty:false};
  await f.P.cache.write(A,alice);await f.P.cache.write(B,bob);assert.deepEqual(copy(await f.P.cache.read(A)),alice);assert.deepEqual(copy(await f.P.cache.read(B)),bob);
  await f.P.cache.remember({accountId:B,username:'bob',expires:Date.now()+10000,csrf:'synthetic-csrf',token:'synthetic-token',password:'synthetic-password',apiKey:'synthetic-ai-key'});
  const last=copy(await f.P.cache.last());assert.deepEqual(Object.keys(last).sort(),['accountId','expires','username']);assert.equal(last.accountId,B);
  await f.P.cache.delete(A);assert.equal(await f.P.cache.read(A),null);assert.deepEqual(copy(await f.P.cache.read(B)),bob);await f.P.cache.forget();assert.equal(await f.P.cache.last(),null);
  assert.throws(()=>f.P.cache.write('../private',{}),/账号标识/);
});
test('a new page instance can restore persisted IndexedDB records without browser localStorage',async()=>{
  const indexedDB=new IDBFactory(),first=fixture({indexedDB});await first.P.cache.write(A,{workspace:{goal:'关闭之后的中文草稿'},forms:{goal:{text:'继续之前的话'}},dirty:true});
  const second=fixture({indexedDB});assert.equal((await second.P.cache.read(A)).workspace.goal,'关闭之后的中文草稿');assert.equal((await second.P.cache.read(A)).forms.goal.text,'继续之前的话');
});
test('web POST uses same-origin cookies and the current account CSRF while native uses only its bridge',async()=>{
  const f=fixture({meta:{content:'page-csrf'}});f.P.setAccount({accountId:A,csrf:'account-csrf'});const body={revision:3,workspace:{goal:'fixture'}};await f.P.request('/api/workspace',{method:'POST',body});
  assert.equal(f.requests[0].options.credentials,'same-origin');assert.equal(f.requests[0].options.headers['X-Qiban-Token'],'account-csrf');assert.equal(f.requests[0].options.headers.Authorization,undefined);assert.deepEqual(JSON.parse(f.requests[0].options.body),body);
  const calls=[];const native=fixture({native:{request:async input=>{calls.push(copy(input));return {status:200,data:{revision:4}};}}});native.P.setAccount({accountId:A,csrf:'never-use-this-in-native'});const result=await native.P.request('/api/workspace',{method:'POST',body});
  assert.deepEqual(calls,[{path:'/api/workspace',method:'POST',body,expectedAccountId:A}]);assert.equal(native.requests.length,0);assert.equal(result.status,200);assert.equal(await native.P.claimAccount(A),true);
});
test('missing Web Locks fails closed and a lock manager refuses another editor for the same account',async()=>{
  assert.equal(await fixture().P.claimAccount(A),false);
  const held=new Set(),locks={request:async(name,options,callback)=>{assert.equal(options.ifAvailable,true);if(held.has(name))return callback(null);held.add(name);return callback({name});}};
  const first=fixture({navigator:{locks}}),second=fixture({navigator:{locks}});assert.equal(await first.P.claimAccount(A),true);assert.equal(await second.P.claimAccount(A),false);assert.equal(await second.P.claimAccount(B),true);
});
test('native canceled saves never acknowledge export success and successful saves preserve bytes',async()=>{
  for(const cancellation of [{ok:false},{canceled:true}]){
    const f=fixture({native:{saveFile:async()=>cancellation}});await assert.rejects(f.P.saveBlob(new Blob(['中文草稿'],{type:'text/plain'}),'草稿.txt'),/取消|未完成|保存/);
  }
  let exported;const f=fixture({native:{saveFile:async input=>{exported=input;return {ok:true};}}});await f.P.saveBlob(new Blob(['中文草稿'],{type:'text/plain'}),'草稿.txt',{share:false});assert.equal(Buffer.from(exported.base64,'base64').toString('utf8'),'中文草稿');assert.equal(exported.name,'草稿.txt');assert.equal(exported.share,false);
});
function workerFixture(){
  const events=new Map(),cacheCalls=[],networkCalls=[],cache={async addAll(paths){cacheCalls.push({kind:'addAll',paths:[...paths]});},async match(path){cacheCalls.push({kind:'match',path});return {publicShell:path==='\/app-shell.html',path};}};
  const state={offline:false};
  const box={self:{location:{origin:'https://qiban.example'},addEventListener:(type,fn)=>events.set(type,fn)},URL,Set,Promise,caches:{async open(name){cacheCalls.push({kind:'open',name});return cache;},async keys(){return ['qiban-static-older','qiban-static-0.9.0-beta.1','unrelated-app-cache'];},async delete(name){cacheCalls.push({kind:'delete',name});}},fetch:async request=>{networkCalls.push(request.url);if(state.offline)throw TypeError('fixture disconnected');return {privateHome:true,url:request.url};}};
  vm.runInNewContext(worker,box);
  const fetchEvent=async(path,{method='GET',mode='cors'}={})=>{let response;events.get('fetch')({request:{url:path.startsWith('https:')?path:'https://qiban.example'+path,method,mode},respondWith(value){response=value;}});return response?await response:null;};
  return {events,cacheCalls,networkCalls,state,fetchEvent};
}
test('service worker precaches only the public shell and assets, and never handles private API responses',async()=>{
  const f=workerFixture();let task;f.events.get('install')({waitUntil(value){task=value;}});await task;
  const assets=f.cacheCalls.find(call=>call.kind==='addAll').paths;assert.ok(assets.includes('/app-shell.html'));assert.ok(assets.includes('/platform.js'));assert.ok(assets.every(path=>!path.startsWith('/api/')&&!['/','/index.html','/login'].includes(path)));
  const before=f.cacheCalls.length;
  for(const path of ['/api/account','/api/workspace','/api/ai/config','/api/native/account','/app.js?private=1','/login','/cloud-server.mjs','https://other.example/app.js'])assert.equal(await f.fetchEvent(path),null);
  assert.equal(await f.fetchEvent('/app.js',{method:'POST'}),null);assert.equal(f.cacheCalls.length,before);assert.equal(f.networkCalls.length,0);
});
test('service worker keeps authenticated navigation on the network and offline fallback has no cached private page',async()=>{
  const f=workerFixture();const online=await f.fetchEvent('/',{mode:'navigate'});assert.equal(online.privateHome,true);assert.equal(f.cacheCalls.length,0);
  f.state.offline=true;const offline=await f.fetchEvent('/',{mode:'navigate'});assert.equal(offline.publicShell,true);assert.equal(offline.path,'/app-shell.html');assert.ok(f.cacheCalls.every(call=>!['put','add','addAll'].includes(call.kind)));
});
test('service worker activation removes its old static cache while preserving unrelated applications',async()=>{
  const f=workerFixture();let task;f.events.get('activate')({waitUntil(value){task=value;}});await task;assert.deepEqual(f.cacheCalls.filter(call=>call.kind==='delete').map(call=>call.name),['qiban-static-older','qiban-static-0.9.0-beta.1']);
});

test('a cookie change cannot expose another account response body to the bound page',async()=>{
  let decoded=0,locked=0;
  const f=fixture({fetcher:async()=>({status:200,headers:{get:()=>B},json:async()=>{decoded++;return {workspace:{goal:'Bob private fixture'}};}})});
  f.P.setAccount({accountId:A});f.box.addEventListener('qiban:account-changed',()=>locked++);
  for(const path of ['/api/workspace','/api/ai/config','/api/ai/artifacts/read']){
    const response=await f.P.request(path);assert.equal(response.status,409);assert.equal(response.data.code,'ACCOUNT_CHANGED');assert.equal(response.data.workspace,undefined);
  }
  assert.equal(decoded,0,'a foreign private JSON body must never be parsed');assert.equal(locked,3,'a changed private response must immediately lock the workspace');
  const account=await f.P.request('/api/account');assert.equal(account.status,200);assert.equal(decoded,1,'account metadata remains available to detect the changed identity');
});
test('a delayed native response is dropped after the page account changes and logout passes its bound identity',async()=>{
  let finish,leaving;
  const f=fixture({native:{request:async input=>{assert.equal(input.expectedAccountId,A);return new Promise(resolve=>{finish=resolve;});},logout:async input=>{leaving=copy(input);return {ok:true};}}});
  f.P.setAccount({accountId:A});const pending=f.P.request('/api/workspace');
  f.P.setAccount({accountId:B});finish({status:200,data:{workspace:{goal:'Alice old fixture'}}});
  assert.equal((await pending).data.code,'ACCOUNT_CHANGED');
  await f.P.logout();assert.deepEqual(leaving,{expectedAccountId:B});
});

test('logout account mismatch stays an error and preserves its identity code',async()=>{
  const web=fixture({fetcher:async()=>({status:403,headers:{get:()=>B},json:async()=>{throw Error('foreign logout body should not be read');}})});web.P.setAccount({accountId:A});
  await assert.rejects(web.P.logout(),error=>error.code==='ACCOUNT_CHANGED'&&error.status===409);
  const native=fixture({native:{logout:async()=>({ok:false,code:'ACCOUNT_CHANGED',message:'fixture account changed'})}});native.P.setAccount({accountId:A});
  await assert.rejects(native.P.logout(),error=>error.code==='ACCOUNT_CHANGED');
});

test('Web system sharing carries the exported file and cancellation remains a failed save',async()=>{
  let received;const f=fixture({navigator:{canShare:({files})=>files.length===1,share:async data=>{received=data;}}});
  const blob=new Blob(['中文历程'],{type:'application/json'});
  assert.equal((await f.P.saveBlob(blob,'历程.json',{share:true})).ok,true);
  assert.equal(received.files[0].name,'历程.json');assert.equal(await received.files[0].text(),'中文历程');
  f.box.navigator.share=async()=>{const error=Error('fixture user canceled');error.name='AbortError';throw error;};
  await assert.rejects(f.P.saveBlob(blob,'历程.json',{share:true}),error=>error.name==='AbortError');
});
