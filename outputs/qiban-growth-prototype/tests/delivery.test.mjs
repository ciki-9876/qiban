import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile,stat} from 'node:fs/promises';
import {once} from 'node:events';
import os from 'node:os';
import path from 'node:path';
import {prepareArtifact,saveArtifact,readArtifact,hydrateEvidence} from '../artifacts.mjs';
import {sanitizeContext,validateResult,buildRequest} from '../ai.mjs';
import {createApp} from '../server.mjs';
const file=prepareArtifact({name:'rabbit.html',base64:Buffer.from('<style>.rabbit{animation:breath 4s infinite}@keyframes breath{50%{transform:scale(1.015)}}</style><div class="rabbit">兔子</div>').toString('base64')});
const contract={kind:'artifact',outcome:'首页兔子按方案呼吸',criteria:[{label:'代码包含 4 秒呼吸动画',method:'content'},{label:'实际呼吸轻微且自然',method:'experience'}]};
const context={goal:'把栖伴做成完整产品并发布上线',scope:'自己用',branch:'产品',task:{title:'做出兔子呼吸',prompt:'做出了…',criteria:contract.criteria.map(c=>c.label),contract},current:'加上了兔子呼吸。',previous:[],delivery:{artifactIds:[file.id],link:'http://127.0.0.1:52160/',observation:'我打开首页，看见兔子轻微起伏。',confirmed:[1],artifacts:[file]}};
const feedback={grade:'A',title:'呼吸效果留下来了',strength:'代码包含 4 秒循环；效果由本人确认。',hint:'再润色一句',comparison:'',checks:[{label:contract.criteria[0].label,pass:true,evidence:'animation:breath 4s infinite',source:file.id},{label:contract.criteria[1].label,pass:true,evidence:'兔子轻微起伏',source:'observation'}]};
test('artifact extraction preserves original, strips embedded data, marks excerpts',()=>{
  const raw='a'.repeat(25000)+'data:image/png;base64,'+'A'.repeat(400);const a=prepareArtifact({name:'demo.html',base64:Buffer.from(raw).toString('base64')});
  assert.equal(Buffer.from(a.base64,'base64').toString(),raw);assert.equal(a.truncated,true);assert.equal(a.omittedEmbedded,true);assert.equal(a.content.length,24000);
  assert.equal(prepareArtifact({name:'photo.png',base64:'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1cAAAAASUVORK5CYII='}).content,'');
  for(const name of ['../x.html','bad.exe','x\n.html'])assert.throws(()=>prepareArtifact({name,base64:'YQ=='}));
  assert.throws(()=>prepareArtifact({name:'x.txt',base64:'bad!'}));
  assert.throws(()=>prepareArtifact({name:'x.txt',base64:Buffer.from([255]).toString('base64')}));
});
test('contracts, reference, URL schemes, and self-report boundaries are validated',()=>{
  const clean=sanitizeContext({...context,task:{...context.task,reference:'原方案'}},'feedback');
  assert.equal(clean.task.reference,'原方案');assert.equal('artifacts' in clean.delivery,false);
  for(const link of ['javascript:alert(1)','file:///etc/passwd','https://u:p@example.com'])assert.throws(()=>sanitizeContext({...context,delivery:{...context.delivery,link}},'feedback'));
  assert.throws(()=>sanitizeContext({...context,delivery:{...context.delivery,confirmed:[0]}},'feedback'));
  assert.throws(()=>sanitizeContext({...context,delivery:{...context.delivery,observation:''}},'feedback'));
  assert.throws(()=>sanitizeContext({...context,task:{...context.task,criteria:['换掉标尺']}},'feedback'));
});
test('source citations cannot be forged or promote a self-report into AI verification',()=>{
  const result=validateResult(feedback,'feedback',context);
  assert.equal(result.grade,'A');assert.equal(result.scope,'mixed');assert.equal(result.checks[1].status,'self');assert.equal(result.hint,'');
  const bad=structuredClone(feedback);bad.checks[0].source='current';assert.throws(()=>validateResult(bad,'feedback',context));
  bad.checks[0]={...feedback.checks[0],evidence:'已访问网址，运行正常'};assert.throws(()=>validateResult(bad,'feedback',context));
  assert.throws(()=>validateResult(feedback,'feedback',{...context,delivery:{...context.delivery,confirmed:[]}}));
});
test('runtime not confirmed means no final grade even when model claims A',()=>{
  const value=structuredClone(feedback);value.checks[1]={label:contract.criteria[1].label,pass:false,evidence:'',source:''};
  const result=validateResult(value,'feedback',{...context,delivery:{...context.delivery,confirmed:[]}});
  assert.equal(result.grade,'—');assert.equal(result.scope,'content');
  const missing=value.checks.map(c=>({...c,pass:false,evidence:'',source:''}));
  assert.equal(validateResult({...value,checks:missing},'feedback',{...context,delivery:{...context.delivery,artifacts:[]}}).grade,'—');
});
test('completed decision gets no extra homework and equivalent rewording is scoped',()=>{
  const c={...context,task:{...context.task,contract:{kind:'decision',outcome:'选定主角',criteria:[{label:'有主角',method:'content'}]},criteria:['有主角']},current:'首页用兔子'};
  const result=validateResult({...feedback,checks:[{label:'有主角',pass:true,evidence:'兔子',source:'current'}]},'feedback',c);assert.equal(result.hint,'');
  const body=buildRequest({baseUrl:'https://api.deepseek.com',model:'deepseek-flash',format:'json_object',tokenField:'max_tokens'},'feedback',context);
  assert.ok(body.messages[0].content.includes('等价改写'));assert.ok(body.messages[0].content.includes('本人确认'));assert.ok(body.messages[0].content.includes('不是已完成的证据'));
});
test('private files are immutable across versions; hydration reads stored content only',async t=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'qiban-artifacts-'));t.after(()=>rm(dir,{recursive:true,force:true}));
  const info=await saveArtifact(dir,file),second=await saveArtifact(dir,{name:file.name,base64:Buffer.from('a different version').toString('base64')});
  assert.notEqual(info.id,second.id);assert.equal((await readArtifact(dir,info.id)).base64,file.base64);
  assert.equal((await stat(path.join(dir,'artifacts',info.id+'.json'))).mode&0o777,0o600);
  const hydrated=await hydrateEvidence(dir,sanitizeContext(context,'feedback'));assert.equal(hydrated.delivery.artifacts[0].content,file.content);
  await assert.rejects(readArtifact(dir,'../ai-config'));await assert.rejects(readArtifact(dir,'f'.repeat(64)),e=>e.code==='FILE_MISSING');
});
test('upload/read requires token; submitted content cannot override saved artifact',async t=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'qiban-delivery-api-'));let captured;
  const app=await createApp({dataDir:dir,initialConfig:{model:'fixture'},modelCall:async(c,k,ctx)=>{captured=ctx;return {result:feedback,meta:{model:'fixture'}};}});
  app.server.listen(0,'127.0.0.1');await once(app.server,'listening');const url='http://127.0.0.1:'+app.server.address().port;
  t.after(async()=>{app.server.closeAllConnections();await new Promise(r=>app.server.close(r));await rm(dir,{recursive:true,force:true});});
  const post=(route,body,token=app.token)=>fetch(url+'/api/ai/'+route,{method:'POST',headers:{'Content-Type':'application/json','X-Qiban-Token':token},body:JSON.stringify(body)});
  assert.equal((await post('artifacts/upload',file,'no')).status,403);
  assert.equal((await post('artifacts/upload',file)).status,200);
  assert.equal((await post('artifacts/read',{id:file.id},'no')).status,403);
  assert.equal((await fetch(url+'/artifacts/'+file.id+'.json')).status,404);
  const response=await post('feedback',{requestId:'delivery-test-1',context:{...context,delivery:{...context.delivery,artifacts:[{...file,content:'FAKE OVERRIDE'}]}}});assert.equal(response.status,200);
  assert.equal(captured.delivery.artifacts[0].content,file.content);
  assert.equal((await post('feedback',{requestId:'delivery-test-1',context:{...context,delivery:{...context.delivery,observation:'changed'}}})).status,409);
});
test('comparison uses artifact identity and history instead of invented model progress',()=>{
  const previous={text:context.current,grade:'—',source:'AI 内容反馈',deliverySummary:{fileIds:[file.id],contractKey:JSON.stringify(contract),observation:'',confirmedKey:'[]',link:context.delivery.link}};
  const result=validateResult({...feedback,comparison:'以前没有任何文件，现在才有'},'feedback',{...context,previous:[previous]});
  assert.equal(result.comparison,'成果文件和完成标准未变；这一版更新了本人的试用记录与确认。');
  const sanitized=sanitizeContext({...context,previous:[previous]},'feedback');assert.deepEqual(sanitized.previous[0].deliverySummary,previous.deliverySummary);
});
test('multi-megabyte standalone HTML is accepted without losing the original',()=>{
  const raw='<html><script>const image="data:image/png;base64,'+'A'.repeat(2600000)+'";</script></html>';
  const artifact=prepareArtifact({name:'standalone.html',base64:Buffer.from(raw).toString('base64')});
  assert.equal(artifact.size,Buffer.byteLength(raw));assert.ok(artifact.content.length<100);assert.equal(Buffer.from(artifact.base64,'base64').toString(),raw);
});
