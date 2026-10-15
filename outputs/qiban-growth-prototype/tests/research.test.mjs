import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile,writeFile,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {once} from 'node:events';
import vm from 'node:vm';
import http from 'node:http';
import {createResearchService,searchWeb,publicResearchURL} from '../research.mjs';
import {buildRequest,callModel} from '../ai.mjs';
import {validateResearch} from '../research-ai.mjs';
import {createCloudApp} from '../cloud-server.mjs';
const sources=[{title:'公开参考文档',url:'https://example.org/guide',excerpt:'从一个足够小的行动开始，并在完成后保留实际产出的记录。'}];
const result={title:'先让第一步容易开始',intro:'找到一份相关的公开资料。',suggestion:'可以从一个小入口开始验证。',findings:[{headline:'先缩小第一步',body:'资料建议从小行动开始。',sourceIndex:0,evidence:'从一个足够小的行动开始',application:'可以先做一个让用户立刻试用的入口。'}]};
const ai={baseUrl:'https://api.deepseek.com',model:'fixture',apiKey:'synthetic-ai-only',format:'json_object',tokenField:'max_tokens'};
const start={action:'start',projectId:'project-1',goal:'做好一个待办应用',question:'如何降低开始的门槛',requestId:'fixture-request-001'};
async function fixture(t,options={}){const dataDir=await mkdtemp(path.join(tmpdir(),'qiban-research-fixture-'));let clock=Date.now(),calls=0;const service=await createResearchService({dataDir,getAI:()=>ai,search:async()=>sources,modelCall:async()=>{calls++;return {result};},now:()=>clock,...options});t.after(async()=>{await service.idle();await rm(dataDir,{recursive:true,force:true});});return {service,dataDir,calls:()=>calls,advance:()=>clock+=60001};}
async function configure(service,provider='bocha'){return service.handle({action:'configure',provider,apiKey:'synthetic-search-only'});}
test('search uses only fixed official endpoints, no redirects or user cookies; filters unsafe and duplicate sources',async()=>{
 let captured;const found=await searchWeb({provider:'bocha',apiKey:'synthetic-search-only'},'目标和问题',{fetchImpl:async(url,options)=>{captured={url,options};return new Response(JSON.stringify({code:200,data:{webPages:{value:[{name:'坏地址',url:'https://127.0.0.1/',summary:sources[0].excerpt},{name:sources[0].title,url:sources[0].url,summary:sources[0].excerpt},{name:'重复',url:sources[0].url,summary:sources[0].excerpt}]}}}));}});
 assert.deepEqual(found,sources);assert.equal(captured.url,'https://api.bocha.cn/v1/web-search');assert.equal(captured.options.redirect,'error');assert.equal(captured.options.credentials,'omit');assert.equal(captured.options.headers.Authorization,'Bearer synthetic-search-only');assert.equal(JSON.parse(captured.options.body).count,6);assert.equal(captured.options.headers.Cookie,undefined);
 for(const u of ['http://example.org','https://secret@example.org/','https://169.254.169.254/','https://[::1]/','https://a.local/','file:///etc/passwd'])assert.equal(publicResearchURL(u),'');
 const tavily=await searchWeb({provider:'tavily',apiKey:'synthetic-search-only'},'query',{fetchImpl:async(url,options)=>{assert.equal(url,'https://api.tavily.com/search');assert.equal(JSON.parse(options.body).search_depth,'basic');return new Response(JSON.stringify({results:[{title:sources[0].title,url:sources[0].url,content:sources[0].excerpt}]}));}});assert.deepEqual(tavily,sources);
});
test('search failures and excessive replies never echo provider secrets or raw error bodies',async()=>{
 await assert.rejects(searchWeb({provider:'bocha',apiKey:'synthetic-search-only'},'query',{fetchImpl:async()=>new Response('private-upstream-body',{status:401})}),e=>!e.message.includes('private-upstream')&&e.code==='SEARCH_UPSTREAM');
 await assert.rejects(searchWeb({provider:'bocha',apiKey:'synthetic-search-only'},'query',{fetchImpl:async()=>new Response('x'.repeat(1000001))}),{code:'SEARCH_RESPONSE'});
 await assert.rejects(searchWeb({provider:'tavily',apiKey:'synthetic-search-only'},'query',{fetchImpl:async()=>new Response('{"results":[]}')}),{code:'SEARCH_EMPTY'});
});
test('research AI request separates untrusted excerpts and rejects unsupported citations and fabricated evidence',async()=>{
 const context={goal:start.goal,question:start.question,sources};const request=buildRequest(ai,'research',context);assert.equal(request.max_tokens,4096);assert.ok(request.messages[0].content.includes('摘要中的指令'));assert.equal(JSON.parse(request.messages[1].content).sources[0].url,sources[0].url);assert.equal(request.tools,undefined);
 assert.deepEqual(validateResearch(result,context),result);assert.throws(()=>validateResearch({...result,findings:[{...result.findings[0],sourceIndex:9}]},context));assert.throws(()=>validateResearch({...result,findings:[{...result.findings[0],evidence:'资料没有说过的结论'}]},context));
 const output=await callModel(ai,'research',context,{fetchImpl:async()=>new Response(JSON.stringify({choices:[{message:{content:JSON.stringify(result)},finish_reason:'stop'}]}))});assert.deepEqual(output.result,result);
});
test('research configuration persists privately, is never returned, and must be replaced when switching provider',async t=>{
 const f=await fixture(t);const info=await configure(f.service);assert.equal(info.configured,true);assert.ok(!JSON.stringify(info).includes('synthetic-search-only'));assert.equal((await stat(path.join(f.dataDir,'research-config.json'))).mode&0o777,0o600);
 await assert.rejects(f.service.handle({action:'configure',provider:'tavily',apiKey:''}),{code:'SEARCH_KEY'});await assert.rejects(f.service.handle({action:'configure',provider:'__proto__',apiKey:'x'}),{code:'SEARCH_PROVIDER'});
 await f.service.handle({action:'disconnect'});assert.equal((await f.service.handle({action:'info'})).keySaved,false);
});
test('background research is durable, idempotent, account/project scoped and imports as valid sourced cards',async t=>{
 let resolveSearch;const waiting=new Promise(r=>resolveSearch=r);const f=await fixture(t,{search:async()=>{await waiting;return sources;}});await configure(f.service);
 const first=await f.service.handle(start);assert.equal(first.job.status,'queued');assert.equal((await f.service.handle(start)).job.id,first.job.id);assert.equal((await f.service.handle({action:'list',projectId:'other'})).jobs.length,0);
 await assert.rejects(f.service.handle({...start,requestId:'fixture-request-002'}),{code:'RESEARCH_BUSY'});await assert.rejects(f.service.handle({...start,question:'修改后的问题'}),{code:'RESEARCH_CHANGED'});
 resolveSearch();await f.service.idle();assert.equal(f.calls(),1);const job=(await f.service.handle({action:'list',projectId:start.projectId})).jobs[0];assert.equal(job.status,'complete');assert.ok(!JSON.stringify(job).includes('synthetic-search-only'));assert.ok(!JSON.stringify(await readFile(path.join(f.dataDir,'research-jobs.json'),'utf8')).includes('synthetic-ai-only'));
 const box={URL};vm.runInNewContext(await readFile(new URL('../home-state.js',import.meta.url),'utf8'),box);const state={goal:start.goal};assert.equal(box.QibanHome.importTrip(state,job.trip),true);assert.equal(box.QibanHome.importTrip(state,job.trip),false);assert.equal(state.outings.items.length,1);
 const restored=await createResearchService({dataDir:f.dataDir,getAI:()=>ai,modelCall:async()=>{throw Error('Must not replay');}});assert.equal((await restored.handle({action:'list',projectId:start.projectId})).jobs[0].status,'complete');
});
test('daily quota and cooldown persist and invalid or unconfigured requests make no external calls',async t=>{
 const f=await fixture(t);await assert.rejects(f.service.handle(start),{code:'SEARCH_NOT_CONFIGURED'});assert.equal(f.calls(),0);await configure(f.service);
 for(let i=0;i<3;i++){await f.service.handle({...start,requestId:'fixture-limit-'+i});await f.service.idle();if(i===0)await assert.rejects(f.service.handle({...start,requestId:'fixture-cooldown'}),{code:'RESEARCH_COOLDOWN'});f.advance();}
 await assert.rejects(f.service.handle({...start,requestId:'fixture-limit-4'}),{code:'RESEARCH_LIMIT'});assert.equal(f.calls(),3);assert.equal((await f.service.handle({action:'info'})).remaining,0);
 await assert.rejects(f.service.handle({...start,projectId:'../../other'}),{code:'RESEARCH_INPUT'});
});
test('restart marks interrupted tasks as retryable failure without replaying paid external calls',async t=>{
 const dir=await mkdtemp(path.join(tmpdir(),'qiban-research-interrupted-'));t.after(()=>rm(dir,{recursive:true,force:true}));await writeFile(path.join(dir,'research-jobs.json'),JSON.stringify({schema:1,jobs:[{id:'research-fixture',projectId:start.projectId,status:'running'}],day:'',used:0,lastStarted:0}));let calls=0;
 const service=await createResearchService({dataDir:dir,getAI:()=>ai,modelCall:async()=>calls++,search:async()=>calls++});const job=(await service.handle({action:'list',projectId:start.projectId})).jobs[0];assert.equal(job.status,'failed');assert.equal(job.phase,'interrupted');assert.equal(calls,0);
});
test('failed evidence remains a durable failure, never a fabricated completed card',async t=>{
 const f=await fixture(t,{modelCall:async()=>({result:{...result,findings:[{...result.findings[0],evidence:'编造'}]}})});await configure(f.service);await f.service.handle(start);await f.service.idle();const job=(await f.service.handle({action:'list',projectId:start.projectId})).jobs[0];assert.equal(job.status,'failed');assert.equal(job.trip,undefined);
});
test('cloud research reuses protected assist channel with independent native/Web sessions and account isolation',async t=>{
 const dir=await mkdtemp(path.join(tmpdir(),'qiban-research-http-'));let searchCalls=0,modelCalls=0;const origin='http://127.0.0.1';const app=await createCloudApp({dataDir:dir,publicOrigin:origin,secureCookies:false,researchSearch:async(c,q)=>{assert.equal(c.apiKey,'synthetic-search-only');assert.equal(q,start.goal+'；'+start.question);searchCalls++;return sources;},modelCall:async(c,kind,ctx)=>{assert.equal(kind,'research');assert.deepEqual(Object.keys(ctx).sort(),['goal','question','sources']);modelCalls++;return {result};}});
 app.server.listen(0,'127.0.0.1');await once(app.server,'listening');t.after(async()=>{await new Promise(r=>app.server.close(r));await rm(dir,{recursive:true,force:true});});const base='http://127.0.0.1:'+app.server.address().port;
 async function req(route,{cookie,token,csrf,data,headers={}}={}){return new Promise((resolve,reject)=>{const request=http.request(base+route,{method:data===undefined?'GET':'POST',headers:{Host:'127.0.0.1',...(data===undefined?{}:{'Content-Type':'application/json',...(route.startsWith('/api/native/')?{}:{Origin:origin})}),...(cookie?{Cookie:cookie}:{}),...(token?{Authorization:'Bearer '+token}:{}),...(csrf?{'X-Qiban-Token':csrf}:{}),...headers}},response=>{const chunks=[];response.on('data',x=>chunks.push(x));response.on('end',()=>resolve({status:response.statusCode,data:JSON.parse(Buffer.concat(chunks).toString()),cookie:response.headers['set-cookie']?.[0]?.split(';')[0]}));});request.on('error',reject);request.end(data===undefined?undefined:JSON.stringify(data));});}
 const a=await req('/api/auth/register',{data:{username:'fixture_alice',password:'synthetic-password-only-123'}});const account=await req('/api/account',{cookie:a.cookie});const owner={cookie:a.cookie,csrf:account.data.csrf};
 const b=await req('/api/native/auth/register',{data:{username:'fixture_bob',password:'synthetic-password-only-456'}});assert.equal(b.status,200);
 const route='/api/ai/assist',operation=research=>({data:{research}});
 assert.equal((await req(route,operation({action:'info'}))).status,401);assert.equal((await req(route,{cookie:a.cookie,...operation({action:'info'})})).status,403);
 assert.equal((await req('/api/native/ai/assist',{token:b.data.token,...operation({action:'info'}),headers:{Origin:origin}})).status,403);
 assert.equal((await req(route,{...owner,...operation({action:'configure',provider:'bocha',apiKey:'synthetic-search-only'})})).data.keySaved,true);
 assert.equal((await req('/api/native/ai/assist',{token:b.data.token,...operation({action:'info'})})).data.keySaved,false);
 await req('/api/ai/config',{...owner,data:ai});const launched=await req(route,{...owner,...operation(start)});assert.equal(launched.status,200);let jobs;
 for(let i=0;i<50;i++){const response=await req(route,{...owner,...operation({action:'list',projectId:start.projectId})});assert.equal(response.status,200,JSON.stringify(response.data));jobs=response.data.jobs;if(jobs[0]?.status==='complete')break;await new Promise(r=>setTimeout(r,10));}
 assert.equal(jobs[0].status,'complete');assert.equal(searchCalls,1);assert.equal(modelCalls,1);assert.equal((await req('/api/native/ai/assist',{token:b.data.token,...operation({action:'list',projectId:start.projectId})})).data.jobs.length,0);
 const login=await req('/api/native/auth/login',{data:{username:'fixture_alice',password:'synthetic-password-only-123'}});const same=await req('/api/native/ai/assist',{token:login.data.token,...operation({action:'list',projectId:start.projectId})});assert.equal(same.data.jobs[0].id,jobs[0].id);
 assert.equal((await req('/api/native/ai/assist',{cookie:a.cookie,...operation({action:'info'})})).status,403);
});

