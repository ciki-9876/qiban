import {spawnSync} from 'node:child_process';
import {lstat, mkdir, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const bundleIdentifier = 'io.github.ciki9876.qiban.dev';
function run(command, args) {
  return spawnSync(command, args, {encoding:'utf8', timeout:60000, maxBuffer:256 * 1024, stdio:['ignore','pipe','pipe']});
}
function checked(command, args, execute) {
  const result = execute(command, args);
  if (result?.error || result?.status !== 0) throw Error('Simulator bundle inspection failed: ' + path.basename(command) + ' (status ' + (result?.status ?? 'unavailable') + ').');
  return result;
}
function field(metadata, name) {
  const rows = metadata.split(/\r?\n/).filter(line => line.startsWith(name + '='));
  if (rows.length !== 1) throw Error('Simulator signature metadata is missing or ambiguous: ' + name + '.');
  return rows[0].slice(name.length + 1);
}

// Inspect only the specified bundle. No re-signing, identities, accounts, or Keychain APIs.
export async function verifySimulatorBundle(app, execute = run) {
  app = path.resolve(app);
  try {
    await lstat(path.join(app, 'embedded.mobileprovision'));
    throw Error('A provisioning-profile bundle must not use the Simulator-only verification path.');
  } catch (error) {if (error.code !== 'ENOENT') throw error;}
  const plist = path.join(app, 'Info.plist');
  const platforms = JSON.parse(checked('/usr/bin/plutil', ['-extract', 'CFBundleSupportedPlatforms', 'json', '-o', '-', plist], execute).stdout);
  const identifier = checked('/usr/bin/plutil', ['-extract', 'CFBundleIdentifier', 'raw', '-o', '-', plist], execute).stdout.trim();
  if (!Array.isArray(platforms) || platforms.length !== 1 || platforms[0] !== 'iPhoneSimulator' || identifier !== bundleIdentifier) throw Error('Only the fixed Qiban iPhoneSimulator bundle may use this verifier.');
  const description = checked('/usr/bin/codesign', ['-dvvv', app], execute);
  const metadata = description.stdout + '\n' + description.stderr;
  if (field(metadata, 'Identifier') !== bundleIdentifier || field(metadata, 'Signature') !== 'adhoc' || field(metadata, 'TeamIdentifier') !== 'not set') throw Error('The Simulator test bundle must have its own ad-hoc signature with no signing team.');
  checked('/usr/bin/codesign', ['--verify', '--deep', '--strict', app], execute);
  return {
    schema:1, mode:'xcode-simulator-adhoc', bundleIdentifier, supportedPlatforms:platforms,
    signature:'adhoc', teamIdentifier:null, provisioningProfilePresent:false,
    strictDeepVerification:true, appleIdentityUsed:false, installableOnIPhone:false,
    verification:'bundle_signature_only', checkedAt:new Date().toISOString()
  };
}

async function main() {
  if (process.platform !== 'darwin') throw Error('Simulator signature inspection requires macOS codesign.');
  const app = path.resolve(process.argv[2] || 'artifacts/ios/DerivedData/Build/Products/Debug-iphonesimulator/App.app');
  const report = path.resolve(process.argv[3] || 'artifacts/ios/signing.json');
  const result = await verifySimulatorBundle(app);
  await mkdir(path.dirname(report), {recursive:true});
  await writeFile(report, JSON.stringify(result, null, 2) + '\n');
  console.log('Standard Xcode Simulator ad-hoc bundle verified without modifying its signature.');
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
