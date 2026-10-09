// This module deliberately has no Electron imports: the security boundary is testable in Node.
const path = require('node:path');
const fs = require('node:fs/promises');
const crypto = require('node:crypto');
const ORIGIN = 'https://81.70.181.205';
const MAX_BYTES = 16 * 1024 * 1024;
const MAX_DRAFT_BYTES = 32 * 1024 * 1024;
const MAX_SAVE_BYTES = 320 * 1024 * 1024;
const API_PATHS = new Map([
  ['/api/account', ['GET']], ['/api/workspace', ['GET', 'POST']],
  ['/api/ai/config', ['GET', 'POST']], ['/api/ai/test', ['POST']],
  ['/api/ai/plan', ['POST']], ['/api/ai/feedback', ['POST']],
  ['/api/ai/assist', ['POST']], ['/api/ai/stage', ['POST']], ['/api/ai/replace', ['POST']],
  ['/api/ai/artifacts/upload', ['POST']], ['/api/ai/artifacts/read', ['POST']]
]);
function nativePath(input) {
  if (!input || typeof input !== 'object' || !API_PATHS.get(input.path)?.includes(input.method)) throw Error('不支持的账号接口。');
  if (input.method === 'GET' && input.body !== undefined) throw Error('GET 请求不能包含数据。');
  if (input.body !== undefined && (!input.body || typeof input.body !== 'object' || Array.isArray(input.body))) throw Error('请求数据无效。');
  const body = input.method === 'POST' ? JSON.stringify(input.body ?? {}) : undefined;
  if (body && Buffer.byteLength(body) > MAX_BYTES) throw Error('请求内容超过 16 MB。');
  return { url: `${ORIGIN}/api/native/${input.path.slice(5)}`, method: input.method, body };
}
function externalUrl(value) {
  if (typeof value !== 'string' || value.length > 4096) throw Error('链接无效。');
  let url; try { url = new URL(value); } catch { throw Error('链接无效。'); }
  if (!['https:', 'http:'].includes(url.protocol) || !url.hostname || url.username || url.password) throw Error('只能打开网页链接。');
  return url.href;
}
function accountId(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{8,100}$/.test(value)) throw Error('账号标识无效。');
  return value;
}
function publicMeta(session) {
  if (!session) return null;
  return { accountId: session.accountId, username: session.username, expires: session.expires };
}
function draftRecord(record) {
  const keys = new Set(['revision', 'workspace', 'values', 'dirty', 'forms', 'updatedAt']);
  if (!record || typeof record !== 'object' || Array.isArray(record) || Object.keys(record).some(key => !keys.has(key))) throw Error('本机草稿格式无效。');
  if (!Number.isSafeInteger(record.revision) || record.revision < 0 || typeof record.dirty !== 'boolean' || !Number.isFinite(record.updatedAt)) throw Error('本机草稿版本无效。');
  if (record.workspace !== null && (!record.workspace || typeof record.workspace !== 'object' || Array.isArray(record.workspace))) throw Error('本机工作区无效。');
  if (!record.values || typeof record.values !== 'object' || Array.isArray(record.values) || Object.entries(record.values).some(([key, value]) => !['qiban.growth.prototype.v1', 'qiban.growth.visits.v1'].includes(key) || typeof value !== 'string')) throw Error('不能将配置或凭证保存在草稿中。');
  if (!record.forms || typeof record.forms !== 'object' || Array.isArray(record.forms)) throw Error('本机表单草稿无效。');
  function checkForms(value, depth = 0) {
    if (depth > 12) throw Error('本机表单草稿过深。');
    if (!value || typeof value !== 'object') return;
    for (const [key, item] of Object.entries(value)) {
      if (/^(?:password|passphrase|api[-_]?key|access[-_]?token|refresh[-_]?token|authorization|token|secret)$/i.test(key)) throw Error('不能将密码或密钥保存在表单草稿中。');
      checkForms(item, depth + 1);
    }
  }
  checkForms(record.forms);
  return record;
}
function safeName(name) {
  if (typeof name !== 'string') return '栖伴导出.json';
  let clean = name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').replace(/[. ]+$/g, '').slice(0, 180) || '栖伴导出.json';
  if (/^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i.test(clean)) clean = '栖伴-' + clean;
  return clean;
}
function fileBytes(input) {
  const value = input?.base64;
  if (typeof value !== 'string' || value.length > Math.ceil(MAX_SAVE_BYTES / 3) * 4 || value.length % 4 || /[^A-Za-z0-9+/=]/.test(value)) throw Error('文件内容无效或超过 320 MB。');
  const padding = value.endsWith('==') ? 2 : value.endsWith('=') ? 1 : 0, firstPadding = value.indexOf('=');
  if (firstPadding !== -1 && firstPadding !== value.length - padding) throw Error('文件内容无效。');
  const bytes = Buffer.from(value, 'base64');
  if (bytes.length > MAX_SAVE_BYTES) throw Error('文件超过 320 MB。');
  return bytes;
}
function packagedPath(rawUrl, allowed) {
  let url; try { url = new URL(rawUrl); } catch { return null; }
  if (url.protocol !== 'app:' || url.host !== 'qiban') return null;
  let name; try { name = decodeURIComponent(url.pathname).replace(/^\//, ''); } catch { return null; }
  if (!name) name = 'index.html';
  if (name === 'login') name = 'login.html';
  if (!allowed.has(name)) return null;
  return name;
}
function decryptedText(value) {
  if (typeof value === 'string') return value;
  if (value && typeof value.result === 'string') return value.result;
  throw Error('系统加密数据暂时无法读取。');
}
function encryptedStore(directory, crypt) {
  async function read(name) {
    try {
      const decrypted = await crypt.decryptString(await fs.readFile(path.join(directory, name)));
      const record = JSON.parse(decryptedText(decrypted));
      if (decrypted?.shouldReEncrypt === true) await write(name, record);
      return record;
    }
    catch (error) { if (error.code === 'ENOENT') return null; throw Error('本机加密数据无法读取，请重新登录；未同步草稿不会自动删除。'); }
  }
  async function write(name, record) {
    const raw = JSON.stringify(record);
    if (Buffer.byteLength(raw) > MAX_DRAFT_BYTES) throw Error('本机草稿超过 32 MB。');
    const bytes = await crypt.encryptString(raw);
    await fs.mkdir(directory, { recursive: true, mode: 0o700 });
    const destination = path.join(directory, name), temporary = destination + '.' + crypto.randomBytes(6).toString('hex') + '.tmp';
    await fs.writeFile(temporary, bytes, { mode: 0o600 });
    await fs.rename(temporary, destination);
  }
  async function remove(name) { await fs.rm(path.join(directory, name), { force: true }); }
  return { read, write, remove };
}
module.exports = { ORIGIN, MAX_BYTES, MAX_DRAFT_BYTES, MAX_SAVE_BYTES, nativePath, externalUrl, accountId, publicMeta, draftRecord, safeName, fileBytes, packagedPath, decryptedText, encryptedStore };
