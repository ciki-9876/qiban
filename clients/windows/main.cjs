const { app, BrowserWindow, Menu, ipcMain, protocol, session, safeStorage, net, shell, dialog, powerMonitor } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const core = require('./native-core.cjs');
protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: false, stream: true } }]);
app.setAppUserModelId('io.github.ciki9876.qiban.dev');
let window, store, authSession, loggedOutAccount;
let cacheQueue = Promise.resolve();
const inQueue = fn => { const task = cacheQueue.then(fn); cacheQueue = task.catch(() => {}); return task; };
const smoke = process.argv.includes('--smoke');
if (smoke) {
  const isolatedPath = process.argv.find(value => value.startsWith('--user-data-dir='))?.slice('--user-data-dir='.length);
  if (!isolatedPath || !path.isAbsolute(isolatedPath)) throw Error('Smoke tests require an isolated absolute user-data directory.');
  app.setPath('userData', isolatedPath);
}
if (!app.requestSingleInstanceLock()) app.exit(0);
app.on('second-instance', () => { if (window) { if (window.isMinimized()) window.restore(); window.focus(); } });
const CSP = "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; font-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; frame-src 'none'; form-action 'none'";
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
function currentAccount(input) {
  if (!authSession || authSession.expires <= Date.now()) throw Error('请重新登录栖伴。');
  const id = core.accountId(input?.accountId);
  if (id !== authSession.accountId) throw Error('不能访问其他账号的本机草稿。');
  return id;
}
async function cloudRequest(url, method, body, token, timeout = 70000) {
  const headers = { 'Accept': 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const result = await net.fetch(url, { method, headers, body, redirect: 'error', credentials: 'omit', signal: AbortSignal.timeout(timeout) });
  if (Number(result.headers.get('content-length')) > core.MAX_BYTES * 2) throw Error('服务返回内容过大。');
  const text = await result.text();
  if (Buffer.byteLength(text) > core.MAX_BYTES * 2) throw Error('服务返回内容过大。');
  let data; try { data = JSON.parse(text); } catch { throw Error('服务返回内容无效。'); }
  return { status: result.status, data };
}
function registerBridge(name, handler) {
  ipcMain.handle(`qiban:${name}`, async (event, input) => {
    if (!window || event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame || !event.senderFrame.url.startsWith('app://qiban/')) throw Error('不允许访问应用接口。');
    return handler(input);
  });
}
async function setup() {
  const webRoot = app.isPackaged ? path.join(process.resourcesPath, 'web') : path.resolve(__dirname, '../../dist/windows');
  const manifest = JSON.parse(await fs.readFile(path.join(webRoot, 'client-files.json'), 'utf8'));
  const allowed = new Set(manifest.files);
  protocol.handle('app', async request => {
    const name = core.packagedPath(request.url, allowed);
    if (!name || request.method !== 'GET') return new Response('Not found', { status: 404 });
    const data = await fs.readFile(path.join(webRoot, name));
    return new Response(data, { headers: { 'Content-Type': types[path.extname(name)] || 'application/octet-stream', 'Content-Security-Policy': CSP, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store' } });
  });
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  session.defaultSession.setPermissionCheckHandler(() => false);
  session.defaultSession.on('will-download', event => event.preventDefault());
  let encryptionAvailable = typeof safeStorage.isAsyncEncryptionAvailable === 'function' ? await safeStorage.isAsyncEncryptionAvailable() : safeStorage.isEncryptionAvailable();
  if (process.platform === 'linux' && safeStorage.getSelectedStorageBackend?.() === 'basic_text') encryptionAvailable = false;
  // Refuse plaintext fallback. OS account encryption remains mandatory, including tests.
  if (!encryptionAvailable) throw Error('系统加密存储不可用，无法安全保存登录和草稿。');
  const crypt = {
    encryptString: value => typeof safeStorage.encryptStringAsync === 'function' ? safeStorage.encryptStringAsync(value) : safeStorage.encryptString(value),
    decryptString: value => typeof safeStorage.decryptStringAsync === 'function' ? safeStorage.decryptStringAsync(value) : safeStorage.decryptString(value)
  };
  if (smoke) {
    const probe = 'qiban-isolated-encryption-fixture';
    if (core.decryptedText(await crypt.decryptString(await crypt.encryptString(probe))) !== probe) throw Error('System encryption roundtrip failed.');
  }
  store = core.encryptedStore(path.join(app.getPath('userData'), 'private-v1'), crypt);
  authSession = await store.read('session.enc');
  if (authSession && (!authSession.token || authSession.expires <= Date.now())) { authSession = null; await store.remove('session.enc'); }
  registerBridge('auth', async input => {
    if (!['login', 'register'].includes(input?.kind) || typeof input.username !== 'string' || typeof input.password !== 'string' || input.username.length > 32 || input.password.length > 128) throw Error('账号或密码格式无效。');
    const result = await cloudRequest(`${core.ORIGIN}/api/native/auth/${input.kind}`, 'POST', JSON.stringify({ username: input.username, password: input.password }), undefined, 15000);
    if (result.status < 200 || result.status >= 300) throw Error(result.data.message || '登录失败。');
    const data = result.data;
    if (typeof data.token !== 'string' || !/^[A-Za-z0-9_-]{32,256}$/.test(data.token) || !Number.isFinite(data.expires) || typeof data.username !== 'string') throw Error('登录会话无效。');
    core.accountId(data.accountId);
    const nextSession = { token: data.token, accountId: data.accountId, username: data.username, expires: data.expires };
    await inQueue(async () => {
      await store.write('session.enc', nextSession);
      authSession = nextSession;
      loggedOutAccount = null;
    });
    return core.publicMeta(nextSession);
  });
  registerBridge('request', async input => {
    const publicHealth = input?.path === '/api/health' && input.method === 'GET' && input.body === undefined;
    const request = publicHealth ? { url: `${core.ORIGIN}/api/native/health`, method: 'GET' } : core.nativePath(input);
    const changed = () => ({ status: 409, data: { code: 'ACCOUNT_CHANGED', message: '账号会话已变化，请重新登录原账号。' } });
    if (publicHealth) return cloudRequest(request.url, request.method, undefined, undefined, 15000);
    const requesting = authSession;
    if (!requesting || requesting.expires <= Date.now()) return { status: 401, data: { message: '请重新登录栖伴。' } };
    if (input.path !== '/api/account' && input.expectedAccountId !== requesting.accountId) return changed();
    const timeout = /^\/api\/ai\/(?:test|plan|feedback|assist|stage|replace)$/.test(input.path) ? 70000 : 15000;
    const result = await cloudRequest(request.url, request.method, request.body, requesting.token, timeout);
    if (authSession?.token !== requesting.token) return changed();
    return result;
  });
  registerBridge('logout', async input => {
    const changed = () => ({ ok: false, code: 'ACCOUNT_CHANGED', message: '账号会话已变化，请重新登录原账号。' });
    const leaving = authSession;
    if (!leaving || input?.expectedAccountId !== leaving.accountId) return changed();
    const result = await cloudRequest(`${core.ORIGIN}/api/native/auth/logout`, 'POST', '{}', leaving.token, 15000);
    if (![200, 204, 401].includes(result.status)) throw Error(result.data.message || '退出失败，请稍后重试。');
    return inQueue(async () => {
      // An older logout response must not delete a session or draft established by a newer login.
      if (authSession?.token !== leaving.token) return changed();
      const id = core.accountId(leaving.accountId);
      await store.remove(`draft-${id}.enc`);
      await store.remove('session.enc');
      loggedOutAccount = id;
      authSession = null;
      return { ok: true };
    });
  });
  registerBridge('cacheRead', input => { const id = currentAccount(input); return inQueue(() => store.read(`draft-${id}.enc`)); });
  registerBridge('cacheWrite', input => { const id = currentAccount(input), record = core.draftRecord(input.record); return inQueue(async () => { await store.write(`draft-${id}.enc`, record); return { ok: true }; }); });
  registerBridge('cacheDelete', input => { const id = !authSession && input?.accountId === loggedOutAccount ? core.accountId(input.accountId) : currentAccount(input); return inQueue(async () => { await store.remove(`draft-${id}.enc`); return { ok: true }; }); });
  registerBridge('cacheLast', () => authSession?.expires > Date.now() ? core.publicMeta(authSession) : null);
  registerBridge('cacheRemember', input => { currentAccount(input); return core.publicMeta(authSession); });
  registerBridge('cacheForget', () => inQueue(async () => { authSession = null; loggedOutAccount = null; await store.remove('session.enc'); return { ok: true }; }));
  registerBridge('saveFile', async input => {
    const bytes = core.fileBytes(input);
    const result = await dialog.showSaveDialog(window, { title: '保存栖伴文件', defaultPath: core.safeName(input.name) });
    if (result.canceled || !result.filePath) return { ok: false, canceled: true };
    await fs.writeFile(result.filePath, bytes);
    return { ok: true, saved: true };
  });
  registerBridge('openExternal', async input => { await shell.openExternal(core.externalUrl(input?.url)); return { ok: true }; });
  window = new BrowserWindow({ width: 1200, height: 850, minWidth: 360, minHeight: 480, show: !smoke, title: '栖伴测试版', backgroundColor: '#fafaf7', webPreferences: { preload: path.join(__dirname, 'preload.cjs'), sandbox: true, contextIsolation: true, nodeIntegration: false, webSecurity: true, allowRunningInsecureContent: false, spellcheck: false } });
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: '栖伴', submenu: [{ label: '关闭窗口', role: 'close' }] },
    { label: '编辑', submenu: [{ label: '撤销', role: 'undo' }, { label: '重做', role: 'redo' }, { type: 'separator' }, { label: '剪切', role: 'cut' }, { label: '复制', role: 'copy' }, { label: '粘贴', role: 'paste' }, { label: '全选', role: 'selectAll' }] },
    { label: '显示', submenu: [{ label: '实际大小', role: 'resetZoom' }, { label: '放大', role: 'zoomIn' }, { label: '缩小', role: 'zoomOut' }, { type: 'separator' }, { label: '全屏', role: 'togglefullscreen' }] }
  ]));
  window.webContents.setWindowOpenHandler(({ url }) => { try { shell.openExternal(core.externalUrl(url)); } catch {} return { action: 'deny' }; });
  window.webContents.on('will-navigate', (event, url) => { if (!core.packagedPath(url, allowed)) { event.preventDefault(); try { shell.openExternal(core.externalUrl(url)); } catch {} } });
  window.webContents.on('will-attach-webview', event => event.preventDefault());
  window.webContents.on('will-prevent-unload', event => {
    const choice = dialog.showMessageBoxSync(window, { type: 'warning', buttons: ['继续编辑', '离开页面'], defaultId: 0, cancelId: 0, message: '还有未同步或未保存的内容。', detail: '若界面提示本机保存异常，请先导出草稿再关闭。' });
    if (choice === 1) event.preventDefault();
  });
  const emit = state => { if (!window?.isDestroyed()) window.webContents.send('qiban:lifecycle', { active: state === 'active' }); };
  window.on('focus', () => emit('active'));
  window.on('blur', () => emit('inactive'));
  powerMonitor.on('resume', () => emit('active'));
  powerMonitor.on('suspend', () => emit('inactive'));
  if (smoke) {
    window.webContents.on('did-finish-load', async () => {
      const result = await window.webContents.executeJavaScript("({title:document.title,native:typeof window.QibanNative?.request==='function',node:typeof process!=='undefined',form:!!document.querySelector('#auth')})");
      if (!result.native || result.node || !result.form) { console.error('Windows renderer smoke failed.'); app.exit(1); }
      else { console.log('Windows renderer smoke passed: bundled login, sandbox, native bridge and system encryption.'); app.exit(0); }
    });
  }
  await window.loadURL(`app://qiban/${smoke || !authSession ? 'login' : ''}`);
}
app.whenReady().then(setup).catch(error => { console.error(error.message); if (!smoke) dialog.showErrorBox('栖伴无法启动', error.message); app.exit(1); });
app.on('window-all-closed', () => app.quit());
