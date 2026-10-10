const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const vm = require('node:vm');
const os = require('node:os');
const crypto = require('node:crypto');
const core = require('../native-core.cjs');

async function fixture({pause='logout',clock={now:Date.now()},storage,authAccountId}={}) {
  class FixtureDate extends Date {static now(){return clock.now;}}
  const handlers = new Map(), removed = [];
  const leaving = { token: 'fixture-leaving-not-real-' + '0'.repeat(40), accountId: '1'.repeat(32), username: 'fixture_leaving', expires: clock.now + 60000 };
  const entering = { token: 'fixture-entering-not-real-' + '0'.repeat(40), accountId: authAccountId || '2'.repeat(32), username: 'fixture_entering', expires: clock.now + 60000 };
  let saved = leaving, finishRequest, beginSetup;
  const records=new Map([['session.enc',leaving]]),backend=storage||{read:async name=>records.get(name)||null,write:async(name,value)=>{records.set(name,value);},remove:async name=>{records.delete(name);}};
  const requests = [];
  const ready = new Promise(resolve => { beginSetup = resolve; });
  class FixtureWindow {
    constructor() { this.webContents = { mainFrame: { url: 'app://qiban/index.html' }, setWindowOpenHandler() {}, on() {}, send() {} }; FixtureWindow.instance = this; }
    on() {} loadURL() { return Promise.resolve(); } isDestroyed() { return false; }
  }
  const electron = {
    app: { setAppUserModelId() {}, requestSingleInstanceLock() { return true; }, on() {}, whenReady() { return ready; }, getPath() { return '/isolated-memory-fixture'; }, isPackaged: false },
    BrowserWindow: FixtureWindow, Menu: { setApplicationMenu() {}, buildFromTemplate() {} },
    ipcMain: { handle(name, handler) { handlers.set(name, handler); } },
    protocol: { registerSchemesAsPrivileged() {}, handle() {} },
    session: { defaultSession: { setPermissionRequestHandler() {}, setPermissionCheckHandler() {}, on() {} } },
    safeStorage: { isEncryptionAvailable() { return true; } },
    net: { fetch(url) {
      requests.push(url);
      const data = url.includes('/auth/login') ? entering : url.endsWith('/auth/logout') ? {ok:true} : {accountId:leaving.accountId, workspace:{fixture:'leaving-only'}};
      const response = () => ({status:200,headers:new Map(),text:async()=>JSON.stringify(data)});
      if ((pause === 'logout' && url.endsWith('/auth/logout')) || (pause === 'request' && url.endsWith('/workspace'))) return new Promise(resolve => { finishRequest = () => resolve(response()); });
      return Promise.resolve(response());
    } }, shell: {}, dialog: { showErrorBox() {} }, powerMonitor: { on() {} }
  };
  const mockCore = { ...core, encryptedStore() { return {
    read: async name => {const value=await backend.read(name);if(name==='session.enc')saved=value;return value;},
    write: async (name, value) => {await backend.write(name,value);if(name==='session.enc')saved=value;},
    remove: async name => {removed.push(name);await backend.remove(name);if(name==='session.enc')saved=null;}
  }; } };
  const source = await fs.readFile(path.join(__dirname, '../main.cjs'), 'utf8');
  const mockFs = { ...fs, readFile: async () => JSON.stringify({ files: ['index.html', 'login.html'] }) };
  vm.runInNewContext(source, {
    require: name => name === 'electron' ? electron : name === './native-core.cjs' ? mockCore : name === 'node:fs/promises' ? mockFs : require(name),
    __dirname: path.resolve(__dirname, '..'), process: { argv: ['fixture'], platform: 'win32' }, console, URL, Buffer, Response, AbortSignal, Date:FixtureDate
  });
  beginSetup();
  for (let n = 0; n < 30 && !FixtureWindow.instance; n++) await new Promise(resolve => setImmediate(resolve));
  assert.ok(FixtureWindow.instance, 'fixture window did not initialize');
  const webContents = FixtureWindow.instance.webContents, event = { sender: webContents, senderFrame: webContents.mainFrame };
  return {handlers,event,leaving,entering,requests,removed,clock,get saved(){return saved;},get finish(){return finishRequest;},
    invoke:(name,input)=>handlers.get('qiban:'+name)(event,input),
    async waitPaused(){for(let n=0;n<30&&!finishRequest;n++)await new Promise(resolve=>setImmediate(resolve));assert.ok(finishRequest,'fixture response did not pause');},
    login:()=>handlers.get('qiban:auth')(event,{kind:'login',username:'fixture_entering',password:'fixture-password-only'})};
}
function preserved(f){assert.deepEqual(core.publicMeta(f.saved),core.publicMeta(f.entering));assert.equal(f.removed.includes('draft-'+f.entering.accountId+'.enc'),false);assert.equal(f.removed.includes('session.enc'),false);}