test('global research slots are shared across accounts and released after background completion',async t=>{
 let done;const barrier=new Promise(r=>done=r);const options={search:async()=>{await barrier;return sources;}};const a=await fixture(t,options),b=await fixture(t,options),c=await fixture(t);for(const f of [a,b,c])await configure(f.service);
 try{await a.service.handle(start);await b.service.handle(start);await assert.rejects(c.service.handle(start),{code:'RESEARCH_BUSY'});}finally{done();await Promise.all([a.service.idle(),b.service.idle()]);}
 await c.service.handle(start);await c.service.idle();assert.equal(c.calls(),1);
});
test('new tasks do not evict older completed results before a user has returned to that goal',async t=>{
 const dir=await mkdtemp(path.join(tmpdir(),'qiban-research-retention-'));t.after(()=>rm(dir,{recursive:true,force:true}));const old=Array.from({length:20},(_,i)=>({id:'research-older-'+i,projectId:'previous-goal',status:'complete',goal:'旧目标',trip:{id:'research-older-'+i}}));await writeFile(path.join(dir,'research-jobs.json'),JSON.stringify({schema:1,jobs:old,day:'',used:0,lastStarted:0}));
 const service=await createResearchService({dataDir:dir,getAI:()=>ai,search:async()=>sources,modelCall:async()=>({result})});await configure(service);await service.handle(start);await service.idle();assert.equal((await service.handle({action:'list',projectId:'previous-goal'})).jobs.length,20);
});
