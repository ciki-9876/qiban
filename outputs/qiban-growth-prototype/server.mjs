import http from 'node:http';
import { randomBytes } from 'node:crypto';
import { readFile,writeFile,mkdir,rename,chmod } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AppError,normalizeConfig,sanitizeContext,callModel,fingerprint } from './ai.mjs';
import { saveArtifact,readArtifact,hydrateEvidence } from './artifacts.mjs';

const root=path.dirname(fileURLToPath(import.meta.url));
const homepage='栖伴-目标成长交互原型.html';
const {version:appVersion}=JSON.parse(await readFile(path.join(root,'package.json'),'utf8'));
const MAX_BODY=6_000_000;
async function writePrivate(file,value){await mkdir(path.dirname(file),{recursive:true,mode:0o700});const temp=file+'.'+randomBytes(6).toString('hex')+'.tmp';await writeFile(temp,JSON.stringify(value,null,2),{mode:0o600});await chmod(temp,0o600);await rename(temp,file);}
async function readJSON(file){try{return JSON.parse(await readFile(file,'utf8'));}catch(error){if(error.code==='ENOENT')return null;throw error;}}
async function readBody(req){const chunks=[];let bytes=0;for await(const chunk of req){bytes+=chunk.length;if(bytes>MAX_BODY)throw new AppError('BODY_TOO_LARGE','这次记录过长。',413);chunks.push(chunk);}try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new AppError('BAD_JSON','请求内容无法读取。',400);}}
function respond(res,status,value){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(value));}

