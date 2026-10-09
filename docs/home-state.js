/* Read-only recaps and separate visit/research state; never changes action history. */
(function(root){
  const copy=value=>JSON.parse(JSON.stringify(value));
  const sameGoal=(a,b)=>String(a||'').replace(/\s/g,'')===String(b||'').replace(/\s/g,'');
  const time=value=>{const n=Date.parse(value);return Number.isFinite(n)?n:0;};
  function ensure(state){
    if(!state.homecoming||typeof state.homecoming!=='object'||Array.isArray(state.homecoming))state.homecoming={};
    if(!state.outings||typeof state.outings!=='object'||Array.isArray(state.outings))state.outings={};
    if(!Array.isArray(state.outings.items))state.outings.items=[];
    if(!state.outings.responses||typeof state.outings.responses!=='object'||Array.isArray(state.outings.responses))state.outings.responses={};
    return state;
  }
  function relevantAttempts(state){return (state.attempts||[]).filter(a=>!a.goal||sameGoal(a.goal,state.goal));}
  function visit(state,now=new Date().toISOString()){
    ensure(state);const h=state.homecoming,nowMs=time(now);
    const historical=Math.max(0,...relevantAttempts(state).map(a=>time(a.createdAt)),...(state.stageRounds||[]).filter(r=>!r.goal||sameGoal(r.goal,state.goal)).map(r=>time(r.closedAt)),...Object.values(state.drafts||{}).map(d=>time(d?.updatedAt)));
    const previous=time(h.lastSeenAt)||historical;
    if(h.goal&&!sameGoal(h.goal,state.goal)){h.returning=false;h.quietUntil=null;}
    if(previous&&nowMs-previous>=48*60*60*1000){h.returning=true;h.arrivedAt=now;h.quietUntil=null;}
    if(time(h.quietUntil)<=nowMs)h.quietUntil=null;
    h.goal=state.goal;h.lastSeenAt=now;
    return {returning:Boolean(h.returning),previous:previous?new Date(previous).toISOString():null};
  }
  function touch(state,now=new Date().toISOString()){ensure(state);state.homecoming.lastSeenAt=now;}
  function resume(state){ensure(state);state.homecoming.returning=false;state.homecoming.quietUntil=null;}
  function rest(state,now=new Date().toISOString()){
    ensure(state);const end=new Date(now);end.setHours(24,0,0,0);state.homecoming.quietUntil=end.toISOString();state.homecoming.returning=false;
  }
  function hasDraft(d){return Boolean(d&&(String(d.text||'').trim()||d.artifacts?.length||String(d.link||'').trim()));}
  function recap(state,branches,tasks){
    const branch=branches.find(b=>b.id===state.branch)||branches[0];
    const ids=new Set(tasks.filter(t=>t.branch===branch.id&&!state.hiddenActions?.[t.id]).map(t=>t.id));
    const attempts=relevantAttempts(state),local=attempts.filter(a=>a.branch===branch.id);
    const latest=local.at(-1)||null;
    const adopted=local.filter(a=>state.accepted?.[a.taskId]===a.id);
    const adoptionTime=a=>Math.max(time(a.createdAt),...(state.adoptions||[]).filter(x=>x.attemptId===a.id).map(x=>time(x.at)));
    const achievement=[...adopted].sort((a,b)=>adoptionTime(b)-adoptionTime(a))[0]||null;
    const drafts=Object.entries(state.drafts||{}).filter(([id,d])=>ids.has(id)&&hasDraft(d)).sort((a,b)=>time(b[1].updatedAt)-time(a[1].updatedAt));
    const draft=drafts[0]?{taskId:drafts[0][0],title:tasks.find(t=>t.id===drafts[0][0])?.title,...copy(drafts[0][1])}:null;
    const work=state.stageWork?.[branch.id];
    const closed=work?.closedId?(state.stageRounds||[]).find(r=>r.id===work.closedId)||null:null;
    const lastClosed=(state.stageRounds||[]).filter(r=>!r.goal||sameGoal(r.goal,state.goal)).at(-1)||null;
    return {branch,round:work?.round||1,closed,lastClosed,latest,achievement,draft,anchor:achievement||latest,total:attempts.length,adoptedCount:attempts.filter(a=>state.accepted?.[a.taskId]===a.id).length,hasHistory:Boolean(attempts.length||draft||lastClosed)};
  }
  function sourceURL(value){
    try{const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password)return '';const host=u.hostname.toLowerCase();if(host==='localhost'||host.endsWith('.local')||host.endsWith('.localhost')||/^[\d.]+$/.test(host)||host.includes(':'))return '';return u.href;}catch{return '';}
  }
  function validateTrip(value,goal){
    if(!value||value.schema!=='qiban-expedition-v1')throw Error('这份文件不是栖栖的外出记录。');
    const string=(v,n,label)=>{if(typeof v!=='string'||!v.trim()||v.length>n)throw Error(label+'不完整或太长了。');return v.trim();};
    const id=string(value.id,90,'编号');if(!/^[a-zA-Z0-9_-]+$/.test(id)||['__proto__','constructor','prototype'].includes(id))throw Error('外出编号不正确。');
    const tripGoal=string(value.goal,180,'目标');if(goal&&!sameGoal(goal,tripGoal))throw Error('这份调研对应另一个目标，先切换目标再导入。');
    if(!time(value.completedAt))throw Error('缺少调研日期。');
    if(!Array.isArray(value.sources)||!value.sources.length||value.sources.length>8)throw Error('需要 1–8 个资料来源。');
    const sources=value.sources.map(s=>{const url=sourceURL(s.url);if(!url)throw Error('资料来源需要公开的 HTTPS 链接。');return {title:string(s.title,120,'来源标题'),url,note:string(s.note,360,'来源摘要')};});
    const trip={schema:value.schema,id,goal:tripGoal,completedAt:new Date(value.completedAt).toISOString(),title:string(value.title,80,'标题'),intro:string(value.intro,500,'发现'),suggestion:string(value.suggestion,500,'建议'),sources};
    if(value.findings!==undefined){
      if(!Array.isArray(value.findings)||!value.findings.length||value.findings.length>5)throw Error('每趟外出需要 1–5 条发现。');
      const ids=new Set();
      const lines=(v,label)=>{if(!Array.isArray(v)||v.length<1||v.length>4)throw Error(label+'需要 1–4 项。');return v.map(x=>string(x,220,label));};
      trip.findings=value.findings.map(f=>{
        if(!f||typeof f!=='object'||Array.isArray(f))throw Error('发现内容不正确。');
        // Content types are open-ended. Only the safe display layouts are enumerated.
        const kind=f.kind===undefined?'发现':string(f.kind,40,'内容类型');
        const layout=f.layout??(kind==='quote'?'quote':kind==='method'?'steps':kind==='design'?'flow':'note');
        if(!['quote','steps','flow','note'].includes(layout))throw Error('呈现方式不正确。');
        const fid=string(f.id,60,'发现编号');if(!/^[a-zA-Z0-9_-]+$/.test(fid)||['__proto__','constructor','prototype'].includes(fid)||ids.has(fid))throw Error('发现编号不正确或重复。');ids.add(fid);
        if(!Array.isArray(f.sourceIndexes)||!f.sourceIndexes.length||f.sourceIndexes.length>4||f.sourceIndexes.some(i=>!Number.isInteger(i)||i<0||i>=sources.length))throw Error('每条发现都需要对应的资料来源。');
        if(!time(f.checkedAt))throw Error('发现缺少查阅日期。');
        const item={id:fid,kind,layout,teaser:string(f.teaser,40,'简述'),headline:string(f.headline,100,'发现标题'),attribution:string(f.attribution,140,'出处'),sourceIndexes:[...new Set(f.sourceIndexes)],checkedAt:new Date(f.checkedAt).toISOString(),voice:string(f.voice,350,'栖栖的话'),evidenceNote:string(f.evidenceNote,500,'出处说明')};
        if(f.application!==undefined){
          if(!f.application||typeof f.application!=='object'||Array.isArray(f.application))throw Error('栖栖的想法不完整。');
          item.application={title:string(f.application.title,60,'想法标题'),body:string(f.application.body,400,'想法内容')};
          if(f.application.lines!==undefined)item.application.lines=lines(f.application.lines,'示例');
        }
        if(f.context!==undefined)item.context=string(f.context,300,'背景');
        if(f.body!==undefined)item.body=string(f.body,1200,'正文');
        if(f.points!==undefined)item.points=lines(f.points,'要点');
        if(layout==='quote'||f.original!==undefined)item.original=string(f.original,500,'引用原文');
        if(layout==='steps'||layout==='flow'||f.steps!==undefined)item.steps=lines(f.steps,'步骤');
        return item;
      });
    }
    return trip;
  }
  function trips(state,bundled=[]){
    const byId=new Map();for(const raw of [...bundled,...(state.outings?.items||[])]){
      try{const t=validateTrip(raw);if(sameGoal(t.goal,state.goal)&&!byId.has(t.id))byId.set(t.id,t);}catch{}
    }
    return [...byId.values()].sort((a,b)=>time(b.completedAt)-time(a.completedAt));
  }
  function response(state,id){return state.outings?.responses&&Object.hasOwn(state.outings.responses,id)?state.outings.responses[id]:{};}
  function respond(state,id,patch){ensure(state);const r=state.outings.responses[id]||{};state.outings.responses[id]={...r,...patch};return state.outings.responses[id];}
  function findingResponse(state,tripId,findingId){const records=response(state,tripId).findings;return records&&Object.hasOwn(records,findingId)?records[findingId]:{};}
  function respondFinding(state,tripId,findingId,patch){
    if(!/^[a-zA-Z0-9_-]{1,60}$/.test(findingId)||['__proto__','constructor','prototype'].includes(findingId))throw Error('发现编号不正确。');
    return respond(state,tripId,{findings:{...response(state,tripId).findings,[findingId]:{...findingResponse(state,tripId,findingId),...patch}}});
  }
  function importTrip(state,raw,bundled=[]){
    const trip=validateTrip(raw,state.goal);ensure(state);
    if(trips(state,bundled).some(t=>t.id===trip.id))return false;
    state.outings.items.push(trip);return true;
  }
  root.QibanHome={ensure,visit,touch,resume,rest,recap,trips,response,respond,findingResponse,respondFinding,importTrip,validateTrip,sourceURL,sameGoal};
})(globalThis);
