import http from 'node:http';
import {randomBytes,createHash,scrypt,timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
import {readFile,writeFile,mkdir,rename,rm,readdir,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createApp} from './server.mjs';
import {AppError} from './ai.mjs';

const root=path.dirname(fileURLToPath(import.meta.url));
const derive=promisify(scrypt),hash=s=>createHash('sha256').update(s).digest('hex');
const DAY=86400000,MAX_WORKSPACE=12*1024*1024;
// Only anonymous, account-independent application assets may be published here.
const publicFiles=new Map([
  ['/login',['cloud-login.html','text/html; charset=utf-8']],
  ...['cloud-storage','platform','project-state','research-cards','home-state','home-ui','expedition-data','action-state','record-input','stage-state','attachment-input','app'].map(n=>['/'+n+'.js',[n+'.js','application/javascript; charset=utf-8']]),
  ['/login.js',['cloud-login.js','application/javascript; charset=utf-8']],
  ...['project','research-cards','style'].map(n=>['/'+n+'.css',[n+'.css','text/css; charset=utf-8']]),
  ['/assets/qixi-editorial.png',['assets/qixi-editorial.png','image/png']],
  ['/manifest.webmanifest',['manifest.webmanifest','application/manifest+json; charset=utf-8']],
  ['/service-worker.js',['service-worker.js','application/javascript; charset=utf-8']],
  ...['icon-192','icon-512','icon-maskable-512'].map(n=>['/icons/'+n+'.png',['icons/'+n+'.png','image/png']]),
]);
function hasScript(html,name){return new RegExp('<script\\b[^>]*\\bsrc=[\"\']/?'+name.replace('.', '\\.')+'[\"\'][^>]*>', 'i').test(html);}
function cloudAdditions(html){return '<meta name="theme-color" content="#f5f2ec"><link rel="manifest" href="/manifest.webmanifest"><link rel="apple-touch-icon" href="/icons/icon-192.png">'+(/<meta\b[^>]*name=["']qiban-cloud["']/i.test(html)?'':'<meta name="qiban-cloud" content="true">')+(hasScript(html,'platform.js')?'':'<script src="/platform.js"></script>')+(hasScript(html,'cloud-storage.js')?'':'<script src="/cloud-storage.js"></script>');}
const pageHeaders={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"};
const providers=['api.deepseek.com','api.openai.com','api.moonshot.cn','api.moonshot.ai','api.siliconflow.cn','dashscope.aliyuncs.com','dashscope-intl.aliyuncs.com'];
async function json(file,fallback=null){try{return JSON.parse(await readFile(file,'utf8'));}catch(e){if(e.code==='ENOENT')return fallback;throw e;}}
async function atomic(file,value){await mkdir(path.dirname(file),{recursive:true,mode:0o700});const temp=file+'.'+randomBytes(8).toString('hex')+'.tmp';await writeFile(temp,JSON.stringify(value),{mode:0o600});await rename(temp,file);}
function fail(status,message){throw Object.assign(new Error(message),{status});}
function send(res,status,value,headers={}){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers});res.end(JSON.stringify(value));}
async function body(req,limit=16384){let size=0;const chunks=[];for await(const c of req){size+=c.length;if(size>limit)fail(413,'内容太大，请先导出并整理记录。');chunks.push(c);}try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{fail(400,'内容格式无法读取。');}}
function validWorkspace(w){
  if(!w||w.schema!==2||!Array.isArray(w.projects)||!w.projects.length||w.projects.length>200)fail(400,'目标列表格式不完整。');
  const ids=new Set();for(const p of w.projects){
    if(!p||typeof p.id!=='string'||p.id.length>100||ids.has(p.id)||p.schema!==1||typeof p.goal!=='string'||p.goal.length>120||!['active','completed','shelved'].includes(p.status))fail(400,'目标记录格式不完整。');
    ids.add(p.id);
    for(const k of ['branches','tasks','attempts','snapshots','customTasks','stageRounds','closures'])if(!Array.isArray(p[k]))fail(400,'目标记录格式不完整。');
    for(const k of ['drafts','accepted','stageWork'])if(!p[k]||typeof p[k]!=='object'||Array.isArray(p[k]))fail(400,'目标记录格式不完整。');
    if(!p.branches.length||p.branches.length>6)fail(400,'阶段格式不完整。');
  }
  if(!ids.has(w.selectedId))fail(400,'当前目标无法读取。');
}

export async function createCloudApp({dataDir,publicOrigin,secureCookies=true,maxUsers=100,modelCall,allowedProviders=providers,now=()=>Date.now()}={}){
  const origin=new URL(publicOrigin);
  if(origin.pathname!=='/'||origin.search||origin.hash||origin.username||origin.password||!(origin.protocol==='https:'||(!secureCookies&&origin.protocol==='http:')))throw Error('Set an HTTPS QIBAN_PUBLIC_ORIGIN.');
  dataDir=path.resolve(dataDir);await mkdir(dataDir,{recursive:true,mode:0o700});
  for(const dir of ['accounts','sessions','users'])await mkdir(path.join(dataDir,dir),{recursive:true,mode:0o700});
  const cookieName=secureCookies?'__Host-qiban':'qiban-local';
  const locks=new Map(),apps=new Map(),rates=new Map();let authActive=0,totalAI=0;
  async function locked(key,fn){const previous=locks.get(key)||Promise.resolve();const next=previous.catch(()=>{}).then(fn);locks.set(key,next);try{return await next;}finally{if(locks.get(key)===next)locks.delete(key);}}
  function rate(key,limit,window=15*60000){const t=now();for(const [k,v]of rates)if(t-v.at>window)rates.delete(k);const entry=rates.get(key)||{at:t,count:0};if(t-entry.at>window){entry.at=t;entry.count=0;}if(++entry.count>limit)fail(429,'尝试太频繁，请稍后再试。');rates.set(key,entry);}
  function validateProvider(c){const u=new URL(c.baseUrl);if(u.protocol!=='https:'||u.port||!allowedProviders.includes(u.hostname))throw new AppError('INVALID_PROVIDER','请选择受支持的 AI 服务地址（DeepSeek、OpenAI、Moonshot、SiliconFlow 或 DashScope）。');}
  async function appFor(id){
    if(!apps.has(id)){const promise=(async()=>{const pageMeta=cloudAdditions(await readFile(path.join(root,'index.html'),'utf8'));const app=await createApp({dataDir:path.join(dataDir,'users',id),pageMeta,configValidator:validateProvider,modelCall:async(...args)=>{validateProvider(args[0]);if(totalAI>=6)throw new AppError('AI_BUSY','当前请求较多，请稍后再试。',429);totalAI++;try{return await (modelCall||(await import('./ai.mjs')).callModel)(...args);}finally{totalAI--;}}});app.server.address=()=>({port:52160});return app;})().catch(e=>{apps.delete(id);throw e;});apps.set(id,promise);}
    return apps.get(id);
  }
  function sessionToken(req,channel){
    if(channel==='native'){
      const match=/^Bearer ([a-f0-9]{64})$/.exec(String(req.headers.authorization||''));return match?.[1]||null;
    }
    return String(req.headers.cookie||'').split(';').map(v=>v.trim()).find(v=>v.startsWith(cookieName+'='))?.slice(cookieName.length+1)||null;
  }
  async function sessionFor(req,channel){
    const token=sessionToken(req,channel);if(!token||!/^[a-f0-9]{64}$/.test(token))return null;
    const session=await json(path.join(dataDir,'sessions',hash(token)+'.json'));
    // Sessions written by v0.8.0 are web sessions; no bearer compatibility shortcut.
    if(!session||session.expires<=now()||(session.channel||'web')!==channel)return null;return session;
  }
  function cookie(value,age=7*86400){return `${cookieName}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${secureCookies?'; Secure':''}`;}
  async function startSession(account,res,channel){
    const token=randomBytes(32).toString('hex'),session={id:account.id,username:account.username,channel,expires:now()+7*DAY};
    // Five sessions total across platforms, persisted as hashes only.
    const files=await readdir(path.join(dataDir,'sessions'));const own=[];
    for(const f of files){if(!/^[a-f0-9]{64}\.json$/.test(f))continue;const p=path.join(dataDir,'sessions',f),s=await json(p);if(!s)continue;if(s.expires<=now())await rm(p,{force:true});else if(s.id===account.id)own.push({p,expires:s.expires});}
    own.sort((a,b)=>a.expires-b.expires);for(const s of own.slice(0,Math.max(0,own.length-4)))await rm(s.p);
    await atomic(path.join(dataDir,'sessions',hash(token)+'.json'),session);
    if(channel==='native')return send(res,200,{ok:true,token,accountId:account.id,username:account.username,expires:session.expires});
    send(res,200,{ok:true},{'Set-Cookie':cookie(token)});
  }
  async function authenticate(req,res,register,channel){
    const ip=String(req.headers['x-forwarded-for']||req.socket.remoteAddress).split(',').at(-1).trim();rate('auth:'+ip,30);rate('all-auth',300);
    if(authActive>=3)fail(429,'当前登录请求较多，请稍后重试。');
    const input=await body(req);const username=typeof input?.username==='string'?input.username.trim().toLowerCase():'';const password=input?.password;
    if(!/^[a-z0-9][a-z0-9_-]{2,31}$/.test(username)||typeof password!=='string'||password.length<12||password.length>128)fail(400,'账号使用 3–32 位字母、数字、下划线或短横线；密码使用 12–128 个字符。');
    const file=path.join(dataDir,'accounts',hash(username)+'.json');
    // Reserve after reading the body as concurrent uploads can pass the early check.
    if(authActive>=3)fail(429,'当前登录请求较多，请稍后重试。');authActive++;
    try{
      if(register){rate('register:'+ip,5,3600000);rate('all-register',20,3600000);await locked('accounts',async()=>{
        if(await json(file))fail(409,'这个账号名称已被使用。');if((await readdir(path.join(dataDir,'accounts'))).filter(f=>f.endsWith('.json')).length>=maxUsers)fail(403,'当前注册名额已满。');
        const salt=randomBytes(16).toString('hex'),key=await derive(password,salt,64,{N:32768,r:8,p:1,maxmem:64*1024*1024});
        const account={id:randomBytes(16).toString('hex'),username,salt,passwordHash:key.toString('hex'),createdAt:new Date(now()).toISOString()};await atomic(file,account);await startSession(account,res,channel);
      });}else{const account=await json(file);const salt=account?.salt||'qiban-dummy-password-salt';const key=await derive(password,salt,64,{N:32768,r:8,p:1,maxmem:64*1024*1024});const expected=account?Buffer.from(account.passwordHash,'hex'):Buffer.alloc(64);if(!timingSafeEqual(key,expected)||!account)fail(401,'账号或密码不正确。');await locked('sessions:'+account.id,()=>startSession(account,res,channel));}
    }finally{authActive--;}
  }
  async function publicAsset(req,res,p){
    if(!['GET','HEAD'].includes(req.method)||!(p==='/app-shell.html'||publicFiles.has(p)))return false;
    let content,type;
    try{
      if(p==='/app-shell.html'){
        type='text/html; charset=utf-8';content=await readFile(path.join(root,'index.html'),'utf8');
        content=content.replace(/<meta\b[^>]*name=["']qiban-session["'][^>]*>/gi,'').replace('</head>',cloudAdditions(content)+'</head>');
      }else{
        const [name,mime]=publicFiles.get(p);type=mime;content=await readFile(path.join(root,name));
        if(p==='/login'){content=content.toString('utf8');if(!hasScript(content,'platform.js'))content=content.replace('</head>','<script src="/platform.js"></script></head>');}
      }
    }catch(e){if(e.code==='ENOENT')fail(404,'页面不存在。');throw e;}
    res.writeHead(200,{'Content-Type':type,...pageHeaders,...(p==='/service-worker.js'?{'Cache-Control':'no-cache','Service-Worker-Allowed':'/'}:{})});res.end(req.method==='HEAD'?'':content);return true;
  }
  async function enforceWriteLimit(id){
    const files=await readdir(path.join(dataDir,'users',id));let used=0;
    for(const name of files){const dir=path.join(dataDir,'users',id,name),info=await stat(dir);if(info.isDirectory())for(const f of await readdir(dir))used+=(await stat(path.join(dir,f))).size;else used+=info.size;}
    if(used>200*1024*1024)fail(413,'个人空间已达 200 MB，请联系服务器管理员扩容。');
    rate('api:'+id,120,60000);
  }
  const server=http.createServer(async(req,res)=>{
    try{
      if(req.headers.host!==origin.host)fail(403,'访问地址不匹配。');
      const url=new URL(req.url,origin),publicPath=url.pathname;
      const native=publicPath.startsWith('/api/native/'),channel=native?'native':'web',p=native?'/api/'+publicPath.slice('/api/native/'.length):publicPath;
      // Native clients use an OS-mediated network bridge. Browser credentials and
      // browser Origin headers never enter this independent authentication channel.
      if(native){
        if(req.headers.cookie||req.headers.origin)fail(403,'请使用应用的独立登录连接。');
      }else if(req.headers.authorization)fail(403,'请使用网页的登录会话。');
      if(req.method==='POST'){
        if(!native&&req.headers.origin!==origin.origin)fail(403,'请求来源不匹配，请从本站页面操作。');
        if(!/^application\/json(?:\s*;|$)/i.test(String(req.headers['content-type'])))fail(415,'请使用 JSON 请求。');
      }
      if(req.method==='GET'&&p==='/api/health')return send(res,200,{app:'qiban',version:'0.9.0-beta.1',mode:'multiuser',apiVersion:1});
      if(!native&&await publicAsset(req,res,p))return;
      if(req.method==='POST'&&(p==='/api/auth/login'||p==='/api/auth/register')){
        if(native&&req.headers.authorization)fail(403,'请先退出当前应用账号。');
        return await authenticate(req,res,p.endsWith('register'),channel);
      }
      const session=await sessionFor(req,channel);
      if(!session){if(p.startsWith('/api/'))return send(res,401,{message:'请先登录栖伴。'});res.writeHead(303,{Location:'/login','Cache-Control':'no-store'});return res.end();}
      res.setHeader('X-Qiban-Account',session.id);
      const app=await appFor(session.id);
      if(req.method==='GET'&&p==='/api/account')return send(res,200,native?{accountId:session.id,username:session.username,expires:session.expires}:{accountId:session.id,username:session.username,expires:session.expires,csrf:app.token});
      if(req.method==='POST'&&!native&&req.headers['x-qiban-token']!==app.token)fail(403,'页面已更新，请刷新后继续。');
      if(req.method==='POST'&&p==='/api/auth/logout'){
        await rm(path.join(dataDir,'sessions',hash(sessionToken(req,channel))+'.json'),{force:true});
        return send(res,200,{ok:true},native?{}:{'Set-Cookie':cookie('',0)});
      }
      if(req.method==='POST')await enforceWriteLimit(session.id);
      const stateFile=path.join(dataDir,'users',session.id,'workspace.json');
      if(req.method==='GET'&&p==='/api/workspace')return send(res,200,{...await json(stateFile,{revision:0,workspace:null}),accountId:session.id});
      if(req.method==='POST'&&p==='/api/workspace'){
        const input=await body(req,MAX_WORKSPACE);validWorkspace(input?.workspace);
        return await locked('state:'+session.id,async()=>{const old=await json(stateFile,{revision:0,workspace:null});if(input.revision!==old.revision)fail(409,'另一个页面已保存新内容。请先导出当前改动，再刷新。');const next={revision:old.revision+1,workspace:input.workspace};await atomic(stateFile,next);send(res,200,{revision:next.revision,accountId:session.id});});
      }
      // The principal selects the isolated app; no URL parameter selects a user.
      if(p.startsWith('/api/')&&!p.startsWith('/api/ai/'))fail(404,'接口不存在。');
      req.headers.host='127.0.0.1:52160';delete req.headers.origin;delete req.headers.authorization;
      if(native){req.url=p+url.search;req.headers['x-qiban-token']=app.token;}
      app.server.emit('request',req,res);
    }catch(e){if(!res.destroyed&&!res.headersSent)send(res,e.status||500,{message:e.status?e.message:'服务暂时无法完成请求。'});}
  });
  server.headersTimeout=15000;server.requestTimeout=90000;
  return {server};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const {server}=await createCloudApp({dataDir:process.env.QIBAN_CLOUD_DATA_DIR||'/var/lib/qiban',publicOrigin:process.env.QIBAN_PUBLIC_ORIGIN,maxUsers:Number(process.env.QIBAN_MAX_USERS||100)});
  server.listen(Number(process.env.QIBAN_CLOUD_PORT||52160),'127.0.0.1',()=>console.log('Qiban multiuser service ready (loopback only).'));
}
