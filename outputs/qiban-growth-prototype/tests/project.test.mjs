import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {Readable} from 'node:stream';
import {sanitizeContext,buildRequest,validateResult} from '../ai.mjs';
import {createApp} from '../server.mjs';
const code=await readFile(new URL('../project-state.js',import.meta.url),'utf8'), box={};vm.runInNewContext(code,box);const P=box.QibanProjects;
const plain=v=>JSON.parse(JSON.stringify(v));
function seed(){return {schema:1,goal:'做一个产品',scope:'先自己使用',branch:'one',branches:[{id:'one',name:'首轮体验',num:'01',outcome:'完成一次体验'}],tasks:[{id:'first',branch:'one',title:'留下一版',prompt:'这次留下',kind:'一句话'}],drafts:{first:{text:'还没写完',artifacts:[{id:'file-old'}]}},contracts:{first:{kind:'decision'}},attempts:[{id:'old-a',taskId:'first',taskTitle:'留下一版',branch:'one',text:'原文',createdAt:'2026-09-22',provenance:'自己写下',feedback:{grade:'A',label:'AI 反馈',title:'有了第一版',checks:[]}}],accepted:{first:'old-a'},customTasks:[],snapshots:[],adoptions:[],stageWork:{one:{round:1,closedId:'old-r',reviews:[]}},stageRounds:[{id:'old-r',branchId:'one',branchName:'首轮体验',round:1,grade:'B',closedAt:'2026-10-09',evidence:[],discussion:[]}],createdAt:'2026-09-22'};}
const plan=[{name:'挑选照片',outcome:'选出一张想留下的照片',actions:[{title:'选一张照片',prompt:'我想选…',contract:{kind:'decision',outcome:'做一次选择',criteria:[{label:'选定一张照片',method:'content'}]}}]}];
test('legacy migration preserves attempts, drafts, attachment references and stage grades without changing the input',()=>{
 const s=seed(),before=JSON.stringify(s),w=P.load(s,seed()),p=w.projects[0];assert.equal(JSON.stringify(s),before);assert.equal(w.schema,2);assert.equal(w.selectedId,p.id);
 for(const k of ['attempts','drafts','contracts','snapshots','stageWork','stageRounds','accepted'])assert.deepEqual(plain(p[k]),s[k]);assert.equal(P.stats(p).ready,true);
 assert.throws(()=>P.load({schema:2,selectedId:'missing',projects:[p]},seed()));assert.throws(()=>P.load({schema:1},seed()));
});
test('archive is idempotent and reversible; a reopened stage does not count as closed and old receipts stay frozen',()=>{
 const p=P.load(seed(),seed()).projects[0],original=JSON.stringify(p.attempts);
 const r=P.archive(p,{id:'end-1',at:'2026-10-09',note:'终于做到了'});assert.equal(p.status,'completed');assert.equal(r.stats.milestones[0].grade,'B');P.archive(p,{id:'repeat',at:'later'});assert.equal(p.closures.length,1);
 P.reopen(p);p.stageWork.one={round:2,closedId:null,reviews:[]};assert.equal(P.stats(p).ready,false);assert.equal(r.stats.milestones[0].grade,'B');assert.equal(r.stats.closed,1);assert.equal(JSON.stringify(p.attempts),original);
 P.archive(p,{id:'end-2',at:'2026-10-10',status:'shelved'});assert.equal(p.status,'shelved');assert.equal(p.closures.length,2);assert.equal(p.stageWork.one.closedId,null);
});
test('new goals own distinct action ids and empty records even when their titles match; no product tasks leak',()=>{
 const a=P.create({id:'p1',goal:'摄影集',plan,at:'2026-10-09'}),b=P.create({id:'p2',goal:'摄影集',plan,at:'2026-10-09'});
 assert.notEqual(a.tasks[0].id,b.tasks[0].id);assert.equal(a.branches.length,1);assert.equal(a.tasks[0].title,'选一张照片');assert.equal(a.attempts.length,0);a.accepted[a.tasks[0].id]='a';assert.equal(Object.keys(b.accepted).length,0);
});
test('AI planning uses bounded, goal-specific context and rejects incomplete or duplicated actions',()=>{
 const c=sanitizeContext({goal:'摄影集',scope:'12张照片',oldAttempts:['must not send']},'plan');assert.deepEqual(c,{goal:'摄影集',scope:'12张照片'});
 const config={model:'test',baseUrl:'https://api.deepseek.com',tokenField:'max_tokens',format:'json_schema'};
 const req=buildRequest(config,'plan',c);assert.equal(req.response_format.json_schema.name,'qiban_plan');assert.match(req.messages[0].content,/第一版成长路径/);assert.doesNotMatch(req.messages[1].content,/must not send/);
 assert.equal(validateResult({stages:plan},'plan',c).stages[0].actions[0].title,'选一张照片');assert.throws(()=>validateResult({stages:[]},'plan',c));assert.throws(()=>validateResult({stages:[{...plan[0],actions:[...plan[0].actions,...plan[0].actions]}]},'plan',c));
});
test('plan endpoint authenticates, sanitizes and caches separately from feedback without opening sockets',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'qiban-project-'));let calls=0;
 try{const app=await createApp({dataDir:dir,initialConfig:{model:'fixture'},modelCall:async(config,kind,context)=>{calls++;assert.equal(kind,'plan');assert.equal(context.goal,'摄影集');return {result:{stages:plan},meta:{model:'fixture'}};}});app.server.address=()=>({port:52160});
 const request=(token)=>new Promise(resolve=>{const req=Readable.from([Buffer.from(JSON.stringify({requestId:'plan-test-one',context:{goal:'摄影集'}}))]);Object.assign(req,{method:'POST',url:'/api/ai/plan',headers:{host:'127.0.0.1:52160','content-type':'application/json','x-qiban-token':token}});app.server.emit('request',req,{destroyed:false,writeHead(status){this.status=status;},end(body){resolve({status:this.status,body:JSON.parse(String(body))});}});});
 assert.equal((await request('wrong')).status,403);assert.equal((await request(app.token)).status,200);assert.equal((await request(app.token)).status,200);assert.equal(calls,1);
 }finally{await rm(dir,{recursive:true,force:true});}
});

