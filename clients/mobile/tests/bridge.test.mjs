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
      export const Capacitor={isNativePlatform:()=>globalThis.testNative,getPlatform:()=>"android"};
      export const registerPlugin=name=>{globalThis.pluginName=name;return globalThis.plugin;};
    `, loader: 'js'}));
  }}]
});
function run(native = true) {
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
  const window = {dispatchEvent: event => events.push(event)};
  const context = {window, plugin, testNative: native, CustomEvent: class {constructor(type, init) {this.type = type; this.detail = init?.detail;}}};
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
test('mobile back and lifecycle events reach shared UI; ordinary web loads have no native bridge', () => {
  const {listeners, events} = run();
  listeners.get('back')({}); listeners.get('lifecycle')({active: false});
  assert.equal(events[0].type, 'qiban:back');
  assert.equal(events[1].type, 'qiban:lifecycle');
  assert.deepEqual(events[1].detail, {active: false});
  assert.equal(run(false).bridge, undefined);
});
