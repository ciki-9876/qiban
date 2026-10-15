import {readFile,writeFile,mkdir,rename,chmod} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import path from 'node:path';
import {AppError} from './ai.mjs';
import {validateResearch} from './research-ai.mjs';
export const searchProviders=Object.freeze({bocha:{label:'博查',url:'https://api.bocha.cn/v1/web-search'},tavily:{label:'Tavily',url:'https://api.tavily.com/search'}});
const DAY=86400000,DAILY_LIMIT=3;let globalActive=0;
const error=(code,message,status=422)=>new AppError(code,message,status);
const text=(v,n,label,required=true)=>{if(typeof v!=='string'||v.length>n||(required&&!v.trim()))throw error('RESEARCH_INPUT',label+'不完整或过长。');return v.trim();};
async function json(file,fallback){try{return JSON.parse(await readFile(file,'utf8'));}catch(e){if(e.code==='ENOENT')return fallback;throw e;}}
async function atomic(file,value){await mkdir(path.dirname(file),{recursive:true,mode:0o700});const temp=file+'.'+randomBytes(8).toString('hex')+'.tmp';await writeFile(temp,JSON.stringify(value),{mode:0o600});await chmod(temp,0o600);await rename(temp,file);}
export function publicResearchURL(raw){try{const u=new URL(raw);const h=u.hostname;if(u.protocol!=='https:'||u.username||u.password||u.port||!h.includes('.')||/[\[\]:]/.test(h)||/^[\d.]+$/.test(h)||/(^|\.)(localhost|local|internal|test|invalid)$/.test(h)||u.href.length>2000)return '';u.hash='';return u.href;}catch{return '';}}
export async function searchWeb(config,query,{fetchImpl=fetch}={}){
 const provider=searchProviders[config.provider];if(!provider||!config.apiKey)throw error('SEARCH_NOT_CONFIGURED','先连接检索服务。',409);
 const body=config.provider==='bocha'?{query,summary:true,count:6,freshness:'noLimit'}:{query,search_depth:'basic',max_results:6,include_answer:false,include_raw_content:false,include_images:false,auto_parameters:false,topic:'general'};
 let response;
 try{response=await fetchImpl(provider.url,{method:'POST',redirect:'error',credentials:'omit',signal:AbortSignal.timeout(25000),headers:{'Content-Type':'application/json',Authorization:'Bearer '+config.apiKey},body:JSON.stringify(body)});}catch{throw error('SEARCH_NETWORK','暂时连不上检索服务，请稍后重试。',502);}
 if(!response.ok){await response.body?.cancel();throw error('SEARCH_UPSTREAM',response.status===401||response.status===403?'检索密钥未通过验证，请检查检索连接。':response.status===429?'检索服务额度不足或请求过多，请稍后重试。':'检索服务暂时不可用，请稍后重试。',502);}
 let data;try{let size=0;const chunks=[];for await(const part of response.body){size+=part.length;if(size>1000000)throw Error('Too large');chunks.push(part);}data=JSON.parse(Buffer.concat(chunks).toString());}catch{await response.body?.cancel().catch(()=>{});throw error('SEARCH_RESPONSE','检索服务返回的资料无法读取。',502);}
 if(config.provider==='bocha'&&data.code!==undefined&&data.code!==200)throw error('SEARCH_UPSTREAM','检索服务没有完成请求，请检查密钥及额度。',502);
 const rows=config.provider==='bocha'?(data.data?.webPages?.value||data.webPages?.value):data.results;const seen=new Set(),sources=[];
 for(const row of Array.isArray(rows)?rows.slice(0,20):[]){const url=publicResearchURL(row.url);const excerpt=String(row.summary||row.content||row.snippet||'').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g,'').trim().slice(0,1800),title=String(row.name||row.title||'').trim().slice(0,120);if(!url||seen.has(url)||excerpt.length<16||!title)continue;seen.add(url);sources.push({title,url,excerpt});if(sources.length===6)break;}
 if(!sources.length)throw error('SEARCH_EMPTY','这次没有找到足够可用的公开资料。可以把问题写得更具体后再试。',502);return sources;
}
export async function createResearchService({dataDir,getAI,modelCall,search=searchWeb,now=()=>Date.now(),reserve=()=>{},release=()=>{}}){
 const stateFile=path.join(dataDir,'research-jobs.json'),configFile=path.join(dataDir,'research-config.json');
 let state=await json(stateFile,{schema:1,jobs:[],day:'',used:0,lastStarted:0}),config=await json(configFile,null),tail=Promise.resolve();
 // Do not replay external calls after a restart: a provider may already have charged for them.
 if(state.jobs.some(j=>['queued','running'].includes(j.status))){state={...state,jobs:state.jobs.map(j=>['queued','running'].includes(j.status)?{...j,status:'failed',phase:'interrupted',message:'服务重启中断了这次调研，可以重新发起。',updatedAt:new Date(now()).toISOString()}:j)};await atomic(stateFile,state);}
 const locked=fn=>{const next=tail.catch(()=>{}).then(fn);tail=next;return next;};
 const persist=async next=>{await atomic(stateFile,next);state=next;};
 const day=()=>new Date(now()+8*3600000).toISOString().slice(0,10);
 const info=()=>({configured:Boolean(config?.apiKey),provider:config?.provider||'bocha',keySaved:Boolean(config?.apiKey),aiConfigured:Boolean(getAI()?.model),dailyLimit:DAILY_LIMIT,remaining:Math.max(0,DAILY_LIMIT-(state.day===day()?state.used:0))});
 const update=(id,patch)=>locked(()=>persist({...state,jobs:state.jobs.map(j=>j.id===id?{...j,...patch,updatedAt:new Date(now()).toISOString()}:j)}));
 async function run(job,searchConfig,aiConfig){
  try{
   await update(job.id,{status:'running',phase:'searching'});
   const sources=await search(searchConfig,[job.goal,job.question].filter(Boolean).join('；'));
   await update(job.id,{phase:'organizing'});
   const context={goal:job.goal,question:job.question,sources};const output=await modelCall(aiConfig,'research',context);let result;
   try{result=validateResearch(output.result,context);}catch{throw error('RESEARCH_EVIDENCE','整理结果没有通过来源核对，请调整问题后重试。',502);}
   const completedAt=new Date(now()).toISOString();
   const trip={schema:'qiban-expedition-v1',id:job.id,goal:job.goal,completedAt,title:result.title,intro:result.intro,suggestion:result.suggestion,sources:sources.map(s=>({title:s.title,url:s.url,note:s.excerpt.slice(0,350)})),findings:result.findings.map((f,i)=>({id:'finding-'+i,kind:'联网调研',layout:'note',teaser:f.headline.slice(0,40),headline:f.headline,body:f.body,attribution:sources[f.sourceIndex].title,sourceIndexes:[f.sourceIndex],checkedAt:completedAt,voice:f.application,evidenceNote:`检索摘要摘录：“${f.evidence}”。基于这段摘要整理，未读取完整网页。`,application:{title:'可以试试',body:f.application}}))};
   await update(job.id,{status:'complete',phase:'complete',trip});
  }catch(e){await update(job.id,{status:'failed',phase:'failed',message:e instanceof AppError?e.message:'这次调研未完成，可以稍后重试。'});}
  finally{globalActive--;release();}
 }
 async function handle(input){return locked(async()=>{
  if(!input||typeof input!=='object'||Array.isArray(input))throw error('RESEARCH_INPUT','调研请求格式不正确。');
  if(input.action==='info')return info();
  if(input.action==='configure'){
   if(!Object.hasOwn(searchProviders,input.provider))throw error('SEARCH_PROVIDER','请选择博查或 Tavily。');
   const key=text(input.apiKey??'',4096,'检索密钥',false);if(/[\r\n]/.test(key))throw error('SEARCH_KEY','检索密钥格式不正确。');
   if(!key&&(!config?.apiKey||config.provider!==input.provider))throw error('SEARCH_KEY','切换检索服务时，请填写对应的密钥。');
   const next={provider:input.provider,apiKey:key||config.apiKey};await atomic(configFile,next);config=next;return info();
  }
  if(input.action==='disconnect'){await atomic(configFile,null);config=null;return info();}
  const projectId=text(input.projectId,100,'目标编号');if(!/^[A-Za-z0-9_-]+$/.test(projectId))throw error('RESEARCH_INPUT','目标编号不正确。');
  if(input.action==='list')return {...info(),jobs:state.jobs.filter(j=>j.projectId===projectId).map(j=>({...j}))};
  if(input.action!=='start')throw error('RESEARCH_INPUT','不支持的调研操作。');
  const requestId=text(input.requestId,80,'请求编号');if(!/^[A-Za-z0-9_-]{8,80}$/.test(requestId))throw error('RESEARCH_INPUT','请求编号不正确。');
  const goal=text(input.goal,120,'目标'),question=text(input.question??'',240,'问题',false),id='research-'+requestId;
  const previous=state.jobs.find(j=>j.id===id);if(previous){if(previous.projectId!==projectId||previous.goal!==goal||previous.question!==question)throw error('RESEARCH_CHANGED','同一次调研的内容已经改变。',409);return {job:previous,...info()};}
  if(!config?.apiKey)throw error('SEARCH_NOT_CONFIGURED','先连接检索服务，再让栖栖出去找找。',409);
  const aiConfig=getAI();if(!aiConfig?.model)throw error('AI_NOT_CONFIGURED','先在 AI 连接中配置用于整理资料的模型。',409);
  if(state.jobs.some(j=>['queued','running'].includes(j.status)))throw error('RESEARCH_BUSY','栖栖正在调研，完成后再发起下一次。',429);
  if(globalActive>=2)throw error('RESEARCH_BUSY','当前调研较多，请稍后再试。',429);
  const used=state.day===day()?state.used:0;if(used>=DAILY_LIMIT)throw error('RESEARCH_LIMIT','今天已发起 3 次调研，明天再来看看。',429);
  if(state.lastStarted&&now()-state.lastStarted<60000)throw error('RESEARCH_COOLDOWN','稍等一分钟，再发起新的调研。',429);
  if(state.jobs.length>=200)throw error('RESEARCH_STORAGE','调研任务已达保存上限，请联系管理员整理；已有结果仍可查看。',409);
  const timestamp=new Date(now()).toISOString(),job={id,projectId,goal,question,status:'queued',phase:'queued',createdAt:timestamp,updatedAt:timestamp};
  reserve();globalActive++;
  try{await persist({...state,day:day(),used:used+1,lastStarted:now(),jobs:[...state.jobs,job]});}catch(e){globalActive--;release();throw e;}
  queueMicrotask(()=>{void run(job,{...config},{...aiConfig}).catch(()=>{});});return {job,...info()};
 });}
 return {handle,idle:async()=>{while(state.jobs.some(j=>['queued','running'].includes(j.status))){await new Promise(r=>setTimeout(r,10));await tail;}}};
}
