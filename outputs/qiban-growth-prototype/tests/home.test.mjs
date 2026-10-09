import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {withQixiVoice} from '../qixi-voice.mjs';
const box={URL,Date,document:{querySelector:()=>null}};
for(const name of ['home-state.js','expedition-data.js','research-cards.js','home-ui.js'])vm.runInNewContext(await readFile(new URL('../'+name,import.meta.url),'utf8'),box);
const H=box.QibanHome;
const branches=[{id:'build',num:'02',name:'做出可用的产品'},{id:'growth',num:'03',name:'看见真实的进步'}];
const tasks=[{id:'proof',branch:'growth',title:'挑一件值得留下的证据'},{id:'draft',branch:'growth',title:'试一下'}];
const goal='把栖伴做成完整产品并发布上线';
function fixture(){return {goal,branch:'growth',attempts:[{id:'a1',taskId:'proof',taskTitle:'挑一件值得留下的证据',branch:'growth',goal,text:'第一版的真实体验',createdAt:'2026-09-22T08:00:00Z'},{id:'a3',taskId:'proof',taskTitle:'挑一件值得留下的证据',branch:'growth',goal,text:'后来补了一版，尚未采用',createdAt:'2026-09-22T10:00:00Z'}],accepted:{proof:'a1'},adoptions:[{attemptId:'a1',at:'2026-09-22T09:00:00Z'}],drafts:{draft:{text:'还没写完',updatedAt:'2026-09-22T11:00:00Z'}},customTasks:[],snapshots:[],stageWork:{build:{round:1,closedId:'round1'},growth:{round:1}},stageRounds:[{id:'round1',branchId:'build',branchName:'做出可用的产品',goal,round:1,grade:'B',closedAt:'2026-09-22T09:00:00Z'}]};}
const immutable=s=>JSON.stringify([s.attempts,s.accepted,s.adoptions,s.drafts,s.stageWork,s.stageRounds]);
test('first upgrade uses actual history to recognize a gap; return state survives reload',()=>{
 const s=fixture(),before=immutable(s);assert.equal(H.visit(s,'2026-09-29T09:00:00Z').returning,true);assert.equal(immutable(s),before);
 const reloaded=JSON.parse(JSON.stringify(s));assert.equal(H.visit(reloaded,'2026-09-29T09:01:00Z').returning,true);
 H.resume(reloaded);assert.equal(H.visit(reloaded,'2026-09-29T09:02:00Z').returning,false);assert.equal(immutable(reloaded),before);
});
test('fresh and frequent visits are not presented as a long absence',()=>{
 const fresh={goal,attempts:[],drafts:{},stageRounds:[]};assert.equal(H.visit(fresh,'2026-09-29T09:00:00Z').returning,false);
 const s=fixture();s.homecoming={lastSeenAt:'2026-09-29T08:00:00Z'};assert.equal(H.visit(s,'2026-09-29T09:00:00Z').returning,false);
});
test('recap distinguishes latest, adopted, unfinished draft, and closed stage without changing records',()=>{
 const s=fixture(),before=JSON.stringify(s),r=H.recap(s,branches,tasks);
 assert.equal(r.latest.id,'a3');assert.equal(r.achievement.id,'a1');assert.equal(r.anchor.id,'a1');assert.equal(r.draft.taskId,'draft');assert.equal(r.lastClosed.grade,'B');assert.equal(r.closed,null);assert.equal(r.total,2);assert.equal(r.adoptedCount,1);assert.equal(JSON.stringify(s),before);
});
test('a new round never inherits the previous round as current completion',()=>{
 const s=fixture();s.branch='build';s.stageWork.build={round:2,closedId:null};const r=H.recap(s,branches,tasks);
 assert.equal(r.round,2);assert.equal(r.closed,null);assert.equal(r.lastClosed.grade,'B');
});
test('empty drafts, hidden actions, and other goals do not become resume targets',()=>{
 const s=fixture();s.hiddenActions={draft:{}};assert.equal(H.recap(s,branches,tasks).draft,null);
 s.hiddenActions={};s.drafts.draft={text:'  ',contract:{outcome:'placeholder'}};assert.equal(H.recap(s,branches,tasks).draft,null);
 s.goal='另一个目标';const r=H.recap(s,branches,tasks);assert.equal(r.total,0);assert.equal(r.achievement,null);assert.equal(r.lastClosed,null);
 assert.equal(H.trips(s,box.QibanExpeditions).length,0);
});
test('just looking is reversible, expires, and does not complete actions or stages',()=>{
 const s=fixture(),before=immutable(s);H.rest(s,'2026-09-29T09:00:00Z');assert.ok(Date.parse(s.homecoming.quietUntil)>Date.parse('2026-09-29T09:00:00Z'));assert.equal(immutable(s),before);
 H.resume(s);assert.equal(s.homecoming.quietUntil,null);assert.equal(immutable(s),before);
 H.rest(s,'2026-09-29T09:00:00Z');H.visit(s,'2026-10-02T09:00:00Z');assert.equal(s.homecoming.quietUntil,null);
});
test('reading, saving and rejecting research stays separate from personal achievement',()=>{
 const s=fixture(),before=immutable(s),trip=H.trips(s,box.QibanExpeditions)[0];
 H.respond(s,trip.id,{readAt:'2026-09-29T09:00:00Z',saved:true});H.respond(s,trip.id,{verdict:'miss',reason:'没什么新东西'});
 assert.equal(immutable(s),before);assert.equal(s.customTasks.length,0);const again=JSON.parse(JSON.stringify(s));assert.equal(H.response(again,trip.id).saved,true);assert.equal(H.response(again,trip.id).reason,'没什么新东西');
});
test('research imports are bounded, goal scoped, deduplicated and cannot replace the checked-in trip',()=>{
 const s=fixture(),trip=JSON.parse(JSON.stringify(box.QibanExpeditions[0]));assert.equal(H.importTrip(s,trip,box.QibanExpeditions),false);
 trip.id='second-trip';assert.equal(H.importTrip(s,trip,box.QibanExpeditions),true);assert.equal(H.importTrip(s,trip,box.QibanExpeditions),false);assert.equal(H.trips(s,box.QibanExpeditions).length,2);
 assert.throws(()=>H.importTrip(s,{...trip,id:'other',goal:'不一样'}));assert.throws(()=>H.validateTrip({...trip,title:'x'.repeat(81)}));assert.throws(()=>H.validateTrip({...trip,completedAt:'invalid'}));assert.throws(()=>H.validateTrip({...trip,id:'__proto__'}));
});
test('imported sources cannot contain executable schemes, credentials or local addresses',()=>{
 const trip=JSON.parse(JSON.stringify(box.QibanExpeditions[0]));
 for(const url of ['javascript:alert(1)','file:///tmp/x','http://example.com','https://user:pass@example.com','https://127.0.0.1','https://[::1]/','https://x.local/'])assert.equal(H.sourceURL(url),'');
 assert.throws(()=>H.validateTrip({...trip,sources:[{title:'bad',note:'bad',url:'javascript:alert(1)'}]}));
 assert.equal(H.sourceURL('https://example.com/a'),'https://example.com/a');
});
function harness(){
 const s=fixture();H.visit(s,'2026-09-29T09:00:00Z');let ui,opened=null,added=0;
 const main={addEventListener(type,fn){if(type==='click')this.click=fn;}};
 const dialog={innerHTML:'',open:false,addEventListener(type,fn){if(type==='click')this.click=fn;},querySelector(){return {focus(){},isConnected:true};}};
 const o={state:()=>s,tasks:()=>[...tasks,...s.customTasks],branches,escape:v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;'),icon:()=>'<svg></svg>',main,dialog,dialogTop:()=>'',save:()=>true,render:()=>{},closeModal:()=>{dialog.open=false;},openModal:()=>{dialog.open=true;},openAttempt:id=>{opened=id;},openTask:id=>{opened=id;},openRound:id=>{opened=id;},addReturnTrial:()=>{added++;const t={id:'trial-'+added,branch:'growth',title:'trial'};s.customTasks.push(t);return t;}};
 ui=box.QibanHomeUI.create(o);
 const click=(target,dataset)=>target.click({target:{closest:()=>({dataset})}});
 return {s,ui,main,dialog,click,opened:()=>opened,added:()=>added};
}
test('UI handlers open exact adopted and latest record ids and preserve previous attempts',()=>{
 const h=harness(),before=immutable(h.s);h.ui.openRecap();assert.match(h.dialog.innerHTML,/data-home-attempt="a1"/);assert.match(h.dialog.innerHTML,/data-home-attempt="a3"/);
 h.click(h.dialog,{homeAttempt:'a3'});assert.equal(h.opened(),'a3');assert.equal(immutable(h.s),before);
});
test('trying an expedition idea requires a click and repeated clicks reuse the chosen action',()=>{
 const h=harness(),before=immutable(h.s),trip=box.QibanExpeditions[0];h.click(h.main,{trip:trip.id});assert.equal(h.added(),0);
 h.click(h.dialog,{homeCommand:'save-trip'});assert.equal(h.added(),0);
 h.click(h.dialog,{researchPick:'quieter-home',researchTrip:trip.id,researchScope:'dialog'});h.click(h.dialog,{homeCommand:'try-trip'});assert.equal(h.added(),1);assert.equal(h.opened(),'trial-1');
 h.click(h.main,{trip:trip.id});h.click(h.dialog,{homeCommand:'try-trip'});assert.equal(h.added(),1);assert.equal(immutable(h.s),before);
});
test('hidden research remains in library, and untrusted titles are escaped in displayed HTML',()=>{
 const h=harness(),trip=box.QibanExpeditions[0];h.click(h.main,{trip:trip.id});h.click(h.dialog,{homeCommand:'hide-trip'});
 assert.doesNotMatch(h.ui.homeHTML(),/class="outing-card(?:\s|")/);h.ui.openLibrary();assert.match(h.dialog.innerHTML,/没做完的事/);
 const imported={...JSON.parse(JSON.stringify(trip)),id:'unsafe-text',title:'<img src=x onerror=alert(1)>'};H.importTrip(h.s,imported,box.QibanExpeditions);h.ui.openLibrary();assert.match(h.dialog.innerHTML,/&lt;img/);assert.doesNotMatch(h.dialog.innerHTML,/<img src=x/);
});
test('voice rules preserve evidence, fields and the original request',()=>{
 const original={messages:[{role:'system',content:'Use JSON.'},{role:'user',content:'{"text":"原话"}'}],model:'same'};
 const revised=withQixiVoice(original);assert.equal(original.messages[0].content,'Use JSON.');assert.equal(revised.messages[1].content,original.messages[1].content);assert.equal(revised.model,'same');assert.match(revised.messages[0].content,/保持原文/);assert.match(revised.messages[0].content,/不能编造/);
});

