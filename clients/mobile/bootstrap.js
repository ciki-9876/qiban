import {Capacitor, registerPlugin} from '@capacitor/core';

const native = registerPlugin('QibanNative');
const methods = ['auth', 'request', 'logout', 'cacheRead', 'cacheWrite', 'cacheDelete', 'cacheLast', 'cacheRemember', 'cacheForget', 'saveFile', 'openExternal'];
if (Capacitor.isNativePlatform()) {
  const bridge = Object.fromEntries(methods.map(name => [name, async options => {
    const result = await native[name](options || {});
    if (name === 'auth') return {accountId: result.accountId, username: result.username, expires: result.expires};
    return ['cacheRead', 'cacheLast'].includes(name) ? (result.record ?? null) : result;
  }]));
  bridge.platform = Capacitor.getPlatform();
  window.QibanNative = Object.freeze(bridge);
  native.addListener('back', () => window.dispatchEvent(new CustomEvent('qiban:back')));
  native.addListener('lifecycle', detail => window.dispatchEvent(new CustomEvent('qiban:lifecycle', {detail})));
  if (Capacitor.getPlatform() === 'ios') {
    const checkLogin = () => {
      const document = window.document;
      const form = document.querySelector('#auth'), username = document.querySelector('#username'), password = document.querySelector('#password'), submit = document.querySelector('#submit');
      if (!form || !username || !password || !submit || password.type !== 'password') return;
      const rectangle = element => {const r = element.getBoundingClientRect(); return {left:r.left,top:r.top,width:r.width,height:r.height};};
      native.startupCheck({page:'login',metrics:{width:window.innerWidth,height:window.innerHeight,username:rectangle(username),password:rectangle(password),submit:rectangle(submit)}}).catch(error => {
        if (error.code?.startsWith('NATIVE_')) document.querySelector('#error').textContent = '本机安全存储初始化失败（' + error.code + '），请先重开应用。';
      });
    };
    if (window.document.readyState === 'loading') window.document.addEventListener('DOMContentLoaded', checkLogin, {once:true}); else checkLogin();
  }
}
