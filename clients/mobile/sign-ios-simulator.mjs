import {spawnSync} from 'node:child_process';
import {access, readdir, mkdir, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const simulatorAppId = 'QIBANSIMUL.io.github.ciki9876.qiban.dev';
export function assertSimulatorInfo(platforms, identifier) {
  if (!Array.isArray(platforms) || platforms.length !== 1 || platforms[0] !== 'iPhoneSimulator' || identifier !== 'io.github.ciki9876.qiban.dev') throw Error('Only the Qiban iPhoneSimulator bundle may receive this local test signature.');
}
function run(command, args, input) {
  const result = spawnSync(command, args, {input, encoding: 'utf8', timeout: 120000, maxBuffer: 4 * 1024 * 1024});
  if (result.error || result.status !== 0) throw Error(command + ' failed: ' + (result.error?.message || result.stderr.trim()));
  return result.stdout.trim();
}
export async function signSimulatorBundle(app, platforms, identifier, execute = run) {
  assertSimulatorInfo(platforms, identifier);
  try {await access(path.join(app, 'embedded.mobileprovision')); throw Error('A provisioning-profile bundle must not use the Simulator test signature.');} catch (error) {if (error.code !== 'ENOENT') throw error;}
  const frameworks = path.join(app, 'Frameworks');
  for (const name of await readdir(frameworks).catch(error => {if (error.code === 'ENOENT') return []; throw error;})) {
    if (name.endsWith('.framework') || name.endsWith('.dylib')) execute('/usr/bin/codesign', ['--force', '--sign', '-', '--timestamp=none', path.join(frameworks, name)]);
  }
  // Xcode's Debug layout puts executable code beside the main binary as well as in Frameworks.
  for (const name of ['App.debug.dylib', '__preview.dylib']) {
    const library = path.join(app, name);
    try {await access(library);} catch (error) {if (error.code === 'ENOENT') continue; throw error;}
    execute('/usr/bin/codesign', ['--force', '--sign', '-', '--timestamp=none', library]);
  }
  const entitlements = fileURLToPath(new URL('./simulator.entitlements.plist', import.meta.url));
  execute('/usr/bin/codesign', ['--force', '--sign', '-', '--timestamp=none', '--identifier', identifier, '--entitlements', entitlements, app]);
  execute('/usr/bin/codesign', ['--verify', '--deep', '--strict', app]);
}
async function main() {
  if (process.platform !== 'darwin') throw Error('Simulator signing requires macOS codesign.');
  const app = path.resolve(process.argv[2]), report = path.resolve(process.argv[3] || 'artifacts/ios/signing.json');
  const plist = path.join(app, 'Info.plist');
  const platforms = JSON.parse(run('/usr/bin/plutil', ['-extract', 'CFBundleSupportedPlatforms', 'json', '-o', '-', plist]));
  const identifier = run('/usr/bin/plutil', ['-extract', 'CFBundleIdentifier', 'raw', '-o', '-', plist]);
  await signSimulatorBundle(app, platforms, identifier);
  const signed = run('/usr/bin/codesign', ['-d', '--entitlements', ':-', app]);
  const appId = run('/usr/bin/plutil', ['-extract', 'application-identifier', 'raw', '-o', '-', '-'], signed);
  const groups = JSON.parse(run('/usr/bin/plutil', ['-extract', 'keychain-access-groups', 'json', '-o', '-', '-'], signed));
  if (appId !== simulatorAppId || groups.length !== 1 || groups[0] !== simulatorAppId) throw Error('The sealed Simulator bundle lacks its private test Keychain entitlement.');
  await mkdir(path.dirname(report), {recursive: true});
  await writeFile(report, JSON.stringify({mode: 'simulator-adhoc', bundleIdentifier: identifier, applicationIdentifier: appId, keychainAccessGroups: groups, appleIdentityUsed: false, installableOnIPhone: false}, null, 2) + '\n');
  console.log('Simulator-only ad-hoc bundle and Keychain entitlements verified. No Apple identity or provisioning profile used.');
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
