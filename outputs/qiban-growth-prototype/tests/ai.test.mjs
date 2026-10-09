import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp,rm,readFile,stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { normalizeConfig,sanitizeContext,buildRequest,validateResult,callModel,AppError } from '../ai.mjs';
import { createApp } from '../server.mjs';

const config={baseUrl:'https://api.deepseek.com',model:'deepseek-flash',apiKey:'test-key-not-a-real-secret',format:'json_object',tokenField:'max_tokens'};
const context={goal:'把栖伴做成完整产品并发布上线',scope:'先自己用',branch:'做出可用的产品',task:{title:'给首页选一个主角',prompt:'第一眼想看到…',criteria:['有明确的首页主角','有一个选择理由']},current:'首页先放一个行动，因为我不想先整理计划。',provenance:'自己写下',previous:[]};
const feedback={grade:'A',title:'首页有了一个主角。',strength:'你明确了首页内容与原因。',hint:'下一次看一眼原型，确认第一眼是否真的落在这里。',comparison:'',checks:[{label:'有明确的首页主角',pass:true,evidence:'首页先放一个行动'},{label:'有一个选择理由',pass:true,evidence:'因为我不想先整理计划'}]};
const envelope=value=>new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify(value)}}],usage:{prompt_tokens:20,completion_tokens:40}}),{status:200});

test('normalizes compatible URL without moving credentials to another origin',()=>{
  assert.equal(normalizeConfig({...config,baseUrl:'https://api.deepseek.com/chat/completions/'}).baseUrl,config.baseUrl);
  assert.equal(normalizeConfig({...config,apiKey:''},config).apiKey,config.apiKey);
  assert.throws(()=>normalizeConfig({...config,baseUrl:'https://another.example',apiKey:''},config),/重新填写密钥/);
  for(const url of ['http://remote.example','https://user:pass@example.com','https://api.deepseek.com?key=abc','file:///tmp/key'])assert.throws(()=>normalizeConfig({...config,baseUrl:url}));
  assert.equal(normalizeConfig({...config,baseUrl:'http://127.0.0.1:1234/v1',apiKey:''}).apiKey,'');
});
test('DeepSeek request preserves model, disables default thinking and requests JSON',()=>{
  const body=buildRequest(config,'feedback',context);
  assert.equal(body.model,'deepseek-flash');assert.deepEqual(body.thinking,{type:'disabled'});
  assert.equal(body.max_tokens,2048);assert.deepEqual(body.response_format,{type:'json_object'});
  assert.equal(JSON.stringify(body).includes(config.apiKey),false);
  assert.equal(JSON.parse(body.messages[1].content).current,context.current);
});
test('input boundaries preserve literal records and bound history',()=>{
  assert.deepEqual(sanitizeContext(context,'feedback'),context);
  assert.throws(()=>sanitizeContext({...context,current:'x'.repeat(6001)},'feedback'));
  assert.throws(()=>sanitizeContext({...context,current:''},'feedback'));
  assert.throws(()=>sanitizeContext({...context,previous:Array(4).fill({text:'a'})},'feedback'));
  assert.equal(sanitizeContext({...context,current:''},'assist').current,'');
  assert.deepEqual(sanitizeContext({...context,constraints:['保留多个可选行动']},'feedback').constraints,['保留多个可选行动']);
  assert.throws(()=>sanitizeContext({...context,constraints:Array(9).fill('约束')},'feedback'));
});
test('AI evaluation requires the original rubric and verifiable quotes',()=>{
  assert.deepEqual(validateResult(feedback,'feedback',context),feedback);
  assert.throws(()=>validateResult({...feedback,grade:'SSSS'},'feedback',context));
  assert.throws(()=>validateResult({...feedback,checks:[{label:'已上线',pass:true,evidence:'上线了'}]},'feedback',context));
  assert.throws(()=>validateResult({...feedback,checks:feedback.checks.map(c=>({...c,evidence:'原文里没有这句话'}))},'feedback',context));
  assert.throws(()=>validateResult({...feedback,hint:undefined},'feedback',context));
});
test('real adapter shapes HTTP request and returns validated metadata',async()=>{
  let captured;
  const result=await callModel(config,'feedback',context,{fetchImpl:async(url,options)=>{captured={url,options};return envelope(feedback);}});
  assert.equal(captured.url,'https://api.deepseek.com/chat/completions');
  assert.equal(captured.options.headers.Authorization,'Bearer '+config.apiKey);
  assert.equal(captured.options.redirect,'error');
  assert.deepEqual(result.result,feedback);assert.equal(result.meta.model,'deepseek-flash');assert.equal(result.meta.provider,'api.deepseek.com');
  assert.equal(JSON.stringify(result).includes(config.apiKey),false);
});
test('upstream failures never leak its error body or become a local grade',async()=>{
  await assert.rejects(callModel(config,'feedback',context,{fetchImpl:async()=>new Response('secret '+config.apiKey,{status:401})}),e=>e.code==='AUTH_FAILED'&&!e.message.includes(config.apiKey));
  await assert.rejects(callModel(config,'feedback',context,{fetchImpl:async()=>envelope({grade:'A'})}),e=>e.code==='INVALID_AI_OUTPUT');
  await assert.rejects(callModel(config,'feedback',context,{fetchImpl:async()=>new Response(JSON.stringify({choices:[{finish_reason:'length',message:{content:'{}'}}]}))}),e=>e.code==='AI_TRUNCATED');
  await assert.rejects(callModel(config,'feedback',context,{fetchImpl:async()=>{throw new DOMException('secret','TimeoutError');}}),e=>e.code==='AI_TIMEOUT');
});
test('empty, fenced, refused and oversized output are handled',async()=>{
  const framed=new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:'```json\n'+JSON.stringify(feedback)+'\n```'}}]}));
  assert.equal((await callModel(config,'feedback',context,{fetchImpl:async()=>framed})).result.grade,'A');
  for(const message of [{content:''},{refusal:'拒绝',content:null}])await assert.rejects(callModel(config,'feedback',context,{fetchImpl:async()=>new Response(JSON.stringify({choices:[{message}]}))}));
  await assert.rejects(callModel(config,'feedback',context,{fetchImpl:async()=>new Response('x'.repeat(512001))}),e=>e.code==='RESPONSE_TOO_LARGE');
});

