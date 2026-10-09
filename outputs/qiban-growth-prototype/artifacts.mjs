import { createHash, randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import { AppError } from './ai.mjs';

const MAX_BYTES = 4 * 1024 * 1024;
const textExtensions = new Set(['html','htm','css','js','mjs','jsx','ts','tsx','json','md','txt','py','vue','svelte','svg']);
const imageExtensions = new Set(['png','jpg','jpeg','webp','gif']);
export const validArtifactId = id => typeof id === 'string' && /^[a-f0-9]{64}$/.test(id);

function imageMime(bytes) {
  if(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return 'image/png';
  if(bytes[0]===255 && bytes[1]===216 && bytes[2]===255) return 'image/jpeg';
  if(bytes.toString('ascii',0,4)==='RIFF' && bytes.toString('ascii',8,12)==='WEBP') return 'image/webp';
  if(['GIF87a','GIF89a'].includes(bytes.toString('ascii',0,6))) return 'image/gif';
  throw new AppError('INVALID_IMAGE','图片格式无法识别，请重新导出 PNG、JPG 或 WebP 图片。');
}
export function prepareArtifact(input) {
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  if (!name || name.length > 180 || /[\/\\\x00-\x1f]/.test(name)) throw new AppError('INVALID_FILE','文件名无法使用。');
  const extension = name.split('.').at(-1).toLowerCase();
  if (!textExtensions.has(extension) && !imageExtensions.has(extension)) throw new AppError('FILE_TYPE','支持代码、HTML、文本和 PNG / JPG / WebP 图片。');
  if (typeof input.base64 !== 'string' || input.base64.length > Math.ceil(MAX_BYTES/3)*4 || input.base64.length%4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(input.base64)) throw new AppError('FILE_SIZE','每个文件最多 4 MB。');
  const bytes = Buffer.from(input.base64,'base64');
  if (!bytes.length || bytes.length > MAX_BYTES) throw new AppError('FILE_SIZE','请选择非空、最多 4 MB 的文件。');
  const kind = textExtensions.has(extension) ? 'text' : 'image';
  const mime = kind === 'image' ? imageMime(bytes) : undefined;
  let content = '', omittedEmbedded = false;
  if (kind === 'text') {
    try { content = new TextDecoder('utf-8',{fatal:true}).decode(bytes); } catch { throw new AppError('FILE_ENCODING','文本文件需要使用 UTF-8 编码。'); }
    if (content.includes('\0')) throw new AppError('FILE_ENCODING','这个文件无法作为文本读取。');
    // Keep the original file intact; remove embedded bitmap payloads only from the AI excerpt.
    content = content.replace(/data:[a-z0-9/+.-]+;base64,[a-z0-9+/=\r\n]{256,}/gi,()=>{omittedEmbedded=true;return '[内嵌资源已省略]';});
  }
  const truncated = content.length > 24000;
  const digest = createHash('sha256').update(bytes).digest('hex');
  const id = createHash('sha256').update(name+'\0'+digest).digest('hex');
  return {id,name,kind,mime,size:bytes.length,sha256:digest,content:content.slice(0,24000),truncated,omittedEmbedded,base64:input.base64};
}
export const artifactInfo = ({id,name,kind,mime,size,sha256,truncated,omittedEmbedded}) => ({id,name,kind,mime,size,sha256,truncated,omittedEmbedded});
export async function saveArtifact(dataDir,input) {
  const artifact=prepareArtifact(input), directory=path.join(dataDir,'artifacts');
  await mkdir(directory,{recursive:true,mode:0o700});
  const target=path.join(directory,artifact.id+'.json'), temp=target+'.'+randomBytes(6).toString('hex')+'.tmp';
  await writeFile(temp,JSON.stringify(artifact),{mode:0o600});await rename(temp,target);
  return artifactInfo(artifact);
}
export async function readArtifact(dataDir,id) {
  if(!validArtifactId(id))throw new AppError('INVALID_FILE_ID','成果编号无效。');
  try { return JSON.parse(await readFile(path.join(dataDir,'artifacts',id+'.json'),'utf8')); }
  catch(error) { if(error.code==='ENOENT')throw new AppError('FILE_MISSING','这份成果文件不在本机服务中，请重新附上后留为新版本。',404);throw error; }
}
export async function hydrateEvidence(dataDir,context) {
  if(!context.delivery)return context;
  let remaining=48000;
  const artifacts=[];
  for(const id of context.delivery.artifactIds){
    const a=await readArtifact(dataDir,id);
    const content=a.content.slice(0,remaining);remaining-=content.length;
    artifacts.push({...artifactInfo(a),...(a.kind==='image'?{imageUrl:'data:'+imageMime(Buffer.from(a.base64,'base64'))+';base64,'+a.base64}:{}),content,truncated:a.truncated||content.length<a.content.length});
  }
  return {...context,delivery:{...context.delivery,artifacts}};
}
