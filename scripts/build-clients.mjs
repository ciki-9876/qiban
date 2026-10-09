import { access, copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { build } from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'outputs/qiban-growth-prototype');
const required = [
  'index.html', 'style.css', 'project.css', 'research-cards.css', 'app.js',
  'project-state.js', 'attachment-input.js', 'stage-state.js', 'record-input.js',
  'action-state.js', 'home-state.js', 'expedition-data.js', 'research-cards.js', 'home-ui.js',
  'assets/qixi-editorial.png', 'platform.js', 'cloud-storage.js', 'cloud-login.js'
];
const optional = ['platform.css', 'manifest.webmanifest', 'service-worker.js',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png'];
// An explicit resource allowlist keeps server code, account records, AI keys and tests out of every client.
async function exists(name) { try { await access(path.join(source, name)); return true; } catch { return false; } }
const selected = [...required];
for (const name of optional) if (await exists(name)) selected.push(name);
const requested = process.argv.slice(2);
const targets = requested.length ? requested.map(value => value.replace(/^--target=/, '')) : ['mobile', 'windows', 'web-static'];
if (targets.some(target => !['mobile', 'windows', 'web-static'].includes(target))) throw Error('Client target must be mobile, windows or web-static.');
function htmlFor(html, target, login = false) {
  html = html.replace(/<script\b[^>]*src=["']\/?(?:\.\/)?(?:platform|cloud-storage|native-bootstrap)\.js["'][^>]*><\/script>\s*/g, '');
  html = html.replace(/<meta\b[^>]*name=["']qiban-(?:cloud|client|static-preview)["'][^>]*>/g, '');
  const meta = `<meta name="qiban-cloud" content="true"><meta name="qiban-client" content="${target === 'web-static' ? 'web' : 'native'}">`;
  const stylesheet = selected.includes('platform.css') && !html.includes('href="platform.css"') ? '<link rel="stylesheet" href="platform.css">' : '';
  html = html.replace('</head>', meta + stylesheet + '</head>');
  const bootstrap = target === 'mobile' ? '<script src="native-bootstrap.js"></script>' : '';
  const scripts = bootstrap + '<script src="platform.js"></script>' + (login ? '' : '<script src="cloud-storage.js"></script>');
  html = login
    ? html.replace(/<script\b[^>]*src=["']\/?(?:cloud-)?login\.js["'][^>]*><\/script>/, scripts + '<script src="cloud-login.js"></script>')
    : html.replace('<script src="attachment-input.js">', scripts + '<script src="attachment-input.js">');
  if (!html.includes('src="platform.js"')) throw Error(`Cannot inject platform entry in ${target} ${login ? 'login' : 'index'}.`);
  return html;
}
for (const target of targets) {
  const destination = path.join(root, 'dist', target);
  await rm(destination, { recursive: true, force: true });
  await mkdir(destination, { recursive: true });
  for (const name of selected) {
    await mkdir(path.dirname(path.join(destination, name)), { recursive: true });
    await copyFile(path.join(source, name), path.join(destination, name));
  }
  const index = await readFile(path.join(source, 'index.html'), 'utf8');
  const login = await readFile(path.join(source, 'cloud-login.html'), 'utf8');
  await writeFile(path.join(destination, 'index.html'), htmlFor(index, target));
  await writeFile(path.join(destination, 'login.html'), htmlFor(login, target, true));
  const files = [...selected, 'login.html'];
  if (target === 'mobile') {
    await build({ entryPoints: [path.join(root, 'clients/mobile/bootstrap.js')], bundle: true, platform: 'browser', format: 'iife', target: 'es2020', outfile: path.join(destination, 'native-bootstrap.js'), legalComments: 'none', minify: false });
    files.push('native-bootstrap.js');
  }
  await writeFile(path.join(destination, 'client-files.json'), JSON.stringify({ version: '0.9.0-beta.1', target, files: files.sort() }, null, 2) + '\n');
  console.log(`${target}: ${files.length} allowlisted assets`);
}
