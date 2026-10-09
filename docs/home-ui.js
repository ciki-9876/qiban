(function(root){
  function create(o){
    const H=root.QibanHome,S=()=>o.state(),esc=o.escape;
    let tripId=null,libraryFilter='all';
    const selections=new Map();
    const findingFor=t=>root.QibanResearch.current(t,selections.get((o.projectKey?.()||'')+t.id)||H.response(S(),t.id).selectedFinding);
    const responseFor=t=>findingFor(t)?H.findingResponse(S(),t.id,findingFor(t).id):H.response(S(),t.id);
    const respondTo=(t,patch)=>findingFor(t)?H.respondFinding(S(),t.id,findingFor(t).id,patch):H.respond(S(),t.id,patch);
    const researchHTML=(trip,options={})=>root.QibanResearch.render(trip,findingFor(trip)?.id,{...options,savedIds:(trip.findings||[]).filter(f=>H.findingResponse(S(),trip.id,f.id).saved).map(f=>f.id)});
    const list=()=>H.trips(S(),root.QibanExpeditions);
    const recap=()=>H.recap(S(),o.branches,o.tasks());
    const button=(command,label,extra='')=>`<button class="text-button" data-home-command="${command}" ${extra}>${label}</button>`;
    const excerpt=(text,n=150)=>String(text||'').length>n?String(text).slice(0,n)+'…':String(text||'');
    const when=iso=>new Date(iso).toLocaleDateString('zh-CN',{month:'long',day:'numeric'});
    function homeHTML(){
      const s=S(),r=recap(),away=Boolean(s.homecoming?.returning),quiet=Date.parse(s.homecoming?.quietUntil)>Date.now();
      const trip=list().find(t=>!H.response(s,t.id).dismissedAt)||null;
      const anchor=r.anchor;
      return `<section class="home-welcome" aria-label="上次的进度">${r.hasHistory?`<div class="welcome-heading"><h2>${quiet?'今天就先看看。':away?'回来啦！':'上次，你写到这里。'}</h2>${button('recap','帮我回顾一下')}</div><p class="welcome-context">${quiet?'之前做的都还在，想继续的时候再来。':`上次你在${esc(r.branch.num)}「${esc(r.branch.name)}」${r.closed?'，这一轮已经收尾了。':'。'}`}</p>${anchor?`<button class="return-record" data-home-attempt="${esc(anchor.id)}"><span>${esc(anchor.taskTitle)}<small>${r.achievement?'你已采用的版本':'最近写下的版本'}</small></span><blockquote>${esc(excerpt(anchor.text)||'你在这一版留下了成果文件。')}</blockquote><span class="return-record-link">看看这一版 ${o.icon('arrow')}</span></button>`:''}${r.draft?`<button class="return-draft" data-home-draft="${esc(r.draft.taskId)}">${o.icon('pen')}「${esc(r.draft.title)}」还留着草稿<span>接着写 ${o.icon('arrow')}</span></button>`:''}`:''}
      ${trip?tripCard(trip):`<div class="outing-empty-link">${button('outings','看看栖栖带回的')}</div>`}
      ${away||quiet?`<div class="return-choices">${button('actions',quiet?'想做点什么了':'看看现在想做什么')}${away?button('rest','今天先看看'):''}</div>`:''}</section>`;
    }
    function tripCard(trip){
      const f=findingFor(trip),r=responseFor(trip);
      if(!f)return `<article class="outing-card"><div class="outing-eyebrow">栖栖出去看了看</div><h2>${esc(trip.title)}</h2><p>${esc(trip.intro)}</p><div class="outing-card-bottom"><button class="primary-button" data-trip="${esc(trip.id)}">听栖栖说说 ${o.icon('arrow')}</button>${button('outings','以前带回的')}</div></article>`;
      return `<article class="outing-card research-outing"><div class="outing-eyebrow">这次，想拿给你看 <span>${when(trip.completedAt)}</span></div>${researchHTML(trip)}<div class="outing-card-bottom"><button class="primary-button research-save" data-home-command="save-finding" data-trip-target="${esc(trip.id)}" aria-pressed="${Boolean(r.saved)}">${r.saved?'已收下这一条':'收下这一条'}</button><button class="text-button" data-trip="${esc(trip.id)}">看看栖栖的想法 ${o.icon('arrow')}</button>${button('outings','以前带回的')}</div></article>`;
    }
    function collapseActions(){const h=S().homecoming||{};return Boolean(h.returning||Date.parse(h.quietUntil)>Date.now());}
    function archiveHTML(){const seen=list().filter(t=>{const r=H.response(S(),t.id);return r.readAt||r.saved||Object.values(r.findings||{}).some(x=>x.saved);});return seen.length?`<div class="outing-history-link">${button('outings','栖栖带回的')}</div>`:'';}
    function show(mode,label,html){o.dialog.innerHTML=o.dialogTop(label)+`<div class="dialog-body home-dialog-body">${html}</div>`;o.openModal(mode);o.dialog.querySelector('#dialog-title')?.focus();}
    function openRecap(){
      const r=recap();
      show('home-recap','上次的进度',`<h2 id="dialog-title" tabindex="-1">我帮你理了一下。</h2><p class="recap-lead">你现在选中的是 ${esc(r.branch.num)}「${esc(r.branch.name)}」。${r.closed?'这一轮已经收尾，想再做一点也可以。':'这一轮还在继续，不用从头来。'}</p>
      ${r.lastClosed?`<div class="recap-row"><span>已收尾的阶段</span><button class="text-button" data-home-round="${esc(r.lastClosed.id)}">${esc(r.lastClosed.branchName)} · 第 ${r.lastClosed.round} 轮${r.lastClosed.grade&&r.lastClosed.grade!=='—'?`<strong class="recap-grade">${esc(r.lastClosed.grade)}</strong>`:''}${o.icon('arrow')}</button></div>`:''}
      ${r.achievement?`<div class="recap-row"><span>你已采用的成果</span><button class="text-button" data-home-attempt="${esc(r.achievement.id)}">${esc(r.achievement.taskTitle)} ${o.icon('arrow')}</button></div>`:''}
      ${r.latest&&r.latest.id!==r.achievement?.id?`<div class="recap-row"><span>后来又写了一版</span><button class="text-button" data-home-attempt="${esc(r.latest.id)}">${esc(r.latest.taskTitle)} ${o.icon('arrow')}</button></div>`:''}
      ${r.draft?`<div class="recap-row"><span>没写完的草稿</span><button class="text-button" data-home-draft="${esc(r.draft.taskId)}">${esc(r.draft.title)} ${o.icon('arrow')}</button></div>`:''}
      ${!r.hasHistory?'<p class="small-text">还没有留下记录，先挑一件你想做的就好。</p>':`<p class="recap-count">已经留下 ${r.total} 个版本，${r.adoptedCount} 个行动已收尾。</p>`}<div class="dialog-actions"><button class="text-button" data-home-command="rest">今天先看看</button><button class="primary-button" data-home-command="actions">看看想做什么 ${o.icon('arrow')}</button></div>`);
    }
    function openTrip(id,findingId){
      const trip=list().find(t=>t.id===id);if(!trip)return;
      if(findingId&&trip.findings?.some(f=>f.id===findingId))selections.set((o.projectKey?.()||'')+id,findingId);
      tripId=id;H.respond(S(),id,{selectedFinding:findingFor(trip)?.id,readAt:H.response(S(),id).readAt||new Date().toISOString()});o.save();
      renderTrip();
    }
    function renderTrip(){
      const trip=list().find(t=>t.id===tripId);if(!trip)return;
      const f=findingFor(trip),r=responseFor(trip),savedTrip=H.response(S(),trip.id),seed=trip.id==='qiban-return-20260929'&&(!f||f.id==='quieter-home');
      show('outing','栖栖带回的 · '+when(trip.completedAt),`${f?researchHTML(trip,{expanded:true,scope:'dialog'}):`<h2 id="dialog-title" tabindex="-1">${esc(trip.title)}</h2><p class="outing-speech">${esc(trip.intro)}</p><p class="outing-speech">${esc(trip.suggestion)}</p><details class="outing-sources"><summary>这些是在哪儿看到的？</summary>${trip.sources.map(s=>`<div><a href="${esc(H.sourceURL(s.url))}" target="_blank" rel="noopener noreferrer">${esc(s.title)} ↗</a><p>${esc(s.note)}</p></div>`).join('')}</details>`}
      <div class="outing-reactions"><button class="secondary-button ${r.saved?'selected':''}" data-home-command="save-trip" aria-pressed="${Boolean(r.saved)}">${r.saved?'已收下'+(f?'这一条':'这一趟'):'这个有用，收下了'}</button><button class="text-button" data-home-command="miss-trip" aria-pressed="${r.verdict==='miss'}">${r.verdict==='miss'?'记住了，这条没帮上忙':'这条没帮上忙'}</button></div>
      ${r.verdict==='miss'?`<div class="outing-reasons" role="group" aria-label="没帮上忙的原因">${['没什么新东西','不是我现在想看的','看完还是有压力'].map(reason=>`<button data-trip-reason="${esc(reason)}" aria-pressed="${r.reason===reason}">${esc(reason)}</button>`).join('')}</div>`:''}
      <div class="dialog-actions"><button class="text-button" data-home-command="hide-trip">这趟先收起来</button>${seed?`<button class="primary-button" data-home-command="try-trip">${savedTrip.actionId?'看看那次尝试':'试试首页回顾'} ${o.icon('arrow')}</button>`:`<button class="primary-button" data-modal-command="close">先看到这里</button>`}</div><p class="outing-status" role="status">${esc(r.reason?'这次的感受已经记下了。':r.saved?'收好啦，以后在“栖栖带回的”里还能找到。':'')}</p>`);
    }

    function libraryHTML({page=true}={}){
      const trips=list();
      const selected=trips.map(t=>{const r=H.response(S(),t.id);const findings=(t.findings||[]).filter(f=>libraryFilter!=='saved'||r.saved||H.findingResponse(S(),t.id,f.id).saved);return {t,r,findings};}).filter(({t,r,findings})=>libraryFilter!=='saved'||findings.length||(!t.findings&&r.saved));
      return `<section class="brought-page"><header class="brought-heading"><div><p>${esc(S().goal)}</p><${page?'h1':'h2'} id="${page?'brought-title':'dialog-title'}" tabindex="-1">栖栖带回的</${page?'h1':'h2'}></div></header><div class="brought-filters" role="group" aria-label="筛选带回的内容">${[['all','全部'],['saved','我收下的']].map(([key,label])=>`<button data-library-filter="${key}" aria-pressed="${libraryFilter===key}">${label}</button>`).join('')}</div><div class="brought-list">${selected.map(({t,r,findings})=>`<section class="brought-trip"><div class="brought-trip-heading"><span>${when(t.completedAt)} · ${esc(t.title)}</span>${r.dismissedAt?`<button class="text-button" data-restore-trip="${esc(t.id)}">放回首页</button>`:''}</div>${t.findings?findings.map(f=>{const kept=H.findingResponse(S(),t.id,f.id).saved;return `<button class="brought-finding" data-trip="${esc(t.id)}" data-trip-finding="${esc(f.id)}"><span class="brought-finding-copy"><strong>${esc(f.headline)}</strong><small>${esc(f.attribution)}${kept?' · 已收下':''}</small></span>${o.icon('arrow')}</button>`;}).join(''):`<button class="brought-finding" data-trip="${esc(t.id)}"><span class="brought-finding-copy"><strong>${esc(t.title)}</strong><small>${r.saved?'已收下这一趟':esc(t.intro)}</small></span>${o.icon('arrow')}</button>`}</section>`).join('')||`<div class="brought-empty"><p>${libraryFilter==='saved'?'还没有收下的内容。':'这个目标还没有带回的内容。'}</p>${libraryFilter==='saved'?'<button class="text-button" data-library-filter="all">看看全部</button>':''}</div>`}</div><details class="outing-import"><summary>带入一份新的调研</summary><p class="small-text">选择外出记录 JSON 文件。</p><input id="outing-file" type="file" accept=".json,application/json" aria-label="选择外出记录 JSON 文件"><p id="outing-import-status" class="outing-status" role="status"></p></details></section>`;
    }
    function openLibrary(){if(o.openLibrary){if(o.dialog.open)o.closeModal();o.openLibrary();}else show('outings','栖栖带回的',libraryHTML({page:false}));}
    function refreshLibrary(){if(o.dialog.open)show('outings','栖栖带回的',libraryHTML({page:false}));else o.render();}
    function actions(){H.resume(S());o.save();if(o.dialog.open)o.closeModal();o.showNow?.();o.render();const target=document.querySelector('#actions-title');target?.scrollIntoView({block:'start',behavior:'instant'});if(target){target.tabIndex=-1;target.focus({preventScroll:true});}}
    function rest(){H.rest(S());o.save();if(o.dialog.open)o.closeModal();o.showNow?.();o.render();document.querySelector('.welcome-heading h2')?.scrollIntoView({block:'center',behavior:'instant'});}
    function handle(event){
      if(o.readOnly?.())return;
      const b=event.target.closest('button');if(!b)return;
      if(b.dataset.researchPick){
        const trip=list().find(t=>t.id===b.dataset.researchTrip);if(!trip||!trip.findings?.some(f=>f.id===b.dataset.researchPick))return;
        selections.set((o.projectKey?.()||'')+trip.id,b.dataset.researchPick);H.respond(S(),trip.id,{selectedFinding:b.dataset.researchPick});o.save();
        const inDialog=b.dataset.researchScope==='dialog';if(inDialog){tripId=trip.id;renderTrip();}else o.render();
        (inDialog?o.dialog:o.main).querySelector?.(`[data-research-pick="${b.dataset.researchPick}"]`)?.focus();return;
      }
      if(b.dataset.trip){openTrip(b.dataset.trip,b.dataset.tripFinding);return;}
      if(b.dataset.libraryFilter){if(!['all','saved'].includes(b.dataset.libraryFilter))return;libraryFilter=b.dataset.libraryFilter;refreshLibrary();(o.dialog.open?o.dialog:o.main).querySelector?.(`[data-library-filter="${libraryFilter}"]`)?.focus();return;}
      if(b.dataset.restoreTrip){if(!list().some(t=>t.id===b.dataset.restoreTrip))return;H.respond(S(),b.dataset.restoreTrip,{dismissedAt:null});o.save();refreshLibrary();return;}
      if(b.dataset.homeAttempt){if(o.dialog.open)o.closeModal();o.openAttempt(b.dataset.homeAttempt);return;}
      if(b.dataset.homeDraft){if(o.dialog.open)o.closeModal();o.openTask(b.dataset.homeDraft);return;}
      if(b.dataset.homeRound){o.openRound(b.dataset.homeRound);return;}
      if(b.dataset.tripReason){const t=list().find(t=>t.id===tripId);if(t)respondTo(t,{reason:b.dataset.tripReason});o.save();renderTrip();return;}
      const cmd=b.dataset.homeCommand;
      if(cmd==='recap')openRecap();if(cmd==='outings')openLibrary();if(cmd==='actions')actions();if(cmd==='rest')rest();
      if(cmd==='save-trip'||cmd==='save-finding'){
        const t=list().find(t=>t.id===(b.dataset.tripTarget||tripId));if(!t)return;const r=responseFor(t);
        respondTo(t,{saved:!r.saved,verdict:r.saved?null:'useful',reason:null});o.save();
        if(cmd==='save-trip')renderTrip();else{o.render();o.main.querySelector?.('[data-home-command="save-finding"]')?.focus();}
      }
      if(cmd==='miss-trip'){const t=list().find(t=>t.id===tripId);if(!t)return;const r=responseFor(t);respondTo(t,{verdict:r.verdict==='miss'?null:'miss',reason:null});o.save();renderTrip();}
      if(cmd==='hide-trip'){H.respond(S(),tripId,{dismissedAt:new Date().toISOString()});o.save();o.closeModal();}
      if(cmd==='try-trip'){
        const t=list().find(t=>t.id===tripId);if(!t||t.id!=='qiban-return-20260929'||(findingFor(t)&&findingFor(t).id!=='quieter-home'))return;
        const r=H.response(S(),tripId);let task=r.actionId&&o.tasks().find(t=>t.id===r.actionId);
        if(!task){task=o.addReturnTrial(tripId);H.respond(S(),tripId,{actionId:task.id});o.save();}
        H.resume(S());o.save();o.closeModal();o.openTask(task.id);
      }
    }
    o.main.addEventListener('click',handle);o.dialog.addEventListener('click',handle);
    const importFile=async e=>{
      if(o.readOnly?.()||e.target.id!=='outing-file')return;const owner=S(),file=e.target.files?.[0],status=(o.dialog.open?o.dialog:o.main).querySelector('#outing-import-status');if(!file)return;
      try{if(file.size>100_000)throw Error('这份文件太大了，最多 100 KB。');const raw=JSON.parse(await file.text());if(S()!==owner)return;const added=H.importTrip(S(),raw,root.QibanExpeditions);if(!added){status.textContent='这份已经收过啦。';return;}if(!o.save())throw Error('还没能存到本机，请先导出历程。');openTrip(raw.id);}
      catch(error){if(status?.isConnected)status.textContent=error instanceof SyntaxError?'这份文件没读懂，请检查 JSON 格式。':error.message;}
    };
    o.main.addEventListener('change',importFile);o.dialog.addEventListener('change',importFile);
    return {homeHTML,collapseActions,archiveHTML,libraryHTML,openRecap,openLibrary};
  }
  root.QibanHomeUI={create};
})(globalThis);