test('whole frontend boots with legacy records, and background visit writes cannot overwrite another tab',async()=>{
 const s=fixture();s.schema=1;s.scope='自己先用';s.contracts={};s.createdAt='2026-09-22T08:00:00Z';
 for(const a of s.attempts)a.feedback={grade:'C',label:'AI 反馈',hint:'',checks:[]};
 for(const w of Object.values(s.stageWork))w.reviews=[];
 const store=new Map([['qiban.growth.prototype.v1',JSON.stringify(s)]]),initial=store.get('qiban.growth.prototype.v1');
 const events=new Map(),elements=new Map();
 function element(){return {innerHTML:'',textContent:'',hidden:false,open:false,dataset:{},classList:{toggle(){},add(){},remove(){},contains(){return false;}},addEventListener(){},setAttribute(){},removeAttribute(){},querySelector(){return element();},querySelectorAll(){return [];}};}
 const document={visibilityState:'visible',activeElement:null,querySelector(selector){if(selector.startsWith('meta['))return null;if(!elements.has(selector))elements.set(selector,element());return elements.get(selector);},querySelectorAll(){return [];},addEventListener(type,fn){events.set('document:'+type,fn);}};
 const env={URL,Date,console,document,location:{protocol:'file:',hash:'#now'},localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)},setTimeout,clearTimeout};
 env.window={addEventListener:(type,fn)=>events.set('window:'+type,fn),scrollTo(){}};
 for(const name of ['attachment-input.js','stage-state.js','record-input.js','action-state.js','home-state.js','expedition-data.js','research-cards.js','home-ui.js','project-state.js','app.js'])vm.runInNewContext(await readFile(new URL('../'+name,import.meta.url),'utf8'),env,{filename:name});
 await new Promise(resolve=>setImmediate(resolve));
 assert.match(elements.get('#main').innerHTML,/上次|回来/);assert.match(elements.get('#main').innerHTML,/收下这一条/);assert.match(elements.get('#main').innerHTML,/data-home-attempt="a1"/);
 assert.equal(store.get('qiban.growth.prototype.v1'),initial,'initial visit must not rewrite legacy action data');
 env.location.hash='#outings';events.get('window:hashchange')();assert.match(elements.get('#main').innerHTML,/brought-page/);assert.match(elements.get('#main').innerHTML,/我收下的/);assert.match(elements.get('#main').innerHTML,/data-trip-finding="resume-plan"/);
 env.location.hash='#history';events.get('window:hashchange')();assert.match(elements.get('#main').innerHTML,/每一版，都算数/);
 env.location.hash='#now';events.get('window:hashchange')();assert.match(elements.get('#main').innerHTML,/收下这一条/);assert.equal(store.get('qiban.growth.prototype.v1'),initial);
 const newer=JSON.parse(initial);newer.attempts.push({...newer.attempts[1],id:'written-in-another-tab'});store.set('qiban.growth.prototype.v1',JSON.stringify(newer));
 events.get('window:pagehide')();assert.equal(JSON.parse(store.get('qiban.growth.prototype.v1')).attempts.at(-1).id,'written-in-another-tab');assert.ok(store.has('qiban.growth.visits.v1'));
});