async function fixture(t,modelCall,initialConfig=config){
  const dir=await mkdtemp(path.join(os.tmpdir(),'qiban-ai-test-'));const app=await createApp({dataDir:dir,modelCall,initialConfig});
  app.server.listen(0,'127.0.0.1');await once(app.server,'listening');
  const url='http://127.0.0.1:'+app.server.address().port;
  t.after(async()=>{app.server.closeAllConnections();await new Promise(resolve=>app.server.close(resolve));await rm(dir,{recursive:true,force:true});});
  const post=(route,body,headers={})=>fetch(url+'/api/ai/'+route,{method:'POST',headers:{'Content-Type':'application/json','X-Qiban-Token':app.token,...headers},body:JSON.stringify(body)});
  return {...app,dir,url,post};
}
test('local service protects origins, session token, private paths, and secret reads',async t=>{
  const f=await fixture(t,async()=>({result:{ok:true},meta:{model:config.model}}));
  const info=await (await fetch(f.url+'/api/ai/config')).json();assert.equal(info.keySaved,true);assert.equal(JSON.stringify(info).includes(config.apiKey),false);
  assert.equal((await f.post('test',{}, {'X-Qiban-Token':'wrong'})).status,403);
  assert.equal((await f.post('test',{}, {Origin:'https://evil.example'})).status,403);
  assert.equal((await fetch(f.url+'/server.mjs')).status,404);
  assert.equal((await fetch(f.url+'/ai-config.json')).status,404);
  const html=await (await fetch(f.url)).text();assert.equal(html.includes(config.apiKey),false);assert.equal(html.includes('qiban-session'),true);
});
test('saved credentials are private and config never echoes the key',async t=>{
  const f=await fixture(t,async()=>({result:{ok:true},meta:{model:config.model}}));
  const response=await f.post('config',config);assert.equal(response.status,200);assert.equal((await response.text()).includes(config.apiKey),false);
  const file=path.join(f.dir,'ai-config.json');assert.equal((await stat(file)).mode&0o777,0o600);
  assert.equal(JSON.parse(await readFile(file,'utf8')).config.apiKey,config.apiKey);
  assert.equal((await f.post('test',{})).status,200);
});
test('same record is evaluated once for concurrent, retried and persisted requests',async t=>{
  let calls=0;const f=await fixture(t,async()=>{calls++;await new Promise(r=>setTimeout(r,30));return {result:feedback,meta:{model:'fixture'}};});
  const payload={requestId:'record-one',context};
  const responses=await Promise.all([f.post('feedback',payload),f.post('feedback',payload)]);
  assert.deepEqual(responses.map(r=>r.status),[200,200]);assert.equal(calls,1);
  assert.equal((await f.post('feedback',payload)).status,200);assert.equal(calls,1);
  assert.equal((await f.post('feedback',{...payload,context:{...context,current:'不能覆盖原文'}})).status,409);
  const cached=JSON.parse(await readFile(path.join(f.dir,'results','record-one.json'),'utf8'));assert.equal(cached.output.result.grade,'A');
});
test('failed request can be retried without creating a new action record',async t=>{
  let calls=0;const f=await fixture(t,async()=>{if(++calls===1)throw new AppError('AI_TIMEOUT','稍后重试',504);return {result:feedback,meta:{model:'fixture'}};});
  const payload={requestId:'record-retry',context};assert.equal((await f.post('feedback',payload)).status,504);assert.equal((await f.post('feedback',payload)).status,200);assert.equal(calls,2);
});
test('unconfigured service returns an explicit error with no synthetic feedback',async t=>{
  const f=await fixture(t,async()=>{throw Error('must not call');},null);
  const response=await f.post('feedback',{requestId:'record-empty',context});assert.equal(response.status,409);const data=await response.json();assert.equal(data.error,'AI_NOT_CONFIGURED');assert.equal('grade' in data,false);
});
