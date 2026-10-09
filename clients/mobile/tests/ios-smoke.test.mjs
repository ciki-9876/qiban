import test from 'node:test';
import assert from 'node:assert/strict';
import {selectIPhone, launchPID, validateReadiness} from '../ios-smoke.mjs';
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
