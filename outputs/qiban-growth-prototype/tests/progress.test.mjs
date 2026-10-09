import test from 'node:test';
import assert from 'node:assert/strict';
import {sanitizeContext,validateResult,buildRequest,callModel} from '../ai.mjs';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const first='很快，这个产品已经到了可用的地步了，并且确实提供了一些让我触动的体验。';
const second=first+'比如在我草草写下一段记录后，看到低评级+AI 的建议，竟然真的能驱动我去完善我的记录，让我愿意去为这个行动多去思考几分';
const contract={kind:'decision',outcome:'挑一件值得留下的证据',criteria:[{label:'明确一个证据载体',method:'content'},{label:'有前后参照',method:'content'}]};
const context={ratingVersion:'anchored-v1',goal:'发布栖伴',scope:'自己用',branch:'真实进步',task:{title:contract.outcome,criteria:contract.criteria.map(c=>c.label),contract},current:second,delivery:{artifactIds:[],confirmed:[],observation:'',link:''},previous:[{text:first,grade:'C',hint:'留下某次具体体验',deliverySummary:{fileIds:[],contractKey:JSON.stringify(contract),observation:'',confirmedKey:'[]',link:''}}]};
const feedback={grade:'C',title:'具体的体验留下来了',strength:'你写下了草草记录到主动完善的变化。',hint:'再截一张图',comparison:'新增了具体时刻',checks:[{label:contract.criteria[0].label,level:'enough',pass:true,evidence:'在我草草写下一段记录后，看到低评级+AI 的建议',source:'current'},{label:contract.criteria[1].label,level:'enough',pass:true,evidence:'竟然真的能驱动我去完善我的记录',source:'current'}],change:{kind:'progress',summary:'你留下了从草草记录到愿意完善的具体体验。',evidence:'让我愿意去为这个行动多去思考几分',source:'current',adviceStatus:'applied'},extra:{evidence:'',source:'',reason:''}};
test('real user example: enough evidence cannot be held at C or receive endless homework',()=>{
 const c=sanitizeContext(context,'feedback'),r=validateResult(feedback,'feedback',c);
 assert.equal(r.grade,'A');assert.equal(r.hint,'');assert.equal(r.change.adviceStatus,'applied');assert.equal(r.ratingVersion,'anchored-v1');assert.match(r.comparison,/不直接比较/);
 assert.equal(feedback.grade,'C');assert.equal(context.previous[0].grade,'C');
});
test('partial evidence survives a failing check and does not become a forced pass',()=>{
 const v=structuredClone(feedback);v.checks=v.checks.map(k=>({...k,pass:false,level:'clue'}));v.change.adviceStatus='partial';
 const r=validateResult(v,'feedback',context);assert.equal(r.grade,'B');assert.equal(r.checks[0].evidence,v.checks[0].evidence);assert.equal(r.checks[0].pass,false);assert.equal(r.scope,'content');
});
test('new grading rejects fabricated partial evidence and unsupported progress',()=>{
 const v=structuredClone(feedback);v.checks[0]={...v.checks[0],level:'clue',pass:false,evidence:'凭空捏造的一次体验'};assert.throws(()=>validateResult(v,'feedback',context));
 const unchanged=validateResult(feedback,'feedback',{...context,previous:[{text:second,hint:'建议',grade:'B'}]});assert.equal(unchanged.change.kind,'equivalent');assert.match(unchanged.change.summary,/修正的是评价/);
 const inconsistent=structuredClone(feedback);inconsistent.checks[0].level='clue';assert.throws(()=>validateResult(inconsistent,'feedback',context));
});
test('new schema includes anchors and old evaluation requests remain on their existing version',()=>{
 const cfg={baseUrl:'https://api.deepseek.com',model:'deepseek-flash',format:'json_object',tokenField:'max_tokens'};
 const body=buildRequest(cfg,'feedback',context);assert.match(body.messages[0].content,/文本记录本身就是一种证据载体/);assert.match(body.messages[0].content,/adviceStatus/);
 assert.equal(sanitizeContext({...context,ratingVersion:undefined},'feedback').ratingVersion,undefined);
 const c=structuredClone(context);c.task.contract.criteria[0].clue='提到感受但尚不具体';assert.equal(sanitizeContext(c,'feedback').task.contract.criteria[0].clue,'提到感受但尚不具体');
});
test('artifact self report cannot become a completed implementation in the new system',()=>{
 const c=structuredClone(context);c.task.contract.kind='artifact';
 const v=structuredClone(feedback);v.checks=v.checks.map(k=>({...k,pass:false,level:'clue'}));
 const r=validateResult(v,'feedback',c);assert.equal(r.grade,'—');assert.equal(r.checks[0].level,'clue');
 assert.throws(()=>validateResult(feedback,'feedback',c));
});
test('contract changes prevent grade comparison even within the same evaluation version',()=>{
 const c=structuredClone(context);c.previous[0].ratingVersion='anchored-v1';c.previous[0].levels=['absent','clue'];c.previous[0].deliverySummary.contractKey='different';
 assert.match(validateResult(feedback,'feedback',sanitizeContext(c,'feedback')).comparison,/完成标准发生了变化/);
});
test('skipping, replacing and undo preserve attempts, adopted versions, drafts and stage snapshots',async()=>{
 const sandbox={};vm.runInNewContext(await readFile(new URL('../action-state.js',import.meta.url),'utf8'),sandbox);const api=sandbox.QibanActions;
 const old={id:'old',title:'旧行动',branch:'build'},attempt={id:'v1',taskId:'old',text:'真实记录',feedback:{grade:'C'}};
 const s={customTasks:[],attempts:[attempt],accepted:{old:'v1'},drafts:{old:{text:'草稿'}},stageRounds:[{evidence:[attempt]}]};
 const keep=JSON.stringify([s.attempts,s.accepted,s.drafts,s.stageRounds]);
 api.hide(s,old);assert.ok(s.hiddenActions.old);assert.equal(api.declined(s,'build')[0].title,'旧行动');api.restore(s,'old');assert.equal(s.hiddenActions.old,undefined);
 const proposal={title:'新行动',prompt:'留一句',contract};api.replace(s,old,proposal,{id:'new'});assert.equal(s.customTasks.length,1);assert.equal(api.replace(s,old,proposal,{id:'duplicate'}),null);
 api.restore(s,'old');assert.equal(s.hiddenActions.old,undefined);assert.ok(s.hiddenActions.new);assert.equal(JSON.stringify([s.attempts,s.accepted,s.drafts,s.stageRounds]),keep);
});
test('replacement excludes exact rejected candidates and fixes criteria before the action begins',()=>{
 const c=sanitizeContext({goal:'发布栖伴',branch:'看见进步',task:{title:'写一段',outcome:'留下体验'},existing:['对照两版'],declined:[{title:'写长文',reason:'太累'}]},'replace');
 const proposal={title:'只圈出一个变化',prompt:'我看见…',why:'只需选择',contract:{kind:'decision',outcome:'指出一处具体差异',criteria:[{label:'指出一处差异',clue:'提到有变化，具体位置还不清楚',method:'content'}]}};
 assert.equal(validateResult(proposal,'replace',c).contract.criteria[0].clue,proposal.contract.criteria[0].clue);
 assert.throws(()=>validateResult({...proposal,title:'写长文'},'replace',c));assert.throws(()=>validateResult({...proposal,title:'对照两版'},'replace',c));
});

