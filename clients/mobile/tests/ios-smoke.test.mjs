import test from 'node:test';
import assert from 'node:assert/strict';
import {selectIPhone, launchPID} from '../ios-smoke.mjs';

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