async function harness(initial,{forms=null,request,online=true}={}){
 const key='qiban.growth.prototype.v1',store=new Map(initial?[[key,JSON.stringify(initial)]]:[]),els=new Map(),events=new Map();let failWrites=false;
 const decode=s=>s.replace(/&(amp|lt|gt|quot|#39);/g,(_,k)=>({amp:'&',lt:'<',gt:'>',quot:'"','#39':"'"}[k]));
 function el(selector){const listeners={},controls=[];let html='';const node={textContent:'',value:'',hidden:false,open:false,dataset:{},isConnected:true,classList:{toggle(){},add(){},remove(){}},addEventListener(type,fn){(listeners[type]||=[]).push(fn);},setAttribute(){},removeAttribute(){},focus(){},showModal(){this.open=true;},close(){this.open=false;},remove(){},querySelector(s){if(selector==='#workspace-dialog'){if(s.startsWith('#'))return controls.find(c=>c.id===s.slice(1))||get(s);const match=s.match(/^\[data-([\w-]+)(?:="([^"]+)")?\]$/);if(match){const k=match[1].replace(/-([a-z])/g,(_,c)=>c.toUpperCase());return controls.find(c=>c.dataset[k]!==undefined&&(match[2]===undefined||c.dataset[k]===match[2]))||null;}}return get(s);},querySelectorAll(s){if(selector!=='#workspace-dialog')return [];if(s==='input[id],textarea[id],select[id]')return controls.filter(c=>c.id);const match=s.match(/^\[data-([\w-]+)\]$/);if(match){const k=match[1].replace(/-([a-z])/g,(_,c)=>c.toUpperCase());return controls.filter(c=>c.dataset[k]!==undefined);}return [];},click(data){for(const f of listeners.click||[])f({target:{closest:()=>({dataset:data})}});},input(id,value){const target=id.startsWith('[')?node.querySelector(id):get('#'+id);target.value=value;for(const f of listeners.input||[])f({target});}};
 Object.defineProperty(node,'innerHTML',{get:()=>html,set(value){html=value;if(selector!=='#workspace-dialog')return;controls.length=0;for(const m of html.matchAll(/<input\b([^>]*)>|<(textarea|select)\b([^>]*)>([\s\S]*?)<\/\2>/g)){const attrs=m[1]??m[3],a={};for(const attr of attrs.matchAll(/([\w:-]+)(?:="([^"]*)")?/g))a[attr[1]]=decode(attr[2]||'');const control=el();control.id=a.id||'';control.value=m[1]!==undefined?(a.value||''):m[2]==='textarea'?decode(m[4]):'';for(const [k,v]of Object.entries(a))if(k.startsWith('data-'))control.dataset[k.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=v;if(m[2]==='select'){const options=[...m[4].matchAll(/<option\b([^>]*)>([^<]*)<\/option>/g)],selected=options.find(o=>/\bselected\b/.test(o[1]))||options[0];if(selected)control.value=decode(selected[1].match(/\bvalue="([^"]*)"/)?.[1]||selected[2]);}controls.push(control);}}});return node;}
 function get(s){const control=els.get('#workspace-dialog')?.querySelectorAll('input[id],textarea[id],select[id]').find(c=>'#'+c.id===s);if(control)return control;if(!els.has(s))els.set(s,el(s));return els.get(s);}
 const doc={visibilityState:'visible',activeElement:null,querySelector:s=>s.startsWith('meta[')?null:get(s),querySelectorAll:()=>[],addEventListener:(t,f)=>events.set('doc:'+t,f)};
 const env={URL,Date,document:doc,location:{protocol:'file:',hash:'#now'},localStorage:{getItem:k=>store.get(k)||null,setItem(k,v){if(failWrites&&k===key)throw Error('quota');store.set(k,v);}},setTimeout:()=>0,clearTimeout(){},window:{scrollTo(){},addEventListener:(t,f)=>events.set(t,f)}};
 if(forms){env.QibanCloud={ready:Promise.resolve(),storage:env.localStorage,renderStatus(){},requireOnline:()=>online,getForm:k=>forms.has(k)?plain(forms.get(k)):null,setForm:(k,v)=>forms.set(k,plain(v)),clearForm:k=>forms.delete(k)};env.QibanPlatform={request:request||(async p=>({status:200,data:p==='/api/ai/config'?{configured:false}:{} }))};}
 for(const file of ['attachment-input.js','stage-state.js','record-input.js','action-state.js','home-state.js','expedition-data.js','research-cards.js','home-ui.js','project-state.js','app.js'])vm.runInNewContext(await readFile(new URL('../'+file,import.meta.url),'utf8'),env,{filename:file});
 await new Promise(r=>setImmediate(r));
 return {get,store,events,key,env,fail:()=>{failWrites=true;},saved:()=>JSON.parse(store.get(key)),main:data=>get('#main').click(data),dialog:data=>get('#workspace-dialog').click(data),input:(id,v)=>get('#workspace-dialog').input(id,v)};
}
test('complete → archive → create → refresh → revisit preserves original records and frozen grades',async()=>{
 const h=await harness(seed());assert.match(h.get('#main').innerHTML,/完成这个目标/);h.main({projectCommand:'archive'});h.input('project-note','这个收尾很开心');h.dialog({projectCommand:'finish'});
 assert.equal(h.saved().projects[0].status,'completed');assert.match(h.get('#main').innerHTML,/目标已完成/);h.main({projectCommand:'new'});h.input('new-project-goal','做出摄影集');h.input('new-project-first','选一张照片');h.dialog({projectCommand:'create'});
 const saved=h.saved();assert.equal(saved.projects.length,2);assert.equal(saved.projects[1].attempts.length,0);assert.match(h.get('#main').innerHTML,/选一张照片/);assert.doesNotMatch(h.get('#main').innerHTML,/给首页选一个主角/);
 const after=await harness(saved);assert.match(after.get('#main').innerHTML,/做出摄影集/);after.main({projectOpen:'project-original'});assert.match(after.get('#main').innerHTML,/目标已完成/);after.main({openAttempt:'old-a'});assert.match(after.get('#workspace-dialog').innerHTML,/原文/);assert.doesNotMatch(after.get('#workspace-dialog').innerHTML,/data-modal-command="(?:retry|adopt)"/);
 assert.deepEqual(after.saved().projects[0].attempts,seed().attempts);after.dialog({modalCommand:'close'});after.main({projectCommand:'reopen'});assert.equal(after.saved().projects[0].status,'active');assert.equal(after.saved().projects[0].closures.length,1);assert.equal(after.saved().projects[0].stageRounds[0].grade,'B');
});
test('storage failures and another-tab changes do not apply archive or overwrite old data',async()=>{
 for(const conflict of [false,true]){const h=await harness(seed()),before=h.store.get(h.key);h.main({projectCommand:'archive'});if(conflict)h.store.set(h.key,JSON.stringify({...seed(),goal:'另一页刚更新'}));else h.fail();const expected=h.store.get(h.key);h.dialog({projectCommand:'finish'});assert.equal(h.store.get(h.key),expected);assert.match(h.get('#workspace-dialog').innerHTML,/完成并归档/);assert.match(h.get('#toast').textContent,/没有改动目标/);assert.ok(before);}
});
test('cancelling creation keeps the goal draft but never creates a project',async()=>{
 const h=await harness(seed()),before=h.store.get(h.key);h.main({projectCommand:'new'});h.input('new-project-goal','学摄影');h.dialog({modalCommand:'close'});assert.equal(h.store.get(h.key),before);h.main({projectCommand:'new'});assert.match(h.get('#workspace-dialog').innerHTML,/学摄影/);
});
test('stage form drafts survive restart and remain separate across stages and rounds',async()=>{
 const initial=seed();initial.stageWork={one:{round:1,outcome:'完成一次体验',reviews:[],addedSuggestions:{}},two:{round:1,outcome:'完成第二阶段',reviews:[],addedSuggestions:{}}};initial.stageRounds=[];initial.branches.push({id:'two',name:'第二阶段',num:'02',outcome:'完成第二阶段'});
 const forms=new Map(),h=await harness(initial,{forms});h.main({command:'stage-review'});h.input('stage-outcome','第一阶段的未提交目标');h.dialog({modalCommand:'close'});h.main({branch:'two'});h.main({command:'stage-review'});
 assert.equal(h.get('#stage-outcome').value,'完成第二阶段');h.input('stage-outcome','第二阶段的未提交目标');h.dialog({modalCommand:'close'});
 const reloaded=await harness(h.saved(),{forms});reloaded.main({command:'stage-review'});assert.equal(reloaded.get('#stage-outcome').value,'第二阶段的未提交目标');reloaded.dialog({stageCommand:'outcome'});
 assert.equal(reloaded.saved().projects[0].stageWork.two.outcome,'第二阶段的未提交目标');assert.equal(forms.has('project-original:stage:two:1'),false);
 reloaded.dialog({modalCommand:'close'});reloaded.main({branch:'one'});reloaded.main({command:'stage-review'});assert.equal(reloaded.get('#stage-outcome').value,'第一阶段的未提交目标');
 const next=reloaded.saved();next.projects[0].stageWork.one.round=2;const nextRound=await harness(next,{forms});nextRound.main({command:'stage-review'});assert.notEqual(nextRound.get('#stage-outcome').value,'第一阶段的未提交目标');
});
test('contract editor restores complete criteria per action and clears its form after saving',async()=>{
 const initial=seed();initial.contracts.first={kind:'decision',outcome:'完成第一行动',criteria:[{label:'原有第一标准',method:'content'}]};initial.tasks.push({id:'second',branch:'one',title:'第二行动',prompt:'再留一版',kind:'一句话'});
 const forms=new Map(),h=await harness(initial,{forms});h.main({openTask:'first'});h.dialog({modalCommand:'edit-contract'});h.input('contract-outcome','只属于第一行动的落点');h.input('contract-kind','artifact');h.input('[data-criterion-label="0"]','第一行动验证标准');h.input('[data-criterion-method="0"]','experience');h.dialog({modalCommand:'close'});
 h.main({openTask:'second'});h.dialog({modalCommand:'edit-contract'});assert.notEqual(h.get('#contract-outcome').value,'只属于第一行动的落点');h.input('contract-outcome','第二行动自己的落点');h.dialog({modalCommand:'close'});
 const reloaded=await harness(initial,{forms});reloaded.main({openTask:'first'});reloaded.dialog({modalCommand:'edit-contract'});assert.equal(reloaded.get('#contract-outcome').value,'只属于第一行动的落点');assert.equal(reloaded.get('#contract-kind').value,'artifact');
 assert.equal(reloaded.get('#workspace-dialog').querySelector('[data-criterion-label="0"]').value,'第一行动验证标准');assert.equal(reloaded.get('#workspace-dialog').querySelector('[data-criterion-method="0"]').value,'experience');reloaded.dialog({modalCommand:'save-contract'});
 assert.equal(reloaded.saved().projects[0].drafts.first.contract.criteria[0].label,'第一行动验证标准');assert.equal(reloaded.saved().projects[0].drafts.first.contract.criteria[0].method,'experience');assert.equal(forms.has('project-original:contract:first'),false);assert.equal(forms.has('project-original:contract:second'),true);
});
test('AI goal planning and edited stage names survive restart and are used in the new project',async()=>{
 const forms=new Map(),request=async p=>({status:200,data:p==='/api/ai/config'?{configured:true}:p==='/api/ai/plan'?{result:{stages:plain(plan)}}:{}}),h=await harness(seed(),{forms,request});
 h.main({projectCommand:'new'});h.input('new-project-goal','做一本真实摄影集');h.input('new-project-scope','选出十二张');h.dialog({projectCommand:'plan'});await new Promise(r=>setImmediate(r));h.input('plan-name-0','从自己喜欢的照片开始');h.input('plan-outcome-0','选出一张自己的照片');h.dialog({modalCommand:'close'});
 const reloaded=await harness(seed(),{forms,request});reloaded.main({projectCommand:'new'});assert.equal(reloaded.get('#new-project-goal').value,'做一本真实摄影集');assert.equal(reloaded.get('#plan-name-0').value,'从自己喜欢的照片开始');assert.equal(reloaded.get('#plan-outcome-0').value,'选出一张自己的照片');reloaded.dialog({projectCommand:'create'});
 assert.equal(reloaded.saved().projects[1].branches[0].name,'从自己喜欢的照片开始');assert.equal(reloaded.saved().projects[1].branches[0].outcome,'选出一张自己的照片');assert.equal(reloaded.saved().projects[1].tasks[0].title,plan[0].actions[0].title);assert.equal(forms.has('new-project'),false);
});