export async function createApp({dataDir=path.resolve(root,'../../work/qiban-growth-private'),modelCall=callModel,initialConfig}={}){
  await mkdir(dataDir,{recursive:true,mode:0o700});
  await chmod(dataDir,0o700);
  const configFile=path.join(dataDir,'ai-config.json');
  let saved=initialConfig?{config:initialConfig,lastTest:null}:await readJSON(configFile);
  const token=randomBytes(32).toString('hex');
  const jobs=new Map();let active=0;
  const publicConfig=()=>({configured:Boolean(saved?.config?.model),baseUrl:saved?.config?.baseUrl||'',model:saved?.config?.model||'',keySaved:Boolean(saved?.config?.apiKey),format:saved?.config?.format||'json_object',tokenField:saved?.config?.tokenField||'max_tokens',lastTest:saved?.lastTest||null});
  const server=http.createServer(async(req,res)=>{
    try{
      const port=server.address().port;
      const allowedHosts=[`127.0.0.1:${port}`,`localhost:${port}`];
      if(!allowedHosts.includes(req.headers.host))throw new AppError('INVALID_HOST','仅限本机访问。',403);
      const url=new URL(req.url,'http://'+req.headers.host);
      if(url.pathname.startsWith('/api/')){
        if(req.headers.origin&&!allowedHosts.map(h=>'http://'+h).includes(req.headers.origin))throw new AppError('INVALID_ORIGIN','请求来源不匹配。',403);
        if(req.method==='GET'&&url.pathname==='/api/health')return respond(res,200,{app:'qiban',version:appVersion});
        if(req.method==='GET'&&url.pathname==='/api/ai/config')return respond(res,200,publicConfig());
        if(req.method!=='POST')throw new AppError('METHOD_NOT_ALLOWED','不支持的请求。',405);
        if(req.headers['x-qiban-token']!==token)throw new AppError('STALE_PAGE','页面已经更新，请刷新后重试。',403);
        if(!String(req.headers['content-type']).startsWith('application/json'))throw new AppError('CONTENT_TYPE','请求格式不正确。',415);
        const body=await readBody(req);
        if(url.pathname==='/api/ai/artifacts/upload')return respond(res,200,await saveArtifact(dataDir,body));
        if(url.pathname==='/api/ai/artifacts/read'){const artifact=await readArtifact(dataDir,body.id);return respond(res,200,artifact);}
        if(url.pathname==='/api/ai/config'){
          const config=normalizeConfig(body,saved?.config);
          saved={config,lastTest:null};await writePrivate(configFile,saved);
          return respond(res,200,publicConfig());
        }
        if(!saved?.config)throw new AppError('AI_NOT_CONFIGURED','先连接 AI，原文会继续保留。',409);
        if(url.pathname==='/api/ai/test'){
          if(active>=3)throw new AppError('AI_BUSY','还有几次反馈正在生成，稍等一下再试。',429);
          active++;const config={...saved.config};
          try{const out=await modelCall(config,'test',null);if(fingerprint(config)===fingerprint(saved.config)){saved.lastTest={ok:true,at:new Date().toISOString(),model:out.meta.model};await writePrivate(configFile,saved);}return respond(res,200,{...publicConfig(),ok:true});}
          catch(error){if(fingerprint(config)===fingerprint(saved.config)){saved.lastTest={ok:false,at:new Date().toISOString()};await writePrivate(configFile,saved);}throw error;}
          finally{active--;}
        }
        const kind=url.pathname==='/api/ai/feedback'?'feedback':url.pathname==='/api/ai/assist'?'assist':url.pathname==='/api/ai/stage'?'stage':url.pathname==='/api/ai/replace'?'replace':null;
        if(!kind)throw new AppError('NOT_FOUND','接口不存在。',404);
        if(typeof body.requestId!=='string'||!/^[A-Za-z0-9_-]{8,100}$/.test(body.requestId))throw new AppError('INVALID_ID','记录编号无效。');
        const context=await hydrateEvidence(dataDir,sanitizeContext(body.context,kind));
        const digest=fingerprint({kind,context});
        const id=body.requestId;
        const resultFile=path.join(dataDir,'results',id+'.json');
        const completed=await readJSON(resultFile);
        if(completed){if(completed.digest!==digest)throw new AppError('REQUEST_CHANGED','这条记录的上下文已经改变，请保留为新版本。',409);return respond(res,200,completed.output);}
        if(jobs.has(id)){const existing=jobs.get(id);if(existing.digest!==digest)throw new AppError('REQUEST_CHANGED','同一条记录不能覆盖原文。',409);return respond(res,200,await existing.promise);}
        if(active>=3)throw new AppError('AI_BUSY','还有几次反馈正在生成，稍等一下再试。',429);
        const config={...saved.config};active++;
        const promise=(async()=>{try{const output=await modelCall(config,kind,context);await writePrivate(resultFile,{digest,output});return output;}finally{active--;jobs.delete(id);}})();
        jobs.set(id,{digest,promise});
        return respond(res,200,await promise);
      }
      if(!['GET','HEAD'].includes(req.method))throw new AppError('METHOD_NOT_ALLOWED','不支持的请求。',405);
      let decoded;try{decoded=decodeURIComponent(url.pathname);}catch{throw new AppError('NOT_FOUND','页面不存在。',404);}
      if(['/', '/index.html','/'+homepage].includes(decoded)){
        let html=await readFile(path.join(root,'index.html'),'utf8');
        html=html.replace('</head>',`<meta name="qiban-session" content="${token}"></head>`);
        res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"});
        return res.end(req.method==='HEAD'?'':html);
      }
      const files={'/research-cards.js':['research-cards.js','application/javascript'],'/research-cards.css':['research-cards.css','text/css'],'/home-state.js':['home-state.js','application/javascript'],'/home-ui.js':['home-ui.js','application/javascript'],'/expedition-data.js':['expedition-data.js','application/javascript'],'/action-state.js':['action-state.js','application/javascript'],'/record-input.js':['record-input.js','application/javascript'],'/stage-state.js':['stage-state.js','application/javascript'],'/attachment-input.js':['attachment-input.js','application/javascript'],'/app.js':['app.js','application/javascript'],'/style.css':['style.css','text/css'],'/assets/qixi-editorial.png':['assets/qixi-editorial.png','image/png']};
      if(!files[decoded])throw new AppError('NOT_FOUND','页面不存在。',404);
      const [name,type]=files[decoded];const file=await readFile(path.join(root,name));res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?'':file);
    }catch(error){if(res.destroyed)return;const safe=error instanceof AppError?error:new AppError('LOCAL_ERROR','本地服务暂时无法完成请求。',500);respond(res,safe.status,{error:safe.code,message:safe.message});}
  });
  server.headersTimeout=15000;server.requestTimeout=90000;
  return {server,token};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const port=Number(process.env.QIBAN_GROWTH_PORT||52160);
  const {server}=await createApp({dataDir:process.env.QIBAN_GROWTH_DATA_DIR});
  server.on('error',error=>{console.error(error.code==='EADDRINUSE'?'端口已占用，请关闭旧预览或调整 QIBAN_GROWTH_PORT。':'本地服务启动失败。');process.exitCode=1;});
  server.listen(port,'127.0.0.1',()=>console.log(`栖伴 AI 原型：http://127.0.0.1:${port}/${encodeURIComponent(homepage)}`));
}