test('criterion property order does not create a false change of standards',()=>{
 const c=structuredClone(context);c.previous[0].ratingVersion='anchored-v1';c.previous[0].levels=['clue','clue'];
 c.task.contract.criteria[0].clue='尚未具体';
 c.previous[0].deliverySummary.contractKey=JSON.stringify({...c.task.contract,criteria:c.task.contract.criteria.map(k=>({clue:k.clue,method:k.method,label:k.label}))});
 const r=validateResult(feedback,'feedback',sanitizeContext(c,'feedback'));assert.equal(r.comparison,feedback.comparison);
});
test('rejected generated candidates remain remembered after a replacement is adopted',async()=>{
 const sandbox={};vm.runInNewContext(await readFile(new URL('../action-state.js',import.meta.url),'utf8'),sandbox);const api=sandbox.QibanActions;
 const s={customTasks:[]},old={id:'old',title:'原来的一步',branch:'growth'};
 api.reject(s,'growth',{title:'不想写的长文'},'太费脑');api.replace(s,old,{title:'只选一下',prompt:'选一个',contract},{id:'new'});
 assert.ok(api.declined(s,'growth').some(t=>t.title==='不想写的长文'));api.restore(s,'old');assert.ok(api.declined(s,'growth').some(t=>t.title==='不想写的长文'));
});
test('prior grades do not anchor the model; original history remains available for honest comparisons',()=>{
 const c=structuredClone(context);c.previous[0].ratingVersion='anchored-v1';c.previous[0].levels=['clue','clue'];
 const cfg={baseUrl:'https://api.deepseek.com',model:'deepseek-flash',format:'json_object',tokenField:'max_tokens'};
 const input=JSON.parse(buildRequest(cfg,'feedback',c).messages[1].content);
 assert.equal(input.previous[0].grade,undefined);assert.equal(input.previous[0].levels,undefined);assert.equal(input.previous[0].text,first);assert.ok(input.previous[0].hint);assert.equal(c.previous[0].grade,'C');
});

