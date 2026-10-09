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
}
