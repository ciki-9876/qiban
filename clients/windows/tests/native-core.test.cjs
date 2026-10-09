const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const core = require('../native-core.cjs');

test('native API allowlist fixes host, method and route; arbitrary URLs cannot be sent', () => {
  assert.equal(core.nativePath({ path: '/api/workspace', method: 'POST', body: { revision: 2 } }).url, core.ORIGIN + '/api/native/workspace');
  for (const input of [
    { path: 'https://example.com', method: 'GET' }, { path: '/api/account?token=bad', method: 'GET' },
    { path: '/api/../private', method: 'GET' }, { path: '/api/account', method: 'POST' },
    { path: '/api/account', method: 'GET', body: {} }, { path: '/api/workspace', method: 'POST', body: [] }
  ]) assert.throws(() => core.nativePath(input));
  assert.throws(() => core.nativePath({ path: '/api/workspace', method: 'POST', body: { text: 'x'.repeat(core.MAX_BYTES) } }));
});
test('bundled protocol only exposes the resource manifest and rejects traversal', () => {
  const allowed = new Set(['index.html', 'login.html', 'app.js']);
  assert.equal(core.packagedPath('app://qiban/', allowed), 'index.html');
  assert.equal(core.packagedPath('app://qiban/login', allowed), 'login.html');
  for (const url of ['https://81.70.181.205/login', 'app://other/app.js', 'app://qiban/server.mjs', 'app://qiban/%2e%2e%2fsecret', 'app://qiban/%zz']) assert.equal(core.packagedPath(url, allowed), null);
});
test('external links and save-file paths reject executable URLs and traversal', () => {
  assert.equal(core.externalUrl('https://example.com/test'), 'https://example.com/test');
  for (const url of ['file:///etc/passwd', 'javascript:alert(1)', 'https://user:pass@example.com', 'app://qiban/']) assert.throws(() => core.externalUrl(url));
  assert.equal(core.safeName('../../private.json'), '.._.._private.json');
  assert.equal(core.safeName('CON.json'), '栖伴-CON.json');
  assert.deepEqual(core.fileBytes({ base64: Buffer.from('中文').toString('base64') }), Buffer.from('中文'));
  assert.throws(() => core.fileBytes({ base64: 'invalid !' }));
  assert.throws(() => core.fileBytes({ base64: 'a===' }));
  assert.throws(() => core.fileBytes({ base64: '==ab' }));
  assert.throws(() => core.accountId('../../private'));
  assert.deepEqual(core.publicMeta({ token: 'secret', accountId: 'account123', username: 'alice', expires: 1 }), { accountId: 'account123', username: 'alice', expires: 1 });
});
test('encrypted draft and session files do not contain plaintext and survive atomic replacement', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'qiban-native-core-'));
  const key = crypto.randomBytes(32);
  const fixtureEncryption = {
    encryptString(value) { const iv = crypto.randomBytes(12), cipher = crypto.createCipheriv('aes-256-gcm', key, iv); return Buffer.concat([iv, cipher.update(value), cipher.final(), cipher.getAuthTag()]); },
    decryptString(bytes) { const decipher = crypto.createDecipheriv('aes-256-gcm', key, bytes.subarray(0, 12)); decipher.setAuthTag(bytes.subarray(-16)); return Buffer.concat([decipher.update(bytes.subarray(12, -16)), decipher.final()]).toString('utf8'); }
  };
  try {
    const store = core.encryptedStore(directory, fixtureEncryption);
    assert.equal(await store.read('draft-account123.enc'), null);
    await store.write('draft-account123.enc', { workspace: '中文私人草稿' });
    assert.equal((await fs.readFile(path.join(directory, 'draft-account123.enc'))).includes(Buffer.from('中文私人草稿')), false);
    assert.deepEqual(await store.read('draft-account123.enc'), { workspace: '中文私人草稿' });
    await store.write('draft-account123.enc', { workspace: '第二稿' });
    assert.deepEqual(await store.read('draft-account123.enc'), { workspace: '第二稿' });
    assert.deepEqual(await fs.readdir(directory), ['draft-account123.enc']);
    await store.remove('draft-account123.enc');
    assert.equal(await store.read('draft-account123.enc'), null);
  } finally { await fs.rm(directory, { recursive: true, force: true }); }
});
test('only account workspace, visit values and ordinary form drafts may be cached', () => {
  const record = { revision: 0, workspace: null, values: {}, dirty: false, forms: { notes: { text: '中文记录' } }, updatedAt: Date.now() };
  assert.equal(core.draftRecord(record), record);
  assert.throws(() => core.draftRecord({ ...record, token: 'secret' }));
  assert.throws(() => core.draftRecord({ ...record, values: { 'ai-config': '{}' } }));
  assert.throws(() => core.draftRecord({ ...record, forms: { settings: { apiKey: 'secret' } } }));
  assert.throws(() => core.draftRecord({ ...record, forms: { settings: { password: 'secret' } } }));
});
test('async safeStorage return objects are parsed and rotated encrypted records are rewritten', async () => {
  assert.equal(core.decryptedText({ result: '中文', shouldReEncrypt: false }), '中文');
  assert.throws(() => core.decryptedText({ result: null }));
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'qiban-async-encryption-'));
  let writes = 0;
  const fixture = { async encryptString(raw) { writes++; return Buffer.from(raw.split('').reverse().join('')); }, async decryptString(bytes) { return { result: bytes.toString().split('').reverse().join(''), shouldReEncrypt: true }; } };
  try {
    const store = core.encryptedStore(directory, fixture);
    await store.write('draft.enc', { text: '独立测试草稿' });
    assert.deepEqual(await store.read('draft.enc'), { text: '独立测试草稿' });
    assert.equal(writes, 2);
  } finally { await fs.rm(directory, { recursive: true, force: true }); }
});