test('current judgement is isolated from old advice; reflection cannot change its grade',async()=>{
 const cfg={baseUrl:'https://api.deepseek.com',model:'deepseek-flash',format:'json_object',tokenField:'max_tokens'};const calls=[];
 const out=await callModel(cfg,'feedback',context,{fetchImpl:async(url,options)=>{
  const request=JSON.parse(options.body),c=JSON.parse(request.messages[1].content);calls.push(c);
  const response=c.judgement?{change:feedback.change,comparison:'新增具体体验',grade:'C'}:{...feedback,change:{...feedback.change,kind:'first',adviceStatus:'none'}};
  return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify(response)}}]}));
 }});
 assert.equal(calls.length,2);assert.equal(calls[0].previous.length,0);assert.equal(calls[1].previous[0].hint,context.previous[0].hint);assert.equal(out.result.grade,'A');assert.equal(out.result.hint,'');assert.equal(out.meta.comparisonComplete,true);
});
test('failed historical reflection retains the independent evidence-based result',async()=>{
 const cfg={baseUrl:'https://api.deepseek.com',model:'deepseek-flash',format:'json_object',tokenField:'max_tokens'};
 const out=await callModel(cfg,'feedback',context,{fetchImpl:async(url,options)=>{
  const c=JSON.parse(JSON.parse(options.body).messages[1].content);if(c.judgement)throw Error('network');
  return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({...feedback,change:{...feedback.change,kind:'first',adviceStatus:'none'}})}}]}));
 }});
 assert.equal(out.result.grade,'A');assert.equal(out.meta.comparisonComplete,false);assert.equal(out.result.change.kind,'unclear');
});

test('historical reflection cannot revive homework after all current criteria are met',()=>{
 const judgement=validateResult(feedback,'feedback',context);
 const r=validateResult({change:{...feedback.change,adviceStatus:'partial'},comparison:'但是仍需要额外截图'},'compare',{...context,previous:[{...context.previous[0],ratingVersion:'anchored-v1'}],judgement});
 assert.equal(r.comparison,feedback.change.summary);assert.equal(r.change.adviceStatus,'none');
});