test('each structured finding keeps its source, original text and scope after import',()=>{
 const trip=H.validateTrip(box.QibanExpeditions[0]);assert.equal(trip.findings.length,3);
 assert.equal(trip.findings[0].kind,'quote');assert.match(trip.findings[0].original,/current trajectory/);assert.match(trip.findings[0].attribution,/译/);
 assert.match(trip.findings[1].evidenceNote,/没有验证隔几天/);
 for(const f of trip.findings)for(const i of f.sourceIndexes)assert.ok(trip.sources[i].url.startsWith('https://'));
 const roundtrip=H.validateTrip(JSON.parse(JSON.stringify(trip)));assert.equal(JSON.stringify(roundtrip),JSON.stringify(trip));
});
test('malformed findings fail import instead of losing their attribution',()=>{
 const trip=JSON.parse(JSON.stringify(box.QibanExpeditions[0])),f=trip.findings[0];
 for(const patch of [{sourceIndexes:[]},{sourceIndexes:[99]},{sourceIndexes:[0.5]},{kind:42},{layout:'executable'},{original:''},{checkedAt:'invalid'},{id:'__proto__'},{headline:'x'.repeat(101)},{application:null}])assert.throws(()=>H.validateTrip({...trip,findings:[{...f,...patch}]}));
 assert.throws(()=>H.validateTrip({...trip,findings:[f,f]}));
 assert.throws(()=>H.validateTrip({...trip,findings:[{...trip.findings[1],steps:[]}]}));
});
test('the first screen contains the actual finding and a direct citation; detail adds the application',()=>{
 const trip=H.validateTrip(box.QibanExpeditions[0]);
 for(const f of trip.findings){
  const html=box.QibanResearch.render(trip,f.id);assert.ok(html.includes(f.headline));assert.ok(html.includes(trip.sources[f.sourceIndexes[0]].url));assert.ok(html.includes(f.voice));
  assert.doesNotMatch(html,/research-application/);assert.match(html,new RegExp('data-research-pick="'+f.id+'"[^>]*aria-pressed="true"'));
  if(f.steps)for(const step of f.steps)assert.ok(html.includes(step));
  const detail=box.QibanResearch.render(trip,f.id,{expanded:true});assert.ok(detail.includes(f.application.body));assert.ok(detail.includes(f.evidenceNote));assert.match(detail,/rel="noopener noreferrer"/);
 }
});
test('finding text and source titles are escaped, including quoted originals and examples',()=>{
 const trip=JSON.parse(JSON.stringify(box.QibanExpeditions[0])),payload='<img src=x onerror="alert(1)">';
 Object.assign(trip.findings[0],{headline:payload,voice:payload,original:payload});trip.findings[0].application.lines=[payload];trip.sources[3].title=payload;
 const html=box.QibanResearch.render(H.validateTrip(trip),'direction',{expanded:true});assert.doesNotMatch(html,/<img/);assert.match(html,/&lt;img/);
});
test('switching and saving individual findings does not create actions or transfer feedback',()=>{
 const h=harness(),before=immutable(h.s),trip=box.QibanExpeditions[0];
 h.click(h.main,{trip:trip.id});assert.doesNotMatch(h.dialog.innerHTML,/data-home-command="try-trip"/);
 h.click(h.dialog,{homeCommand:'try-trip'});assert.equal(h.added(),0);
 h.click(h.dialog,{homeCommand:'save-trip'});assert.equal(H.findingResponse(h.s,trip.id,'direction').saved,true);
 h.click(h.dialog,{researchPick:'resume-plan',researchTrip:trip.id,researchScope:'dialog'});assert.match(h.dialog.innerHTML,/先花一分钟/);
 assert.equal(H.findingResponse(h.s,trip.id,'resume-plan').saved,undefined);
 h.click(h.dialog,{homeCommand:'miss-trip'});assert.equal(H.findingResponse(h.s,trip.id,'resume-plan').verdict,'miss');
 h.click(h.main,{researchPick:'quieter-home',researchTrip:trip.id,researchScope:'home'});
 h.click(h.main,{homeCommand:'save-finding',tripTarget:trip.id});assert.equal(H.findingResponse(h.s,trip.id,'quieter-home').saved,true);
 assert.equal(H.findingResponse(h.s,trip.id,'direction').saved,true);assert.equal(h.added(),0);assert.equal(immutable(h.s),before);
 const reload=JSON.parse(JSON.stringify(h.s));assert.equal(H.findingResponse(reload,trip.id,'resume-plan').verdict,'miss');
});
test('previous unstructured research and whole-trip reactions remain usable',()=>{
 const h=harness(),trip=JSON.parse(JSON.stringify(box.QibanExpeditions[0]));delete trip.findings;trip.id='older-trip';
 H.importTrip(h.s,trip);H.respond(h.s,trip.id,{saved:true});h.click(h.main,{trip:trip.id});
 assert.ok(h.dialog.innerHTML.includes(trip.intro));assert.match(h.dialog.innerHTML,/已收下这一趟/);
 h.click(h.dialog,{homeCommand:'save-trip'});assert.equal(H.response(h.s,trip.id).saved,false);
 assert.equal(box.QibanResearch.render(trip), '');
});


