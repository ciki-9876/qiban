// Creates a NEW dedicated release key; never examines existing credential stores.
import {generateKeyPairSync} from 'node:crypto';
import {mkdir, open, writeFile} from 'node:fs/promises';
import path from 'node:path';
const privatePath = process.argv[2];
if (!privatePath || !path.isAbsolute(privatePath)) throw Error('Supply a new absolute private-key file outside this repository.');
const repository = path.resolve(import.meta.dirname, '..');
if (privatePath.startsWith(repository + path.sep)) throw Error('The signing key must stay outside this repository.');
await mkdir(path.dirname(privatePath), {recursive:true,mode:0o700});
const handle = await open(privatePath, 'wx', 0o600);
try {
  const keys = generateKeyPairSync('rsa', {modulusLength:3072,publicKeyEncoding:{type:'spki',format:'pem'},privateKeyEncoding:{type:'pkcs8',format:'pem'}});
  await handle.writeFile(keys.privateKey);
  await mkdir(path.join(repository,'clients/updates'), {recursive:true});
  await writeFile(path.join(repository,'clients/updates/config.json'), JSON.stringify({schema:1,channel:'beta',runtime:'qiban-native-2',embeddedSequence:1,publicKey:keys.publicKey},null,2)+'\n', {flag:'wx'});
} finally { await handle.close(); }
console.log('Created a dedicated update signing key and public client configuration; private material was not printed.');
