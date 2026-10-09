const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const bundle = path.resolve(__dirname, '../../../dist/windows');

test('Windows bundle contains only listed UI resources and initializes platform before business code', async () => {
  const manifest = JSON.parse(await fs.readFile(path.join(bundle, 'client-files.json'), 'utf8'));
  async function files(directory, prefix = '') {
    const result = [];
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      const name = prefix + entry.name;
      result.push(...(entry.isDirectory() ? await files(path.join(directory, entry.name), name + '/') : [name]));
    }
    return result;
  }
  const actual = (await files(bundle)).filter(name => name !== 'client-files.json').sort();
  assert.deepEqual(actual, [...manifest.files].sort());
  assert.equal(actual.some(name => /(?:^|\/)(?:server|cloud-server|ai-config|accounts|sessions|tests|private|\.env)(?:[/.]|$)/.test(name) || name.endsWith('.mjs')), false);
  const index = await fs.readFile(path.join(bundle, 'index.html'), 'utf8');
  assert.ok(index.includes('name="qiban-cloud" content="true"'));
  assert.ok(index.indexOf('src="platform.js"') < index.indexOf('src="cloud-storage.js"'));
  assert.ok(index.indexOf('src="cloud-storage.js"') < index.indexOf('src="app.js"'));
  const login = await fs.readFile(path.join(bundle, 'login.html'), 'utf8');
  assert.ok(login.indexOf('src="platform.js"') < login.indexOf('src="cloud-login.js"'));
  assert.equal((index.match(/src="platform.js"/g) || []).length, 1);
});