test('one trip can contain three quotes from the same source, each selectable and independently saved',()=>{
 const h=harness(),raw=JSON.parse(JSON.stringify(box.QibanExpeditions[0]));raw.id='three-quotes';
 raw.findings=[1,2,3].map(i=>({...raw.findings[0],id:'quote-'+i,teaser:'测试主题 '+i,headline:'测试引用 '+i,original:'Fixture quote '+i}));
 assert.equal(H.importTrip(h.s,raw),true);const trip=H.trips(h.s,box.QibanExpeditions).find(t=>t.id===raw.id);
 assert.equal(trip.findings.length,3);assert.ok(trip.findings.every(f=>f.layout==='quote'));
 h.click(h.main,{trip:trip.id});h.click(h.dialog,{homeCommand:'save-trip'});
 h.click(h.dialog,{researchPick:'quote-2',researchTrip:trip.id,researchScope:'dialog'});h.click(h.dialog,{homeCommand:'miss-trip'});
 assert.equal(H.findingResponse(h.s,trip.id,'quote-1').saved,true);assert.equal(H.findingResponse(h.s,trip.id,'quote-2').verdict,'miss');assert.equal(Object.keys(H.findingResponse(h.s,trip.id,'quote-3')).length,0);
 const html=box.QibanResearch.render(trip,'quote-3');assert.match(html,/测试引用 3/);assert.match(html,/测试主题 1/);assert.match(html,/测试主题 2/);assert.doesNotMatch(html,/书里的一句话|论文里的方法|产品里的设计/);assert.equal(h.added(),0);
});
test('new content types use a general layout and do not require inventing application homework',()=>{
 const raw=JSON.parse(JSON.stringify(box.QibanExpeditions[0]));
 raw.findings=['访谈提纲','反例','一个疑问的答案'].map((kind,i)=>{
  const f={...raw.findings[0],id:'open-type-'+i,kind,headline:'测试发现 '+i,body:'已经整理好的测试正文。',points:['测试要点一','测试要点二']};delete f.original;delete f.application;return f;
 });
 const trip=H.validateTrip(raw);
 for(const f of trip.findings){
  assert.equal(f.layout,'note');const html=box.QibanResearch.render(trip,f.id,{expanded:true});assert.match(html,/已经整理好的测试正文/);assert.match(html,/测试要点二/);assert.match(html,/research-layout-note/);assert.doesNotMatch(html,/research-application|undefined/);
 }
 const reload=H.validateTrip(JSON.parse(JSON.stringify(trip)));assert.equal(reload.findings[0].kind,'访谈提纲');
});
test('presentation is independent of source and content type; unsafe content cannot become markup',()=>{
 const raw=JSON.parse(JSON.stringify(box.QibanExpeditions[0]));
 raw.findings=[{...raw.findings[1],kind:'访谈模板',layout:'steps'}];
 let trip=H.validateTrip(raw);assert.equal(trip.findings[0].layout,'steps');assert.match(box.QibanResearch.render(trip),/research-layout-steps/);
 raw.findings[0]={...raw.findings[0],kind:'<img src=x onerror=1>',layout:'note',body:'<img src=x onerror=1>',points:['<script>bad</script>']};
 trip=H.validateTrip(raw);const html=box.QibanResearch.render(trip);assert.doesNotMatch(html,/<img|<script>/);assert.match(html,/&lt;script/);assert.match(html,/research-layout-note/);
 const legacy=JSON.parse(JSON.stringify(box.QibanExpeditions[0]));assert.deepEqual(Array.from(H.validateTrip(legacy).findings,f=>f.layout),['quote','steps','flow']);
});


