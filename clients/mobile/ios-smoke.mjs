import {spawn} from 'node:child_process';
import {access, mkdir, appendFile, writeFile} from 'node:fs/promises';
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

async function run(command, args, log, timeout = 60000) {
  await appendFile(log, '\n$ ' + command + ' ' + args.join(' ') + '\n');
  return await new Promise((resolve, reject) => {
    const child = spawn(command, args, {stdio: ['ignore', 'pipe', 'pipe']});
    let output = '', errorOutput = '', bytes = 0, failure;
    const timer = setTimeout(() => {failure = Error(command + ' exceeded its timeout.'); child.kill('SIGKILL');}, timeout);
    const capture = (chunk, error) => {
      bytes += chunk.length;
      if (bytes > 4 * 1024 * 1024) {failure = Error(command + ' returned too much diagnostic output.'); child.kill('SIGKILL'); return;}
      if (error) errorOutput += chunk; else output += chunk;
    };
    child.stdout.on('data', chunk => capture(chunk, false)); child.stderr.on('data', chunk => capture(chunk, true));
    child.on('error', error => {clearTimeout(timer); reject(error);});
    child.on('close', async code => {
      clearTimeout(timer);
      try {await appendFile(log, output + errorOutput);} catch (error) {reject(error); return;}
      if (failure || code !== 0) reject(failure || Error(command + ' exited with status ' + code + '. See startup.log.'));
      else resolve(output);
    });
  });
}

async function main() {
  const app = path.resolve(process.argv[2] || 'artifacts/ios/DerivedData/Build/Products/Debug-iphonesimulator/App.app');
  const output = path.resolve(process.argv[3] || 'artifacts/ios');
  await mkdir(output, {recursive: true});
  const log = path.join(output, 'startup.log'), screenshot = path.join(output, 'startup.png');
  const result = {schema: 1, version: '0.9.0-beta.1', platform: 'iOS Simulator', bundleId, signing: false, verification: 'startup_only', result: 'failed', checkedAt: new Date().toISOString()};
  let device, bootedByUs = false;
  try {
    if (process.platform !== 'darwin') throw Error('This smoke test requires the runner’s existing macOS/Xcode simulator tools.');
    await access(path.join(app, 'App'));
    await run('xcodebuild', ['-checkFirstLaunchStatus'], log);
    device = selectIPhone(JSON.parse(await run('xcrun', ['simctl', 'list', 'devices', 'available', '--json'], log)));
    result.device = {name: device.name, runtime: device.runtime, udid: device.udid};
    if (device.state !== 'Booted') {await run('xcrun', ['simctl', 'boot', device.udid], log); bootedByUs = true;}
    await run('xcrun', ['simctl', 'bootstatus', device.udid, '-b'], log, 180000);
    await run('xcrun', ['simctl', 'install', device.udid, app], log);
    const processId = launchPID(await run('xcrun', ['simctl', 'launch', device.udid, bundleId], log));
    result.processId = processId;
    await new Promise(resolve => setTimeout(resolve, 8000));
    const executable = (await run('/bin/ps', ['-p', String(processId), '-o', 'comm='], log)).trim();
    if (path.basename(executable) !== 'App') throw Error('The launched simulator process is no longer running.');
    await run('xcrun', ['simctl', 'io', device.udid, 'screenshot', screenshot], log);
    await access(screenshot);
    result.result = 'started'; result.screenshot = 'startup.png';
  } catch (error) {result.error = error.message; process.exitCode = 1;}
  finally {
    if (device) {
      await run('xcrun', ['simctl', 'terminate', device.udid, bundleId], log, 15000).catch(() => {});
      if (bootedByUs) await run('xcrun', ['simctl', 'shutdown', device.udid], log, 20000).catch(() => {});
    }
    await writeFile(path.join(output, 'result.json'), JSON.stringify(result, null, 2) + '\n');
    const summary = `### 栖伴 iOS 模拟器检查\n\n结果：${result.result === 'started' ? '已安装并启动，已保存启动截图。' : '未完成启动验证，请查看构建日志和 result.json。'}\n\n范围仅为模拟器编译和启动。未验证登录、AI、文件保存与分享、离线恢复，也未安装到 iPhone 真机。没有配置签名、读取开发者凭证或接受新的 SDK 许可。\n`;
    if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, summary);
    console.log(JSON.stringify(result));
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
