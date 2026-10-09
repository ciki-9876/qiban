import {spawn} from 'node:child_process';
import {access, mkdir, appendFile, writeFile, readFile, rm} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const bundleId = 'io.github.ciki9876.qiban.dev';
export function selectIPhone(list) {
  const devices = Object.entries(list.devices || {}).flatMap(([runtime, rows]) =>
    /\.SimRuntime\.iOS-\d/.test(runtime) && Array.isArray(rows)
      ? rows.filter(device => device.isAvailable === true && /^iPhone\b/.test(device.name) && /^[A-Fa-f0-9-]{36}$/.test(device.udid)).map(device => ({...device, runtime})) : []);
  const version = runtime => runtime.match(/iOS-([\d-]+)/)[1].split('-').map(Number);
  devices.sort((a, b) => {
    const av = version(a.runtime), bv = version(b.runtime);
    for (let i = 0; i < Math.max(av.length, bv.length); i++) {const difference = (bv[i] || 0) - (av[i] || 0); if (difference) return difference;}
    return Number(b.state === 'Booted') - Number(a.state === 'Booted') || a.name.localeCompare(b.name);
  });
  if (!devices.length) throw Error('The existing runner has no available iPhone simulator. No runtime was downloaded or license accepted.');
  return devices[0];
}

export function launchPID(output) {
  const match = output.trim().match(new RegExp('^' + bundleId.replaceAll('.', '\\.') + ': (\\d+)$', 'm'));
  if (!match || Number(match[1]) <= 0) throw Error('simctl did not report a valid application process.');
  return Number(match[1]);
}
export function validateReadiness(record, launchedAt) {
  if (record.ready === false) throw Error('Native startup check failed: ' + (record.errorCode || 'UNKNOWN'));
  if (record.schema !== 1 || record.page !== 'login' || record.ready !== true || record.anonymous !== true ||
      record.checks?.keychainWriteReadDelete !== true || record.checks?.encryptedDraftWriteRead !== true ||
      !Number.isFinite(record.checkedAt) || record.checkedAt < launchedAt) throw Error('The fresh anonymous login and native secure-storage checks have not passed.');
  const m = record.metrics;
  if (!m || !Number.isFinite(m.width) || !Number.isFinite(m.height) || m.width <= 0 || m.height <= 0) throw Error('Login viewport metrics are invalid.');
  for (const field of ['username', 'password', 'submit']) {
    const r = m[field];
    if (!r || !['left','top','width','height'].every(key => Number.isFinite(r[key])) || r.width <= 0 || r.height <= 0 || r.left < 0 || r.top < 0 || r.left + r.width > m.width + 1 || r.top + r.height > m.height + 1) throw Error('Anonymous login control is not visible in the viewport: ' + field);
  }
  return record;
}

export function installDiagnosticArgs(device, bootedByUs, bootStartedAt, env = process.env) {
  // Never inspect a person's local Simulator datastore, or an already-running device.
  if (env.GITHUB_ACTIONS !== 'true' || env.RUNNER_ENVIRONMENT !== 'github-hosted' || !bootedByUs) return null;
  if (!/^[A-Fa-f0-9-]{36}$/.test(device?.udid || '') || !Number.isFinite(bootStartedAt) || bootStartedAt <= 0) return null;
  return ['simctl', 'spawn', device.udid, '/usr/bin/log', 'show', '--start', '@' + Math.floor(bootStartedAt / 1000),
    '--style', 'compact', '--predicate', '(process == "installd" OR process == "lsd") AND (messageType == 16 OR messageType == 17)'];
}

export async function collectInstallDiagnostics({device, bootedByUs, bootStartedAt, output, env = process.env}, execute = run) {
  const args = installDiagnosticArgs(device, bootedByUs, bootStartedAt, env);
  if (!args) return null;
  const file = path.join(output, 'install-diagnostics.log');
  await writeFile(file, 'Fresh hosted Simulator installation errors, since this test booted the device.\n');
  let error;
  try {await execute('xcrun', args, file, 20000);} catch (failure) {error = failure.message;}
  // run() bounds its combined child output; also bound the final file, including its command header.
  const bytes = await readFile(file);
  if (bytes.length > 4 * 1024 * 1024) await writeFile(file, bytes.subarray(0, 4 * 1024 * 1024));
  return {file:'install-diagnostics.log', ...(error ? {error} : {})};
}

async function run(command, args, log, timeout = 60000) {
  const label = command + ' ' + args.join(' ');
  await appendFile(log, '\n$ ' + label + ' (timeout ' + timeout / 1000 + 's)\n');
  return await new Promise((resolve, reject) => {
    const child = spawn(command, args, {stdio: ['ignore', 'pipe', 'pipe']});
    let output = '', errorOutput = '', bytes = 0, failure;
    const timer = setTimeout(() => {failure = Error(label + ' exceeded its ' + timeout / 1000 + 's timeout.'); child.kill('SIGKILL');}, timeout);
    const capture = (chunk, error) => {
      bytes += chunk.length;
      if (bytes > 4 * 1024 * 1024) {failure = Error(label + ' returned too much diagnostic output.'); child.kill('SIGKILL'); return;}
      if (error) errorOutput += chunk; else output += chunk;
    };
    child.stdout.on('data', chunk => capture(chunk, false)); child.stderr.on('data', chunk => capture(chunk, true));
    child.on('error', error => {clearTimeout(timer); reject(error);});
    child.on('close', async code => {
      clearTimeout(timer);
      try {await appendFile(log, output + errorOutput);} catch (error) {reject(error); return;}
      if (failure || code !== 0) reject(failure || Error(label + ' exited with status ' + code + '. See startup.log.'));
      else resolve(output);
    });
  });
}