test('product library lists individual finds and saved filter opens the exact selected find',()=>{
 const h=harness(),trip=box.QibanExpeditions[0],before=immutable(h.s);
 assert.match(h.ui.libraryHTML(),/data-trip-finding="direction"/);assert.match(h.ui.libraryHTML(),/data-trip-finding="resume-plan"/);
 h.click(h.main,{trip:trip.id,tripFinding:'resume-plan'});assert.match(h.dialog.innerHTML,/先花一分钟/);h.click(h.dialog,{homeCommand:'save-trip'});
 h.ui.openLibrary();h.click(h.dialog,{libraryFilter:'saved'});
 assert.match(h.dialog.innerHTML,/data-trip-finding="resume-plan"/);assert.doesNotMatch(h.dialog.innerHTML,/data-trip-finding="direction"/);
 h.click(h.dialog,{trip:trip.id,tripFinding:'resume-plan'});assert.match(h.dialog.innerHTML,/已收下这一条/);assert.equal(immutable(h.s),before);
 const reload=JSON.parse(JSON.stringify(h.s));assert.equal(H.response(reload,trip.id).selectedFinding,'resume-plan');
});
test('a hidden trip remains in the library and can be restored without creating an action',()=>{
 const h=harness(),trip=box.QibanExpeditions[0],before=immutable(h.s);h.click(h.main,{trip:trip.id});h.click(h.dialog,{homeCommand:'hide-trip'});
 assert.doesNotMatch(h.ui.homeHTML(),/research-outing/);assert.match(h.ui.libraryHTML(),/放回首页/);
 h.click(h.main,{restoreTrip:trip.id});assert.match(h.ui.homeHTML(),/research-outing/);assert.doesNotMatch(h.ui.libraryHTML(),/放回首页/);assert.equal(h.added(),0);assert.equal(immutable(h.s),before);
});
