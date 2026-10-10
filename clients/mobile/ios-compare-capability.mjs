/* One CI-only diagnostic comparison. Neither result replaces the original project smoke result. */
import {execFile} from 'node:child_process';
import {promisify, isDeepStrictEqual} from 'node:util';
import {cp, mkdir, open, readdir, readFile, realpath, stat, writeFile} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {boundedUtf8, validateReadiness} from './ios-smoke.mjs';

const executeFile = promisify(execFile), bundleId = 'io.github.ciki9876.qiban.dev';
const here = path.dirname(fileURLToPath(import.meta.url));
async function command(binary, args, timeout = 20000, maxBuffer = 65536) {
  const result = await executeFile(binary, args, {timeout, maxBuffer}); return result.stdout.trim();
}
export function assertComparisonContext(a, startup, env = process.env) {
  const udid = a?.device?.udid, startedAt = Date.parse(a?.checkedAt), age = Date.now() - startedAt;
  if (env.GITHUB_ACTIONS !== 'true' || env.RUNNER_ENVIRONMENT !== 'github-hosted' ||
      !/^[a-f0-9]{40}$/.test(env.GITHUB_SHA || '') || a?.sourceCommit !== env.GITHUB_SHA ||
      !/^\d+$/.test(env.GITHUB_RUN_ID || '') || a?.ciRunId !== env.GITHUB_RUN_ID || a?.ciRunAttempt !== env.GITHUB_RUN_ATTEMPT ||
      a?.bundleId !== bundleId || a?.platform !== 'iOS Simulator' || a?.signing !== 'simulator-adhoc' ||
      a?.result !== 'failed' || a?.stage !== 'launch_app' || !/^[A-Fa-f0-9-]{36}$/.test(udid || '') ||
      startup?.freshHostedSimulator !== true || !Number.isFinite(startedAt) || age < 0 || age > 45 * 60 * 1000 ||
      !startup.commands?.some(c => c.result === 'success' && c.command === 'xcrun' && c.args?.[0] === 'simctl' && c.args?.[1] === 'boot' && c.args?.[2] === udid))
    throw Error('Comparison requires this fresh hosted job, its original failed launch, and its newly booted Qiban Simulator.');
  return {udid, startedAt};
}
export function assertInstalledBundle(app, udid, info) {
  if (!path.isAbsolute(app) || !app.includes('/CoreSimulator/Devices/' + udid + '/data/Containers/Bundle/Application/') ||
      path.basename(app) !== 'App.app' || info.CFBundleIdentifier !== bundleId || info.CFBundleExecutable !== 'App' ||
      JSON.stringify(info.CFBundleSupportedPlatforms) !== '["iPhoneSimulator"]') throw Error('Installed bundle does not match this own Simulator application.');
}
export function assertSourcePaths(workspace, original, output) {
  if (original !== path.join(workspace,'artifacts/ios/DerivedData/Build/Products/Debug-iphonesimulator/App.app') ||
      output !== path.join(workspace,'artifacts/ios')) throw Error('Comparison requires this workflow original Simulator product and original evidence directory.');
}
function jsonString(text, key) {
  const value = text.match(new RegExp('"' + key + '"\\s*:\\s*("(?:\\\\.|[^"\\\\])*")'));
  return value ? JSON.parse(value[1]) : undefined;
}
function jsonObject(text, key) {
  const match = new RegExp('"' + key + '"\\s*:\\s*\\{').exec(text); if (!match) return {};
  const start = match.index + match[0].length - 1; let depth = 0, quoted = false, escaped = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i]; if (escaped) {escaped = false; continue;}
    if (quoted && c === '\\') {escaped = true; continue;} if (c === '"') {quoted = !quoted; continue;}
    if (!quoted) {if (c === '{') depth++; if (c === '}' && --depth === 0) {try {return JSON.parse(text.slice(start, i + 1));} catch {return {};}}}
  }
  return {};
}
export function crashMetadata(header, body, installedApp, udid) {
  if (header.bundleID !== bundleId) return null;
  const beforeThreads = body.split('"threads"')[0], procPath = jsonString(beforeThreads, 'procPath');
  if (procPath !== path.join(installedApp, 'App') || !procPath.includes('/Devices/' + udid + '/')) return null;
  const select = (value, keys) => Object.fromEntries(keys.filter(k => typeof value[k] === 'number' || typeof value[k] === 'string').map(k => [k, typeof value[k] === 'string' ? boundedUtf8(value[k], 256) : value[k]]));
  return {bundleId, binaryName:path.basename(procPath), arch:jsonString(beforeThreads, 'cpuType') || null,
    exception:select(jsonObject(beforeThreads, 'exception'), ['type','signal','codes']),
    termination:select(jsonObject(beforeThreads, 'termination'), ['namespace','code','indicator'])};
}
export async function ownCrashMetadata(directory, installedApp, udid, startedAt) {
  const result = [];
  for (const entry of (await readdir(directory, {withFileTypes:true}).catch(() => [])).filter(x => x.isFile() && /^App[-_].*\.ips$/.test(x.name)).slice(0, 20)) {
    const file = path.join(directory, entry.name), attributes = await stat(file);
    if (attributes.mtimeMs < startedAt) continue;
    const handle = await open(file, 'r');
    try {
      // Validate only the first header before reading a bounded metadata prefix of this own report.
      const headerBytes = [], byte = Buffer.alloc(1);
      for (let i = 0; i < 8192; i++) {if (!(await handle.read(byte, 0, 1, null)).bytesRead || byte[0] === 10) break; headerBytes.push(byte[0]);}
      let header; try {header = JSON.parse(Buffer.from(headerBytes).toString('utf8'));} catch {continue;} if (header.bundleID !== bundleId) continue;
      const prefix = Buffer.alloc(32768), read = await handle.read(prefix, 0, prefix.length, null);
      const metadata = crashMetadata(header, prefix.subarray(0, read.bytesRead).toString('utf8'), installedApp, udid);
      if (metadata) result.push(metadata);
    } finally {await handle.close();}
  }
  return result;
}
export function removeLegacyArmv7(info) {
  const next = structuredClone(info);
  if (!Array.isArray(next.UIRequiredDeviceCapabilities) || !next.UIRequiredDeviceCapabilities.includes('armv7')) throw Error('The original Simulator bundle has no legacy armv7 array entry to compare.');
  next.UIRequiredDeviceCapabilities = next.UIRequiredDeviceCapabilities.filter(x => x !== 'armv7');
  if (!next.UIRequiredDeviceCapabilities.length) delete next.UIRequiredDeviceCapabilities;
  return next;
}
async function main() {
  const originalApp = path.resolve(process.argv[2]), output = path.resolve(process.argv[3] || 'artifacts/ios');
  // Refuse local execution before looking at any Simulator path or account-bearing filesystem.
  if (process.env.GITHUB_ACTIONS !== 'true' || process.env.RUNNER_ENVIRONMENT !== 'github-hosted') throw Error('Capability comparison is only available on a fresh GitHub-hosted runner.');
  const workspace = await realpath(process.env.GITHUB_WORKSPACE), original = await realpath(originalApp), outputPath = await realpath(output);
  assertSourcePaths(workspace, original, outputPath);
  const a = JSON.parse(await readFile(path.join(output, 'result.json'), 'utf8'));
  const startup = JSON.parse(await readFile(path.join(output, 'startup.json'), 'utf8'));
  const context = assertComparisonContext(a, startup);
  const area = path.join(output, 'capability-comparison'), bOutput = path.join(area, 'B'); await mkdir(bOutput, {recursive:true});
  const report = {schema:1, diagnosticOnly:true, sourceCommit:process.env.GITHUB_SHA, originalProjectVerified:false, rootCause:'undetermined', A:a, B:{result:'not_run'}};
  let comparisonBooted = false, bStarted = false;
  try {
    // A shut down this own device; lookup requires a booted runtime on some Simulator versions.
    await command('xcrun', ['simctl','boot',context.udid]); comparisonBooted = true;
    await command('xcrun', ['simctl','bootstatus',context.udid,'-b'],120000);
    const installed = await realpath((await command('xcrun', ['simctl','get_app_container',context.udid,bundleId,'app'])).trim());
    const info = JSON.parse(await command('/usr/bin/plutil', ['-convert','json','-o','-',path.join(installed, 'Info.plist')]));
    assertInstalledBundle(installed, context.udid, info);
    const executable = await stat(path.join(installed, info.CFBundleExecutable));
    let signatureStatus = 'verified'; try {await command('/usr/bin/codesign', ['--verify','--deep','--strict',installed]);} catch {signatureStatus = 'rejected-or-unavailable';}
    report.installedA = {...Object.fromEntries(['CFBundleIdentifier','CFBundleExecutable','CFBundleSupportedPlatforms','MinimumOSVersion','UIRequiredDeviceCapabilities','DTPlatformName','DTSDKName'].map(key => [key, info[key] ?? null])), executableMode:(executable.mode & 0o777).toString(8), signatureStatus};
    try {
      const layout = await command('xcrun', ['otool','-l',path.join(installed,'App')]);
      report.installedA.buildVersions = [...layout.matchAll(/cmd LC_BUILD_VERSION\s+cmdsize \d+\s+platform (\d+)\s+minos ([\d.]+)\s+sdk ([\d.]+)/g)].map(match => ({platform:Number(match[1]),minimumOS:match[2],sdk:match[3]}));
    } catch {report.installedA.buildVersionStatus = 'unavailable';}
    const deviceRoot = installed.slice(0, installed.indexOf('/data/Containers/'));
    report.ownCrashMetadata = [];
    for (const directory of [path.join(deviceRoot,'data/Library/Logs/CrashReporter'), path.join(os.homedir(),'Library/Logs/DiagnosticReports')]) report.ownCrashMetadata.push(...await ownCrashMetadata(directory, installed, context.udid, context.startedAt));
    const originalInfo = JSON.parse(await command('/usr/bin/plutil', ['-convert','json','-o','-',path.join(original,'Info.plist')]));
    if (originalInfo.CFBundleIdentifier !== bundleId || JSON.stringify(originalInfo.CFBundleSupportedPlatforms) !== '["iPhoneSimulator"]') throw Error('Original comparison source must be the own Simulator bundle.');
    const adjusted = removeLegacyArmv7(originalInfo), candidate = path.join(area, 'bundle-B', 'App.app');
    await cp(original, candidate, {recursive:true, force:false, errorOnExist:true});
    const index = originalInfo.UIRequiredDeviceCapabilities.indexOf('armv7');
    if (adjusted.UIRequiredDeviceCapabilities) await command('/usr/libexec/PlistBuddy', ['-c','Delete :UIRequiredDeviceCapabilities:' + index,path.join(candidate,'Info.plist')]);
    else await command('/usr/libexec/PlistBuddy', ['-c','Delete :UIRequiredDeviceCapabilities',path.join(candidate,'Info.plist')]);
    const actual = JSON.parse(await command('/usr/bin/plutil', ['-convert','json','-o','-',path.join(candidate,'Info.plist')]));
    if (!isDeepStrictEqual(actual, adjusted)) throw Error('Capability clone changed fields beyond the one legacy entry.');
    await command(process.execPath, [path.join(here,'sign-ios-simulator.mjs'),candidate,path.join(bOutput,'signing.json')],120000);
    await command('/usr/bin/ditto', ['-c','-k','--keepParent',candidate,path.join(area,'Qiban-capability-B-diagnostic-only.zip')],120000);
    report.B.capabilities = actual.UIRequiredDeviceCapabilities ?? null;
    // Uninstall only the own test bundle; leave the device Shutdown for B to boot and guard itself.
    await command('xcrun', ['simctl','uninstall',context.udid,bundleId]);
    await command('xcrun', ['simctl','shutdown',context.udid]); comparisonBooted = false;
    bStarted = true;
    try {await command(process.execPath, [path.join(here,'ios-smoke.mjs'),candidate,bOutput,context.udid],720000,128*1024);} catch {}
    report.B = {...report.B, ...JSON.parse(await readFile(path.join(bOutput,'result.json'),'utf8')), diagnosticOnly:true};
    if (report.B.result === 'started') {
      const readiness = JSON.parse(await readFile(path.join(bOutput,'readiness.json'),'utf8'));
      validateReadiness(readiness, Date.parse(report.B.checkedAt));
      report.B.verifiedStartup = report.B.checks?.anonymousLoginPage === true && report.B.checks?.keychainWriteReadDelete === true && report.B.checks?.encryptedDraftWriteRead === true;
    } else report.B.verifiedStartup = false;
  } catch (error) {report.comparisonError = error.message;}
  finally {
    // Includes a child timeout: this is still only the device this fresh job created and verified.
    if (comparisonBooted || bStarted) await command('xcrun',['simctl','shutdown',context.udid]).catch(()=>{});
    await writeFile(path.join(area,'comparison.json'),JSON.stringify(report,null,2)+'\n');
    console.log('QIBAN_CAPABILITY_COMPARISON_DIAGNOSTIC_ONLY\n'+boundedUtf8(JSON.stringify(report,null,2),16384));
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
