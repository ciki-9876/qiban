'use strict';
const ORIGIN = 'https://81.70.181.205';
const MAX_ZIP = 32 * 1024 * 1024;
function bytes64(value) {
  if (typeof value !== 'string' || value.length > 24000 || !/^[A-Za-z0-9+/]*={0,2}$/.test(value)) throw Error('更新签名格式无效。');
  return Uint8Array.from(atob(value), c => c.charCodeAt(0));
}
async function verifiedPayload(envelope, config, subtle = globalThis.crypto.subtle) {
  if (!envelope || Object.keys(envelope).sort().join(',') !== 'payload,signature') throw Error('更新清单无效。');
  const bytes = bytes64(envelope.payload), signature = bytes64(envelope.signature);
  const publicBytes = bytes64(config.publicKey.replace(/-----[A-Z ]+-----|\s/g, ''));
  const key = await subtle.importKey('spki', publicBytes, {name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'}, false, ['verify']);
  if (!await subtle.verify('RSASSA-PKCS1-v1_5', key, signature, bytes)) throw Error('更新签名未通过，已保留当前版本。');
  return JSON.parse(new TextDecoder('utf-8', {fatal:true}).decode(bytes));
}
async function verifyManifest(envelope, config, target, subtle = globalThis.crypto.subtle) {
  const item = await verifiedPayload(envelope,config,subtle);
  if (item.schema !== 1 || item.channel !== config.channel || item.target !== target ||
      !Number.isSafeInteger(item.sequence) || item.sequence < 1 || item.sequence > 1e9 ||
      !/^[0-9]+\.[0-9]+\.[0-9]+(?:-[a-z0-9.-]+)?$/.test(item.version || '') ||
      !/^[a-f0-9]{64}$/.test(item.checksum || '') ||
      !Number.isSafeInteger(item.bytes) || item.bytes < 1 || item.bytes > MAX_ZIP ||
      typeof item.signature !== 'string' || bytes64(item.signature).length < 256 ||
      item.url !== `${ORIGIN}/updates/bundles/${item.checksum}.zip` ||
      item.bundleId !== `qiban2-${item.sequence}-${item.checksum.slice(0,16)}`) throw Error('更新内容格式无效。');
  // A binary upgrade must establish its own runtime and trust anchor first.
  if (item.runtime !== config.runtime) return {...item, incompatible:true};
  return item;
}
function sequenceOf(id, fallback) {
  return /^qiban2-([1-9][0-9]*)-[a-f0-9]{16}$/.test(id || '') ? Number(id.split('-')[1]) : fallback;
}
async function stageUpdate({api, envelope, config, target, subtle}) {
  const release = await verifyManifest(envelope, config, target, subtle);
  if (release.incompatible) return {status:'native-required',version:release.version};
  const current = await api.getCurrentBundle(), next = await api.getNextBundle();
  const floor = Math.max(config.embeddedSequence, sequenceOf(current.bundleId,0), sequenceOf(next.bundleId,0));
  if (release.sequence <= floor) return {status:next.bundleId?'ready':'current',version:release.version};
  const blocked = await api.getBlockedBundles();
  if (blocked.bundleIds.includes(release.bundleId)) return {status:'rolled-back',version:release.version};
  const downloaded = await api.getDownloadedBundles();
  if (!downloaded.bundleIds.includes(release.bundleId)) await api.downloadBundle({bundleId:release.bundleId,url:release.url,artifactType:'zip',checksum:release.checksum,signature:release.signature});
  await api.setNextBundle({bundleId:release.bundleId});
  return {status:'ready',version:release.version};
}
module.exports = {ORIGIN, MAX_ZIP, verifyManifest, verifiedPayload, stageUpdate, sequenceOf};
