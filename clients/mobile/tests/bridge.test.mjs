import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {build} from 'esbuild';

const source = await readFile(new URL('../bootstrap.js', import.meta.url), 'utf8');
const bundle = await build({
  stdin: {contents: source, sourcefile: 'bootstrap.js', resolveDir: process.cwd()},
  bundle: true, write: false, format: 'iife', platform: 'browser',
  plugins: [{name: 'capacitor-test-adapter', setup(builder) {
    builder.onResolve({filter: /^@capacitor\/core$/}, () => ({path: 'core', namespace: 'test'}));
    builder.onLoad({filter: /.*/, namespace: 'test'}, () => ({contents: `
      export const Capacitor={isNativePlatform:()=>globalThis.testNative,getPlatform:()=>globalThis.testPlatform};
      export const registerPlugin=name=>{globalThis.pluginName=name;return globalThis.plugin;};
    `, loader: 'js'}));
  }}]
});
function run(native = true, {platform='android', document} = {}) {
  const calls = [], events = [], listeners = new Map();
  const plugin = new Proxy({}, {get(_object, name) {
    if (name === 'addListener') return (event, callback) => {listeners.set(event, callback); return Promise.resolve({remove() {}});};
    return async options => {
      calls.push([name, options]);
      if (name === 'auth') return {accountId: '1'.repeat(32), username: 'test-only', expires: 1234, token: 'test-only-hidden-by-native'};
      if (name === 'cacheLast') return {record: null};
      if (name === 'cacheRead') return {record: {revision: 2, dirty: true}};
      return {ok: true};
    };
  }});
  const window = {document,innerWidth:390,innerHeight:844,dispatchEvent: event => events.push(event)};
  const context = {window, plugin, testNative: native, testPlatform:platform, CustomEvent: class {constructor(type, init) {this.type = type; this.detail = init?.detail;}}};
  vm.runInNewContext(bundle.outputFiles[0].text, context);
  return {context, bridge: window.QibanNative, calls, events, listeners};
}
test('native bridge exposes account metadata and forwards only the explicit methods', async () => {
  const {context, bridge, calls} = run();
  assert.equal(context.pluginName, 'QibanNative');
  assert.equal(bridge.platform, 'android');
  assert.equal(Object.isFrozen(bridge), true);
  const account = await bridge.auth({kind: 'login', username: 'test-only', password: 'test-only-long-password'});
  assert.deepEqual({...account}, {accountId: '1'.repeat(32), username: 'test-only', expires: 1234});
  assert.equal('token' in account, false);
  await bridge.request({path: '/api/workspace', method: 'GET'});
  assert.deepEqual(calls[1], ['request', {path: '/api/workspace', method: 'GET'}]);
  assert.equal(bridge.getToken, undefined);
});
test('native cache envelopes become the shared object or null contract', async () => {
  const {bridge} = run();
  assert.equal(await bridge.cacheLast(), null);
  assert.deepEqual(await bridge.cacheRead({accountId: '1'.repeat(32)}), {revision: 2, dirty: true});
});
test('private requests and logout preserve the expected account guard passed by the shared platform',async()=>{
  const {bridge,calls}=run(),accountId='a'.repeat(32),options={path:'/api/workspace',method:'POST',expectedAccountId:accountId,body:{revision:1}};
  await bridge.request(options);await bridge.logout({expectedAccountId:accountId});assert.deepEqual(calls[0],['request',options]);assert.deepEqual(calls[1],['logout',{expectedAccountId:accountId}]);
});
test('mobile back and lifecycle events reach shared UI; ordinary web loads have no native bridge', () => {
  const {listeners, events} = run();
  listeners.get('back')({}); listeners.get('lifecycle')({active: false});
  assert.equal(events[0].type, 'qiban:back');
  assert.equal(events[1].type, 'qiban:lifecycle');
  assert.deepEqual(events[1].detail, {active: false});
  assert.equal(run(false).bridge, undefined);
});
test('iOS startup hook identifies the anonymous form using geometry, never credential values',()=>{
  const rectangle={left:24,top:120,width:300,height:44},field={value:'fixture-secret-must-not-be-exported',getBoundingClientRect:()=>rectangle};
  const nodes={'#auth':{},'#username':field,'#password':{...field,type:'password'},'#submit':field,'#error':{textContent:''}};
  const document={readyState:'complete',querySelector:selector=>nodes[selector]||null};
  const {calls}=run(true,{platform:'ios',document});const options=calls.find(([method])=>method==='startupCheck')[1];
  assert.equal(options.page,'login');assert.equal(options.metrics.width,390);assert.equal(options.metrics.password.height,44);assert.doesNotMatch(JSON.stringify(options),/fixture-secret/);
  const main=run(true,{platform:'ios',document:{readyState:'complete',querySelector:()=>null}});assert.equal(main.calls.length,0);
});
