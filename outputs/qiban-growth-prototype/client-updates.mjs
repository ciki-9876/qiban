import {lstat,readFile} from 'node:fs/promises';
import path from 'node:path';

// Dedicated PUBLIC directory only. Never point this at account/configuration storage.
export async function serveClientUpdate(req,res,pathname,directory) {
  if (!pathname.startsWith('/updates/')) return false;
  const manifest=/^\/updates\/beta\/(mobile|windows)\.json$/.test(pathname);
  const bundle=/^\/updates\/bundles\/[a-f0-9]{64}\.zip$/.test(pathname);
  if (!directory || !['GET','HEAD'].includes(req.method) || (!manifest&&!bundle)) {res.writeHead(404,{'Cache-Control':'no-store','Content-Type':'application/json'});res.end('{}');return true;}
  const relative=pathname.slice('/updates/'.length),file=path.join(directory,relative);
  try {
    // Disallow symlinked files and symlinked category directories.
    const parent=await lstat(path.dirname(file)),info=await lstat(file);
    if(parent.isSymbolicLink()||!parent.isDirectory()||!info.isFile()||info.isSymbolicLink()||info.size>(manifest?24000:32*1024*1024))throw Error('invalid update resource');
    const data=await readFile(file);
    if(manifest)JSON.parse(data.toString('utf8'));
    res.writeHead(200,{'Content-Type':manifest?'application/json; charset=utf-8':'application/zip','Content-Length':data.length,'X-Content-Type-Options':'nosniff','Cache-Control':manifest?'no-store':'public, max-age=31536000, immutable'});
    res.end(req.method==='HEAD'?undefined:data);
  } catch {res.writeHead(404,{'Cache-Control':'no-store','Content-Type':'application/json'});res.end('{}');}
  return true;
}
