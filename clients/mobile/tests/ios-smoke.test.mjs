import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {selectIPhone, launchPID, validateReadiness, installDiagnosticArgs, launchDiagnosticArgs, collectInstallDiagnostics, collectLaunchDiagnostics, timedRunner} from '../ios-smoke.mjs';
import {assertSimulatorInfo} from '../sign-ios-simulator.mjs';

const device = (name, extra = {}) => ({name, udid: '12345678-1234-1234-1234-123456789ABC', state: 'Shutdown', isAvailable: true, ...extra});
test('simulator selection uses an existing available iPhone from the newest numeric iOS runtime', () => {
  const selected = selectIPhone({devices: {
    'com.apple.CoreSimulator.SimRuntime.iOS-26-2': [device('iPhone 16')],
    'com.apple.CoreSimulator.SimRuntime.iOS-26-10': [device('iPhone 17'), device('iPad Pro'), device('iPhone unavailable', {isAvailable: false})],
    'com.apple.CoreSimulator.SimRuntime.tvOS-26-10': [device('iPhone pretend')]
  }});
  assert.equal(selected.name, 'iPhone 17'); assert.equal(selected.runtime, 'com.apple.CoreSimulator.SimRuntime.iOS-26-10');
  assert.throws(() => selectIPhone({devices: {'com.apple.CoreSimulator.SimRuntime.iOS-26-2': [device('iPad Pro')]}}), /no available iPhone simulator/);
});
test('simulator launch requires the actual Qiban bundle process response', () => {
  assert.equal(launchPID('io.github.ciki9876.qiban.dev: 12345\n'), 12345);
  for (const response of ['other.application: 12345', 'io.github.ciki9876.qiban.dev: 0', 'The app did not launch.']) assert.throws(() => launchPID(response));
});
test('only a Simulator bundle can receive the local test Keychain namespace',()=>{
  assertSimulatorInfo(['iPhoneSimulator'],'io.github.ciki9876.qiban.dev');
  assert.throws(()=>assertSimulatorInfo(['iPhoneOS'],'io.github.ciki9876.qiban.dev'));
  assert.throws(()=>assertSimulatorInfo(['iPhoneSimulator'],'other.bundle'));
});
test('startup readiness needs fresh native storage checks and visible anonymous form controls',()=>{
  const rectangle={left:24,top:100,width:300,height:44};
  const proof={schema:1,page:'login',ready:true,anonymous:true,checkedAt:1234,checks:{keychainWriteReadDelete:true,encryptedDraftWriteRead:true},metrics:{width:390,height:844,username:{...rectangle},password:{...rectangle,top:180},submit:{...rectangle,top:300}}};
  assert.equal(validateReadiness(proof,1200),proof);
  for(const value of [{...proof,checkedAt:1100},{...proof,checks:{}},{...proof,anonymous:false},{...proof,metrics:{...proof.metrics,password:{...rectangle,height:0}}},{...proof,metrics:{...proof.metrics,submit:{...rectangle,top:900}}}])assert.throws(()=>validateReadiness(value,1200));
  assert.throws(()=>validateReadiness({ready:false,errorCode:'NATIVE_KEYCHAIN_-34018'},1200),/-34018/);
});
test('installation diagnostics can only inspect the Simulator booted by this fresh hosted job',()=>{
  const hosted={GITHUB_ACTIONS:'true',RUNNER_ENVIRONMENT:'github-hosted'};
  const args=installDiagnosticArgs(device('iPhone 17'),true,1234567,hosted);
  assert.equal(args[2],device('iPhone 17').udid);
  assert.deepEqual(args.slice(3,8),['/usr/bin/log','show','--start','@1234','--style']);
  assert.match(args.at(-1),/process == "installd" OR process == "lsd"/);
  assert.match(args.at(-1),/messageType == 16 OR messageType == 17/);
  for(const env of [{},{GITHUB_ACTIONS:'true',RUNNER_ENVIRONMENT:'self-hosted'}])assert.equal(installDiagnosticArgs(device('iPhone 17'),true,1234567,env),null);
  assert.equal(installDiagnosticArgs(device('iPhone 17'),false,1234567,hosted),null);
  assert.equal(installDiagnosticArgs(device('iPhone 17'),true,undefined,hosted),null);
});
test('installation diagnostic capture has a 20s command limit, a 4MiB artifact limit, and preserves failure',async()=>{
  const output=await mkdtemp(path.join(os.tmpdir(),'qiban-sim-diagnostics-'));
  try{
    const result=await collectInstallDiagnostics({device:device('iPhone 17'),bootedByUs:true,bootStartedAt:1234567,output,env:{GITHUB_ACTIONS:'true',RUNNER_ENVIRONMENT:'github-hosted'}},async(command,args,file,timeout)=>{
      assert.equal(command,'xcrun');assert.equal(timeout,20000);
      await writeFile(file,Buffer.alloc(4*1024*1024+100,120));throw Error('Diagnostic command timed out.');
    });
    assert.equal(result.file,'install-diagnostics.log');assert.equal(result.error,'Diagnostic command timed out.');
    assert.equal((await readFile(path.join(output,result.file))).length,4*1024*1024);
    assert.equal(await collectInstallDiagnostics({device:device('iPhone 17'),bootedByUs:true,bootStartedAt:1234567,output,env:{}},()=>{throw Error('Local log collection must never run.');}),null);
  }finally{await rm(output,{recursive:true,force:true});}
});
test('launch failure diagnostics are scoped to this fresh hosted Simulator and system launch errors',async()=>{
  const env={GITHUB_ACTIONS:'true',RUNNER_ENVIRONMENT:'github-hosted'};
  const args=launchDiagnosticArgs(device('iPhone 17'),true,1234567,env);
  for(const name of ['lsd','SpringBoard','FrontBoard'])assert.ok(args.at(-1).includes(name));
  assert.match(args.at(-1),/messageType == 16 OR messageType == 17/);
  assert.equal(launchDiagnosticArgs(device('iPhone 17'),false,1234567,env),null);
  assert.equal(launchDiagnosticArgs(device('iPhone 17'),true,1234567,{}),null);
  const output=await mkdtemp(path.join(os.tmpdir(),'qiban-launch-diagnostics-'));
  try{
    const proof=await collectLaunchDiagnostics({device:device('iPhone 17'),bootedByUs:true,bootStartedAt:1234567,output,env},async(command,actual,file,timeout)=>{
      assert.equal(command,'xcrun');assert.deepEqual(actual,args);assert.equal(timeout,20000);await writeFile(file,'Fixture-only simulator system failure.');
    });
    assert.equal(proof.file,'launch-diagnostics.log');assert.match(await readFile(path.join(output,proof.file),'utf8'),/Fixture-only/);
  }finally{await rm(output,{recursive:true,force:true});}
});
test('command timing records successful and failed steps without copying child output',async()=>{
  const commands=[];
  const execute=timedRunner(commands,async(command)=>{if(command==='fail')throw Error('Fixture failure.');return 'fixture-output-must-not-be-recorded';});
  assert.equal(await execute('ok',['argument'],'fixture.log',240000),'fixture-output-must-not-be-recorded');
  await assert.rejects(execute('fail',[],'fixture.log',20000),/Fixture failure/);
  assert.equal(commands[0].result,'success');assert.equal(commands[0].timeoutMs,240000);
  assert.equal(commands[1].result,'failed');assert.equal(commands[1].error,'Fixture failure.');
  for(const command of commands){assert.ok(Number.isFinite(Date.parse(command.startedAt)));assert.ok(Number.isFinite(Date.parse(command.completedAt)));assert.ok(command.elapsedMs>=0);assert.equal('output' in command,false);}
});
