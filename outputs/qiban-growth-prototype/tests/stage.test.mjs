import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import vm from 'node:vm';
import os from 'node:os';
import path from 'node:path';
import {once} from 'node:events';
import {sanitizeStageContext,validateStageResult} from '../stage-ai.mjs';
import {buildRequest,validateResult,sanitizeContext} from '../ai.mjs';
import {createApp} from '../server.mjs';
const config={baseUrl:'https://api.deepseek.com',model:'deepseek-flash',tokenField:'max_tokens',format:'json_object'};
const ctx={goal:'做出栖伴',scope:'自己使用',stage:{id:'build',name:'产品',outcome:'跑通一次行动',round:1},records:[{id:'attempt-1',title:'试用',text:'走通了',version:1,grade:'B',adopted:true,files:[],checks:[]}],tasks:[{title:'试用',done:true}],message:'',discussion:[]};
const ready={recommendation:'advance',grade:'A',summary:'已经走通',reason:'这一轮已足够',findings:[{label:'完成流程',status:'met',detail:'有实际试用记录',sources:['attempt-1']}],suggestions:[],question:''};
test('stage sanitization keeps evidence and rejects oversized discussion',()=>{const clean=sanitizeStageContext(ctx);assert.equal(clean.records[0].adopted,true);assert.throws(()=>sanitizeStageContext({...ctx,discussion:Array(9).fill({})}));assert.throws(()=>sanitizeStageContext({...ctx,records:[ctx.records[0],ctx.records[0]]}));});
test('stage completion requires cited findings; tasks or grade averages are not proof',()=>{assert.equal(validateStageResult(ready,sanitizeStageContext(ctx)).grade,'A');for(const sources of [[],['forged-id'],['user']])assert.throws(()=>validateStageResult({...ready,findings:[{...ready.findings[0],sources}]},ctx));assert.throws(()=>validateStageResult({...ready,findings:[{...ready.findings[0],status:'unknown'}]},ctx));assert.throws(()=>validateStageResult({...ready,suggestions:[{kind:'gap',title:'再做',prompt:'再做',why:'再做'}]},ctx));});
test('unconfirmed or partial stage does not turn into an A',()=>{const missing={...ready,recommendation:'continue',grade:'B',findings:[{label:'一次实际试用',status:'unknown',detail:'尚无体验记录',sources:[]}]};assert.equal(validateStageResult(missing,ctx).grade,'B');assert.throws(()=>validateStageResult({...missing,grade:'A'},ctx));assert.equal(validateStageResult({...ready,findings:[{...ready.findings[0],sources:['user']}]},{...ctx,message:'本人走通了'}).grade,'A');});
test('stage model request uses explicit recommendation and original boundary',()=>{const body=buildRequest(config,'stage',ctx);assert.equal(body.max_tokens,3072);assert.ok(body.messages[0].content.includes('不平均行动等级'));assert.equal(JSON.parse(body.messages[1].content).stage.outcome,ctx.stage.outcome);});
test('round archive is immutable, idempotent and can be revisited without resetting actions',async()=>{
 const box={};vm.runInNewContext(await readFile(new URL('../stage-state.js',import.meta.url),'utf8'),box);const S=box.QibanStages;
 const state={goal:'目标',attempts:[{id:'a',taskId:'t',branch:'build',text:'第一版',feedback:{grade:'B'}}],accepted:{t:'a'}};const b={id:'build',name:'产品',outcome:'目标'};
 const w=S.current(state,b);assert.equal(w.round,1);w.reviews.push({status:'pending'});assert.throws(()=>S.close(state,b,{id:'r1',at:'now'}));w.reviews=[];
 const r=S.close(state,b,{id:'r1',at:'now',review:{result:{...ready,grade:'B',recommendation:'continue'}}});assert.equal(r.grade,'B');assert.equal(r.closedBy,'user');
 assert.equal(S.close(state,b,{id:'duplicate'}).id,'r1');state.attempts[0].text='不可改写归档';assert.equal(r.evidence[0].text,'第一版');assert.equal(S.reopen(state,b).round,2);assert.equal(state.accepted.t,'a');assert.equal(state.stageRounds.length,1);assert.equal(S.reopen(state,b).round,2);
});
test('stage API shares protected, immutable request cache',async t=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'qiban-stage-test-'));let calls=0;const app=await createApp({dataDir:dir,initialConfig:config,modelCall:async(c,k,input)=>{calls++;assert.equal(k,'stage');return {result:validateStageResult(ready,input),meta:{model:'fixture'}};}});app.server.listen(0,'127.0.0.1');await once(app.server,'listening');
 t.after(async()=>{app.server.closeAllConnections();await new Promise(r=>app.server.close(r));await rm(dir,{recursive:true,force:true});});
 const post=(context,token=app.token)=>fetch('http://127.0.0.1:'+app.server.address().port+'/api/ai/stage',{method:'POST',headers:{'Content-Type':'application/json','X-Qiban-Token':token},body:JSON.stringify({requestId:'stage-fixture-one',context})});
 assert.equal((await post(ctx,'wrong')).status,403);assert.equal((await post(ctx)).status,200);assert.equal((await post(ctx)).status,200);assert.equal(calls,1);assert.equal((await post({...ctx,message:'新讨论'})).status,409);
});
const contract={kind:'decision',outcome:'选择兔子呼吸效果',criteria:[{label:'确定主角',method:'content'},{label:'确定呼吸节奏',method:'content'}]};
const action={goal:'栖伴',task:{title:'兔子动效',prompt:'',criteria:contract.criteria.map(c=>c.label),contract},current:'兔子，呼吸 4 秒一循环',previous:[{text:'兔子，吸气 2 秒，呼气 2 秒',grade:'B',source:'AI',hint:'改成4秒循环'}],continuity:{accepted:'兔子，呼吸4秒',advice:['拆成吸气2秒呼气2秒','改成4秒循环']}};
const feedback={grade:'B',title:'兔子方案',strength:'已选主角',hint:'改为吸气2秒、呼气2秒',comparison:'',checks:[{label:'确定主角',pass:true,source:'current',evidence:'兔子'},{label:'确定呼吸节奏',pass:false,source:'',evidence:''}],advice:{kind:'gap',criterion:1,reverses:true,newEvidence:''}};
test('continuity includes prior hints and adopted decision in model input',()=>{const c=sanitizeContext(action,'feedback');const b=buildRequest(config,'feedback',c);const data=JSON.parse(b.messages[1].content);assert.equal(data.previous[0].hint,'改成4秒循环');assert.equal(data.continuity.advice.length,2);assert.ok(b.messages[0].content.includes('没有新事实就不得反向建议'));});
test('reverse advice without new evidence and equivalent breath rewrites are suppressed',()=>{
 assert.equal(validateResult(feedback,'feedback',action).hint,'');
 assert.equal(validateResult({...feedback,advice:{...feedback.advice,reverses:false}},'feedback',action).hint,'');
 const passed={...feedback,advice:{...feedback.advice,criterion:0},hint:'兔子写得更具体一点'};assert.equal(validateResult(passed,'feedback',action).hint,'');
 const gap={...feedback,hint:'实际试用后留一句感受',advice:{...feedback.advice,reverses:false}};assert.equal(validateResult(gap,'feedback',action).hint,gap.hint);
});
test('new action proposals carry a completion contract and no-data is ungraded',()=>{
 const empty=sanitizeStageContext({...ctx,records:[],tasks:[]});
 const suggestion={title:'试着走通一次',prompt:'试过之后…',kind:'gap',why:'补充体验依据',contract:{kind:'decision',outcome:'留下实际体验',criteria:[{label:'描述一次真实体验',method:'content'}]}};
 const result=validateStageResult({...ready,recommendation:'continue',grade:'C',findings:[{label:'实际体验',status:'unknown',detail:'还没有记录',sources:[]}],suggestions:[suggestion]},empty);
 assert.equal(result.grade,'—');assert.equal(result.suggestions[0].contract.kind,'decision');assert.throws(()=>validateStageResult({...result,suggestions:[{...suggestion,contract:null}]},empty));
});
test('previous round is context, not automatic new evidence',()=>{
 const c=sanitizeStageContext({...ctx,baseline:{outcome:'旧目标',grade:'A',summary:'曾经完成',recordIds:['attempt-1']}});assert.equal(c.baseline.outcome,'旧目标');
 assert.throws(()=>validateStageResult({...ready,findings:[{...ready.findings[0],sources:['baseline']}]},c));
});
test('completion recap uses frozen adopted versions and does not count old attempts as new',async()=>{
 const box={};vm.runInNewContext(await readFile(new URL('../stage-state.js',import.meta.url),'utf8'),box);const S=box.QibanStages;
 const first={id:'r1',branchId:'build',evidence:[{id:'a1',taskId:'a',text:'最初',adopted:true}]};
 const next={id:'r2',branchId:'build',evidence:[{id:'a1',taskId:'a',text:'最初',adopted:false},{id:'a2',taskId:'a',text:'现在',adopted:true}]};
 const recap=S.recap({stageRounds:[first,next]},next);assert.equal(recap.total,2);assert.equal(recap.newCount,1);assert.equal(recap.adopted.length,1);assert.equal(recap.comparison.first.text,'最初');assert.equal(recap.comparison.last.text,'现在');
 const repeat={...next,id:'r3'};assert.equal(S.recap({stageRounds:[first,next,repeat]},repeat).newCount,0);
 const empty={id:'e',branchId:'other',evidence:[]};const e=S.recap({stageRounds:[first,next,empty]},empty);assert.equal(e.total,0);assert.equal(e.highlights.length,0);assert.equal(e.previous,null);
});
