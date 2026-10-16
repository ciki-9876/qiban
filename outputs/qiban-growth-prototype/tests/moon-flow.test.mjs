import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const scripts=await Promise.all(['attachment-input.js','stage-state.js','record-input.js','action-state.js','home-state.js','expedition-data.js','research-cards.js','home-ui.js','project-state.js','app.js'].map(async name=>({name,source:await readFile(new URL('../'+name,import.meta.url),'utf8')})));
async function fixture({draft='',workspace=null}={}){
  const events=new Map(),elements=new Map(),timers=new Map();let time=0,serial=0,moon;
  const emit=(owner,type,event={})=>{for(const fn of events.get(owner+':'+type)||[])fn(event);};
  function element(name){
    const classes=new Set(),el={name,dataset:{},isConnected:true,open:false,hidden:false,textContent:'',value:'',
      classList:{add:(...names)=>names.forEach(n=>classes.add(n)),remove:(...names)=>names.forEach(n=>classes.delete(n)),contains:n=>classes.has(n),toggle(n,on){on?classes.add(n):classes.delete(n);}},
      addEventListener(type,fn){const key=name+':'+type;events.set(key,[...(events.get(key)||[]),fn]);},setAttribute(){},removeAttribute(){},focus(){document.activeElement=el;},close(){el.open=false;},showModal(){el.open=true;},
      querySelector(selector){if(name==='#main'&&selector==='#sail-button')return moon;if(name==='#workspace-dialog'&&/^#(action-text|log-note)$/.test(selector)&&!el.innerHTML.includes('id="'+selector.slice(1)+'"'))return null;return get(name+' '+selector);},querySelectorAll(){return [];},closest(selector){return selector==='.sail-button'&&name!=='moon'?null:el;}};
    let html='';Object.defineProperty(el,'innerHTML',{get:()=>html,set(value){html=value;if(name==='#main'){if(moon)moon.isConnected=false;const id=value.match(/data-sail-task="([^"]+)"/);moon=id?element('moon'):null;if(moon){moon.dataset.sailTask=id[1];classes.add('sail-button');}}}});
    return el;
  }
  function get(name){if(!elements.has(name))elements.set(name,element(name));return elements.get(name);}
  const document={visibilityState:'visible',activeElement:null,querySelector:s=>s.startsWith('meta[')?null:get(s),querySelectorAll:()=>[],addEventListener(type,fn){const k='document:'+type;events.set(k,[...(events.get(k)||[]),fn]);}};
  const contract={kind:'decision',outcome:'记录一步',criteria:[{label:'真实记录',method:'content'}]};
  const attempt={id:'previous',taskId:'task',taskTitle:'测试小步',branch:'stage',text:'已经留下的原文',createdAt:new Date().toISOString(),provenance:'自己写下',contract,artifacts:[],aiStatus:'waiting',feedback:{grade:'—',checks:[],strength:'等待反馈'}};
  const project={schema:1,id:'project',status:'active',goal:'测试目标',scope:'',branch:'stage',branches:[{id:'stage',num:'01',name:'第一段',outcome:'记录'}],tasks:[{id:'task',branch:'stage',title:'测试小步',kind:'一句话',prompt:'记下这次体验',choices:[],custom:true,contract}],attempts:[attempt],drafts:draft?{task:typeof draft==='string'?{text:draft}:draft}:{},accepted:{},contracts:{},customTasks:[],snapshots:[],adoptions:[],stageWork:{},stageRounds:[],closures:[],createdAt:new Date().toISOString()};
  const original=JSON.stringify(attempt),store=new Map([['qiban.growth.prototype.v1',JSON.stringify(workspace||{schema:2,selectedId:'project',projects:[project]})]]);
  const env={URL,Date,console,document,location:{protocol:'file:',hash:'#now'},localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)},setTimeout(fn,ms){const id=++serial;timers.set(id,{fn,at:time+ms});return id;},clearTimeout:id=>timers.delete(id)};
  env.window={addEventListener(type,fn){const k='window:'+type;events.set(k,[...(events.get(k)||[]),fn]);},scrollTo(){}};
  for(const {name,source} of scripts)vm.runInNewContext(source,env,{filename:name});
  await new Promise(resolve=>setImmediate(resolve));
  const advance=ms=>{const end=time+ms;while(true){const next=[...timers.entries()].filter(([,t])=>t.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;time=next[1].at;timers.delete(next[0]);next[1].fn();}time=end;};
  return {env,document,get,emit,advance,moon:()=>moon,dialog:get('#workspace-dialog'),original,stored:()=>JSON.parse(store.get('qiban.growth.prototype.v1')),start(){emit('#main','keydown',{target:moon,key:' ',repeat:false,preventDefault(){}});}};
}

test('the featured repeat entry opens an editor without replacing the previous attempt or unfinished draft',async()=>{
  const f=await fixture({draft:'还没写完的新草稿'});
  assert.match(f.get('#main').innerHTML,/data-compose="true"/);
  f.emit('#main','click',{target:{closest:()=>({dataset:{openTask:'task',compose:'true'}})}});
  assert.equal(f.dialog.open,true);assert.match(f.dialog.innerHTML,/id="action-text"/);assert.match(f.dialog.innerHTML,/还没写完的新草稿/);
  assert.equal(JSON.stringify(f.stored().projects[0].attempts[0]),f.original);
});

test('a completed hold records the step on the route, keeps the previous entry, and offers an optional log',async()=>{
  const f=await fixture();f.start();f.advance(900);f.emit('window','keyup',{key:' '});f.advance(420);
  assert.equal(f.dialog.open,true);assert.match(f.dialog.innerHTML,/id="log-note"/);assert.match(f.dialog.innerHTML,/这一程走完了/);assert.doesNotMatch(f.dialog.innerHTML,/class="feedback-header"/);
  const p=f.stored().projects[0];assert.equal(p.attempts.length,2);assert.equal(JSON.stringify(p.attempts[0]),f.original);
  const added=p.attempts[1];assert.equal(p.accepted.task,added.id);assert.equal(added.text,'');assert.equal(added.quick,true);assert.equal(p.adoptions.at(-1).attemptId,added.id);
});

test('the optional log note is written once into the new entry and never into the previous one',async()=>{
  const f=await fixture({draft:'没写完的半句'});f.start();f.advance(900);f.advance(420);
  assert.match(f.dialog.innerHTML,/没写完的半句/);f.get('#workspace-dialog #log-note').value='  游完了 25 米  ';
  f.emit('#workspace-dialog','click',{target:{closest:()=>({dataset:{modalCommand:'log-save'}})}});
  const p=f.stored().projects[0];assert.equal(p.attempts[1].text,'游完了 25 米');assert.equal(p.attempts[1].provenance,'自己写下');assert.equal(JSON.stringify(p.attempts[0]),f.original);assert.equal(p.drafts.task,undefined);assert.equal(f.dialog.open,false);
});

test('skipping the log keeps the completed step without text',async()=>{
  const f=await fixture();f.start();f.advance(900);f.advance(420);
  f.emit('#workspace-dialog','click',{target:{closest:()=>({dataset:{modalCommand:'log-skip'}})}});
  const p=f.stored().projects[0];assert.equal(f.dialog.open,false);assert.equal(p.attempts.length,2);assert.equal(p.attempts[1].text,'');assert.ok(p.accepted.task);
});

test('releasing a short hold outside main never opens a record',async()=>{
  const f=await fixture();f.start();f.advance(100);f.emit('window','keyup',{key:' '});f.advance(2000);assert.equal(f.dialog.open,false);assert.equal(f.stored().projects[0].attempts.length,1);
});

test('pointer release and capture loss after completion keep the intentional record opening',async()=>{
  const f=await fixture();f.emit('#main','pointerdown',{target:f.moon(),button:0,pointerId:1,preventDefault(){}});f.advance(900);
  f.emit('#main','pointerup');f.emit('#main','lostpointercapture');f.advance(420);
  assert.equal(f.dialog.open,true);assert.match(f.dialog.innerHTML,/id="log-note"/);
});

test('system pointer cancellation also cancels a completed gesture before the editor opens',async()=>{
  const f=await fixture();f.start();f.advance(900);f.emit('#main','pointercancel');f.advance(420);assert.equal(f.dialog.open,false);assert.equal(f.stored().projects[0].attempts.length,1);
});

test('focus loss cancels both the active hold and its completed-but-not-opened animation',async()=>{
  for(const elapsed of [100,900]){
    const f=await fixture();f.start();f.advance(elapsed);f.emit('#main','focusout',{target:f.moon()});f.advance(2000);assert.equal(f.dialog.open,false);
  }
});

test('navigation, hidden pages, window blur, native pause, and account changes cancel pending record openings',async()=>{
  for(const elapsed of [100,900])for(const change of ['navigation','hidden','blur','native-pause','account']){
    const f=await fixture();f.start();f.advance(elapsed);
    if(change==='navigation'){f.env.location.hash='#history';f.emit('window','hashchange');}
    if(change==='hidden'){f.document.visibilityState='hidden';f.emit('document','visibilitychange');}
    if(change==='blur')f.emit('window','blur');
    if(change==='native-pause')f.emit('window','qiban:lifecycle',{detail:{active:false}});
    if(change==='account')f.emit('window','qiban:account-changed');
    f.advance(2000);assert.equal(f.dialog.open,false,change+' at '+elapsed);assert.equal(f.stored().projects[0].attempts.length,1,change+' at '+elapsed);
  }
});

test('a detached sail button cannot complete an old task after the animation',async()=>{
  const f=await fixture();f.start();f.advance(900);f.moon().isConnected=false;f.advance(420);assert.equal(f.dialog.open,false);assert.equal(f.stored().projects[0].attempts.length,1);
});


test('quick log typing survives closing the process and stays separate from the original attempt',async()=>{
 const f=await fixture();f.start();f.advance(1320);f.emit('#workspace-dialog','input',{target:{id:'log-note',value:'离线写到这里，待会继续',dataset:{}}});
 const saved=f.stored(),id=saved.projects[0].attempts[1].id;assert.equal(saved.projects[0].logDrafts[id].text,'离线写到这里，待会继续');assert.equal(saved.projects[0].attempts[1].text,'');
 const k=await fixture({workspace:saved});k.emit('#main','click',{target:{closest:()=>({dataset:{openAttempt:id}})}});k.emit('#workspace-dialog','click',{target:{closest:()=>({dataset:{modalCommand:'log-add'}})}});
 assert.match(k.dialog.innerHTML,/离线写到这里，待会继续/);assert.equal(JSON.stringify(k.stored().projects[0].attempts[0]),f.original);
 k.get('#workspace-dialog #log-note').value='写完的日志';k.emit('#workspace-dialog','click',{target:{closest:()=>({dataset:{modalCommand:'log-save'}})}});
 assert.equal(k.stored().projects[0].attempts[1].text,'写完的日志');assert.equal(k.stored().projects[0].logDrafts[id],undefined);
});
test('saving a quick note never drops existing attachment and delivery draft references',async()=>{
 const draft={text:'原草稿',artifacts:[{id:'fixture-attachment',name:'样例.txt'}],link:'https://example.org/evidence',contract:{kind:'artifact',outcome:'交付',criteria:[]}};
 const f=await fixture({draft});f.start();f.advance(1320);f.get('#workspace-dialog #log-note').value='快捷日志';f.emit('#workspace-dialog','click',{target:{closest:()=>({dataset:{modalCommand:'log-save'}})}});
 const p=f.stored().projects[0];assert.equal(p.drafts.task.artifacts[0].id,'fixture-attachment');assert.equal(p.drafts.task.link,draft.link);assert.equal(p.drafts.task.text,draft.text);
 f.emit('#main','click',{target:{closest:()=>({dataset:{openAttempt:p.attempts[1].id}})}});assert.match(f.dialog.innerHTML,/data-modal-command="resume-draft"/);
});
