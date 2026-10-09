const { spawn } = require('node:child_process');
const path = require('node:path');
const cli = path.join(path.dirname(require.resolve('electron-builder/package.json')), 'cli.js');
const child = spawn(process.execPath, [cli, '--win', 'nsis', 'zip', '--x64', '--publish', 'never', ...process.argv.slice(2)], {
  cwd: __dirname,
  stdio: 'inherit',
  // Disabled cache also prevents certificate discovery while calculating signing cache digests.
  env: { ...process.env, ELECTRON_BUILDER_COMPRESSION_LEVEL: process.env.ELECTRON_BUILDER_COMPRESSION_LEVEL || '3', CSC_IDENTITY_AUTO_DISCOVERY: 'false', ELECTRON_BUILDER_DISABLE_BUILD_CACHE: 'true' }
});
child.on('error', error => { console.error(error.message); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 1; });
