import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, rm, writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {verifySimulatorBundle} from '../verify-ios-simulator.mjs';

const identifier = 'io.github.ciki9876.qiban.dev';
async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'qiban-ios-verify-'));
  t.after(() => rm(root, {recursive:true, force:true}));
  const app = path.join(root, 'App.app'); await mkdir(app);
  return app;
}
function inspector({platforms=['iPhoneSimulator'], id=identifier, signature='adhoc', team='not set', verifyStatus=0} = {}) {
  const calls = [];
  const execute = (command, args) => {
    calls.push({command, args});
    if (command === '/usr/bin/plutil') return {status:0, stdout:args[1] === 'CFBundleSupportedPlatforms' ? JSON.stringify(platforms) : id, stderr:''};
    if (args[0] === '-dvvv') return {status:0, stdout:'', stderr:`Identifier=${id}\nSignature=${signature}\nTeamIdentifier=${team}\n`};
    return {status:verifyStatus, stdout:'', stderr:''};
  };
  return {calls, execute};
}

test('accepts the locally signed Simulator fixture using inspection commands only', async t => {
  const app = await fixture(t), {execute, calls} = inspector();
  const report = await verifySimulatorBundle(app, execute);
  assert.equal(report.mode, 'xcode-simulator-adhoc');
  assert.equal(report.strictDeepVerification, true);
  assert.equal(report.appleIdentityUsed, false);
  assert.equal(report.installableOnIPhone, false);
  assert.deepEqual(calls.filter(call => call.command === '/usr/bin/codesign').map(call => call.args), [
    ['-dvvv', app], ['--verify', '--deep', '--strict', app]
  ]);
  assert.ok(calls.every(call => !call.args.includes('--sign') && !call.args.includes('--force')));
});

test('rejects device, wrong-identifier, and provisioning-profile products before signature inspection', async t => {
  const app = await fixture(t);
  for (const options of [{platforms:['iPhoneOS']}, {id:'io.example.other'}, {platforms:['iPhoneSimulator','iPhoneOS']}]) {
    const {execute, calls} = inspector(options);
    await assert.rejects(verifySimulatorBundle(app, execute), /fixed Qiban iPhoneSimulator/);
    assert.equal(calls.some(call => call.command === '/usr/bin/codesign'), false);
  }
  await writeFile(path.join(app, 'embedded.mobileprovision'), 'synthetic fixture, never read');
  const {execute, calls} = inspector();
  await assert.rejects(verifySimulatorBundle(app, execute), /provisioning-profile/);
  assert.equal(calls.length, 0);
});

test('rejects certificate/team signatures and failed strict validation', async t => {
  const app = await fixture(t);
  for (const options of [{signature:'certificate'}, {team:'SYNTHETIC_TEAM'}]) {
    const {execute, calls} = inspector(options);
    await assert.rejects(verifySimulatorBundle(app, execute), /ad-hoc signature/);
    assert.equal(calls.some(call => call.args.includes('--verify')), false);
  }
  const {execute} = inspector({verifyStatus:1});
  await assert.rejects(verifySimulatorBundle(app, execute), /codesign \(status 1\)/);
});
