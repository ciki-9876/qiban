const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const vm = require('node:vm');
const core = require('../native-core.cjs');

async function fixture({pause='logout'}={}) {
  const handlers = new Map(), removed = [];
  const leaving = { token: 'fixture-leaving-not-real-' + '0'.repeat(40), accountId: '1'.repeat(32), username: 'fixture_leaving', expires: Date.now() + 60000 };
  const entering = { token: 'fixture-entering-not-real-' + '0'.repeat(40), accountId: '2'.repeat(32), username: 'fixture_entering', expires: Date.now() + 60000 };
  let saved = leaving, finishRequest, beginSetup;
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
    read: async () => saved,
    write: async (_name, value) => { saved = value; },
    remove: async name => { removed.push(name); if (name === 'session.enc') saved = null; }
  }; } };
  const source = await fs.readFile(path.join(__dirname, '../main.cjs'), 'utf8');
  const mockFs = { ...fs, readFile: async () => JSON.stringify({ files: ['index.html', 'login.html'] }) };
  vm.runInNewContext(source, {
    require: name => name === 'electron' ? electron : name === './native-core.cjs' ? mockCore : name === 'node:fs/promises' ? mockFs : require(name),
    __dirname: path.resolve(__dirname, '..'), process: { argv: ['fixture'], platform: 'win32' }, console, URL, Buffer, Response, AbortSignal
  });
  beginSetup();
  for (let n = 0; n < 30 && !FixtureWindow.instance; n++) await new Promise(resolve => setImmediate(resolve));
  assert.ok(FixtureWindow.instance, 'fixture window did not initialize');
  const webContents = FixtureWindow.instance.webContents, event = { sender: webContents, senderFrame: webContents.mainFrame };
  return {handlers,event,leaving,entering,requests,removed,get saved(){return saved;},get finish(){return finishRequest;},
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