async function main() {
  const app = path.resolve(process.argv[2] || 'artifacts/ios/DerivedData/Build/Products/Debug-iphonesimulator/App.app');
  const output = path.resolve(process.argv[3] || 'artifacts/ios');
  await mkdir(output, {recursive: true});
  const log = path.join(output, 'startup.log'), screenshot = path.join(output, 'startup.png');
  const result = {schema: 1, version: '0.9.0-beta.1', platform: 'iOS Simulator', bundleId, signing: 'simulator-adhoc', installableOnIPhone:false, verification: 'startup_only', result: 'failed', checkedAt: new Date().toISOString()};
  let device, bootedByUs = false, installed = false, bootStartedAt;
  try {
    if (process.platform !== 'darwin') throw Error('This smoke test requires the runner’s existing macOS/Xcode simulator tools.');
    await access(path.join(app, 'App'));
    result.stage = 'check_existing_environment';
    await run('xcodebuild', ['-checkFirstLaunchStatus'], log);
    result.stage = 'select_existing_simulator';
    device = selectIPhone(JSON.parse(await run('xcrun', ['simctl', 'list', 'devices', 'available', '--json'], log)));
    result.device = {name: device.name, runtime: device.runtime, udid: device.udid};
    result.stage = 'boot_simulator';
    if (device.state !== 'Booted') {bootStartedAt = Date.now(); await run('xcrun', ['simctl', 'boot', device.udid], log); bootedByUs = true;}
    // Fresh hosted simulators migrate system data on their first boot; Xcode 26 can exceed three minutes.
    result.stage = 'wait_for_first_boot';
    await run('xcrun', ['simctl', 'bootstatus', device.udid, '-b'], log, 600000);
    result.stage = 'install_app';
    await run('xcrun', ['simctl', 'install', device.udid, app], log, 240000);
    installed = true;
    const container = (await run('xcrun', ['simctl', 'get_app_container', device.udid, bundleId, 'data'], log)).trim();
    if (!path.isAbsolute(container)) throw Error('The simulator app data container was not found.');
    const readinessFile = path.join(container, 'Library/Application Support/QibanSmoke/readiness.json');
    await rm(readinessFile, {force:true});
    result.stage = 'launch_app';
    const launchedAt = Date.now();
    const processId = launchPID(await run('xcrun', ['simctl', 'launch', device.udid, bundleId, '--qiban-smoke'], log));
    result.processId = processId;
    result.stage = 'wait_for_anonymous_login_and_secure_storage';
    let readiness;
    for (const deadline = Date.now() + 60000; Date.now() < deadline;) {
      try {readiness = validateReadiness(JSON.parse(await readFile(readinessFile, 'utf8')), launchedAt); break;}
      catch (error) {if (error.code !== 'ENOENT') throw error;}
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    if (!readiness) throw Error('The anonymous login page and native storage readiness marker were not produced within 60s.');
    await writeFile(path.join(output, 'readiness.json'), JSON.stringify(readiness, null, 2) + '\n');
    result.checks = {anonymousLoginPage:true, keychainWriteReadDelete:true, encryptedDraftWriteRead:true};
    await new Promise(resolve => setTimeout(resolve, 2000));
    result.stage = 'check_running_process';
    const executable = (await run('/bin/ps', ['-p', String(processId), '-o', 'comm='], log)).trim();
    if (path.basename(executable) !== 'App') throw Error('The launched simulator process is no longer running.');
    result.stage = 'capture_startup_screenshot';
    await run('xcrun', ['simctl', 'io', device.udid, 'screenshot', screenshot], log);
    await access(screenshot);
    result.result = 'started'; result.stage = 'complete'; result.screenshot = 'startup.png';
  } catch (error) {
    result.error = error.message; process.exitCode = 1;
    if (device && (installed || result.stage === 'install_app')) await run('xcrun', ['simctl', 'io', device.udid, 'screenshot', screenshot], log, 15000).then(()=>{result.screenshot='startup.png';}).catch(()=>{});
    if (result.stage === 'install_app') {
      try {
        const diagnostics = await collectInstallDiagnostics({device, bootedByUs, bootStartedAt, output});
        if (diagnostics) {result.diagnostics = diagnostics.file; if (diagnostics.error) result.diagnosticsError = diagnostics.error;}
      } catch (diagnosticError) {result.diagnosticsError = diagnosticError.message;}
    }
  }
  finally {
    if (device) {
      await run('xcrun', ['simctl', 'terminate', device.udid, bundleId], log, 15000).catch(() => {});
      if (bootedByUs) await run('xcrun', ['simctl', 'shutdown', device.udid], log, 20000).catch(() => {});
    }
    await writeFile(path.join(output, 'result.json'), JSON.stringify(result, null, 2) + '\n');
    const summary = `### 栖伴 iOS 模拟器检查\n\n结果：${result.result === 'started' ? '匿名登录表单可见；独立 Keychain 写/读/删和加密草稿文件检查通过，已保存截图。' : '启动检查未通过，请查看截图、日志和 result.json。'}\n\n范围仍仅为启动就绪。未提交真实账号登录、AI、文件分享或跨设备同步测试，也未安装到 iPhone 真机。仅使用本地 Simulator ad-hoc 签名，未读取 Apple 身份、签名密钥或接受新的 SDK 许可。\n`;
    if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, summary);
    console.log(JSON.stringify(result));
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
