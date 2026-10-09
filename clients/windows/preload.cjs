const { contextBridge, ipcRenderer } = require('electron');
const invoke = name => input => ipcRenderer.invoke(`qiban:${name}`, input);
contextBridge.exposeInMainWorld('QibanNative', Object.freeze({
  auth: invoke('auth'), request: invoke('request'), logout: invoke('logout'),
  cacheRead: invoke('cacheRead'), cacheWrite: invoke('cacheWrite'), cacheDelete: invoke('cacheDelete'),
  cacheLast: invoke('cacheLast'), cacheRemember: invoke('cacheRemember'), cacheForget: invoke('cacheForget'),
  saveFile: invoke('saveFile'), openExternal: invoke('openExternal'),
  platform: 'windows'
}));
ipcRenderer.on('qiban:lifecycle', (_event, state) => {
  window.dispatchEvent(new CustomEvent('qiban:lifecycle', { detail: state }));
});