test('a delayed previous logout cannot remove the newer account session or draft',async()=>{
  const f=await fixture(),pending=f.invoke('logout',{expectedAccountId:f.leaving.accountId});await f.waitPaused();await f.login();f.finish();
  assert.equal((await pending).code,'ACCOUNT_CHANGED');preserved(f);
});
test('a stale page cannot revoke a newer account when it initiates logout after login',async()=>{
  const f=await fixture();await f.login();const before=f.requests.length;
  assert.equal((await f.invoke('logout',{expectedAccountId:f.leaving.accountId})).code,'ACCOUNT_CHANGED');assert.equal(f.requests.length,before);preserved(f);
});
test('a stale page cannot start a private request for a newer account',async()=>{
  const f=await fixture();await f.login();const before=f.requests.length;
  const result=await f.invoke('request',{path:'/api/workspace',method:'GET',expectedAccountId:f.leaving.accountId});assert.equal(result.status,409);assert.equal(result.data.code,'ACCOUNT_CHANGED');assert.equal(f.requests.length,before);preserved(f);
});
test('a private response is withheld when another account logs in while it is in flight',async()=>{
  const f=await fixture({pause:'request'}),pending=f.invoke('request',{path:'/api/workspace',method:'GET',expectedAccountId:f.leaving.accountId});await f.waitPaused();await f.login();f.finish();
  const result=await pending;assert.equal(result.status,409);assert.equal(result.data.code,'ACCOUNT_CHANGED');assert.equal(result.data.workspace,undefined);preserved(f);
});


test('an expired loaded account saves its final encrypted draft and restores it only after same-account login',async()=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'qiban-expired-draft-fixture-')),key=crypto.randomBytes(32),clock={now:Date.now()},accountId='1'.repeat(32);
  // Independent cipher fixture exercises real file persistence, without any operating-system identity or user storage.
  const crypt={};
  crypt.encryptString=raw=>{const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',key,iv),bytes=Buffer.concat([cipher.update(raw,'utf8'),cipher.final()]);return Buffer.concat([iv,cipher.getAuthTag(),bytes]);};
  crypt.decryptString=raw=>{const decipher=crypto.createDecipheriv('aes-256-gcm',key,raw.subarray(0,12));decipher.setAuthTag(raw.subarray(12,28));return Buffer.concat([decipher.update(raw.subarray(28)),decipher.final()]).toString('utf8');};
  const storage=core.encryptedStore(dir,crypt),initial={token:'fixture-loaded-not-real-'+ '0'.repeat(40),accountId,username:'fixture_leaving',expires:clock.now+60000};
  const record={revision:3,workspace:{schema:2,projects:[{id:'p1',goal:'会话过期后新输入的中文草稿'}]},values:{},dirty:true,forms:{goal:{text:'最后输入还需要恢复'}},updatedAt:clock.now};
  try{
    await storage.write('session.enc',initial);const loaded=await fixture({pause:null,clock,storage});clock.now+=60001;
    assert.equal((await loaded.invoke('cacheWrite',{accountId,record})).ok,true);
    const response=await loaded.invoke('request',{path:'/api/workspace',method:'POST',expectedAccountId:accountId,body:{revision:3,workspace:record.workspace}});
    assert.equal(response.status,401);assert.equal(loaded.requests.length,0,'expired network requests must not send a Bearer token');
    const final={...record,forms:{goal:{text:'401锁屏前最后落盘的内容'}},updatedAt:clock.now};
    assert.equal((await loaded.invoke('cacheWrite',{accountId,record:final})).ok,true,'401 lock snapshot still belongs to the loaded account');
    await assert.rejects(loaded.invoke('cacheWrite',{accountId:'2'.repeat(32),record:final}),/其他账号/);
    const bytes=await fs.readFile(path.join(dir,'draft-'+accountId+'.enc'));assert.equal(bytes.includes(Buffer.from(final.forms.goal.text)),false);
    const restarted=await fixture({pause:null,clock,storage,authAccountId:accountId});assert.equal(await restarted.invoke('cacheLast'),null);assert.equal(await storage.read('session.enc'),null);
    await assert.rejects(restarted.invoke('cacheRead',{accountId}),/重新登录/);await assert.rejects(restarted.invoke('cacheWrite',{accountId,record:final}),/重新登录/);
    assert.deepEqual(await storage.read('draft-'+accountId+'.enc'),final,'restart must keep the encrypted original account draft');
    await restarted.login();assert.deepEqual(await restarted.invoke('cacheRead',{accountId}),final);assert.equal((await restarted.invoke('cacheLast')).accountId,accountId);
    await assert.rejects(restarted.invoke('cacheRead',{accountId:'2'.repeat(32)}),/其他账号/);
    assert.equal((await restarted.invoke('logout',{expectedAccountId:accountId})).ok,true);
    await assert.rejects(restarted.invoke('cacheWrite',{accountId,record:final}),/重新登录/);assert.equal(await storage.read('draft-'+accountId+'.enc'),null);
  }finally{await fs.rm(dir,{recursive:true,force:true});}
});
