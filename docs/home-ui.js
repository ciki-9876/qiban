(function(root){
  // 月面：目标是一轮月亮，进度是月相；兔子的影子印在月面上，按住时杵会落下。
  const R=96,C=130;
  const clamp=f=>Math.max(0,Math.min(1,Number(f)||0));
  function path(f){
    f=clamp(f);if(f<=0.001)return '';
    if(f>=0.999)return `M${C} ${C-R}A${R} ${R} 0 1 1 ${C} ${C+R}A${R} ${R} 0 1 1 ${C} ${C-R}Z`;
    const rx=(Math.abs(1-2*f)*R).toFixed(2);
    return `M${C} ${C-R}A${R} ${R} 0 0 1 ${C} ${C+R}A${rx} ${R} 0 0 ${f<0.5?0:1} ${C} ${C-R}Z`;
  }
  function phase(f){f=clamp(f);return f<0.03?'新月':f<0.47?'蛾眉月':f<0.54?'上弦月':f<0.97?'盈凸月':'满月';}
  const rabbit='<ellipse cx="114" cy="96" rx="5.5" ry="19" transform="rotate(-12 114 96)"/><ellipse cx="127" cy="95" rx="5.5" ry="20" transform="rotate(14 127 95)"/><circle cx="123" cy="126" r="15"/><ellipse cx="104" cy="156" rx="26" ry="23"/><circle cx="79" cy="167" r="6.5"/><path d="M134 163h34l-5 21h-24z"/><g class="moon-pestle"><path d="M132 141l20 25"/></g>';
  const maria='<ellipse cx="170" cy="104" rx="20" ry="13"/><ellipse cx="188" cy="152" rx="12" ry="9"/><ellipse cx="160" cy="196" rx="16" ry="8"/>';
  let serial=0;
  function svg({f=0,rabbit:showRabbit=true,ring=false,grain=ring,size=null}={}){
    // 新月也留一丝光，表示月亮已经升起。
    const id='moon-'+(++serial),d=path(clamp(f)>0.001?f:0.022),vb=ring?'0 0 260 260':'31 31 198 198';
    return `<svg class="moon-svg" viewBox="${vb}"${size?` width="${size}" height="${size}"`:''} aria-hidden="true" focusable="false">`+
      `<defs>${d?`<clipPath id="${id}-lit"><path d="${d}"/></clipPath>`:''}${grain?`<filter id="${id}-grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="1.15" numOctaves="2" seed="7"/><feColorMatrix type="matrix" values="0 0 0 0 .3  0 0 0 0 .26  0 0 0 0 .22  0 0 0 .9 -.25"/></filter>`:''}</defs>`+
      `<circle class="m-dark" cx="${C}" cy="${C}" r="${R}"/>`+
      (showRabbit?`<g class="m-rabbit m-rabbit-dark">${rabbit}</g>`:'')+
      (d?`<path class="m-lit" d="${d}"/><g clip-path="url(#${id}-lit)"><g class="m-mare">${maria}</g>${showRabbit?`<g class="m-rabbit m-rabbit-lit">${rabbit}</g>`:''}${grain?`<rect class="m-grain" x="34" y="34" width="192" height="192" filter="url(#${id}-grain)"/>`:''}</g>`:'')+
      (ring?`<circle class="moon-track" cx="${C}" cy="${C}" r="118"/><circle class="moon-ring" cx="${C}" cy="${C}" r="118" pathLength="100" transform="rotate(-90 ${C} ${C})"/>`:'')+
      `</svg>`;
  }
  const THEME_KEY='qiban.theme.v1';
  const theme={
    pref(){try{const v=root.localStorage?.getItem(THEME_KEY);return ['day','night'].includes(v)?v:'auto';}catch{return 'auto';}},
    resolve(pref,now=new Date()){if(pref==='day'||pref==='night')return pref;const h=now.getHours();return h>=6&&h<18?'day':'night';},
    apply(pref=theme.pref()){
      const doc=root.document,de=doc?.documentElement,mode=theme.resolve(pref);
      if(de?.setAttribute)de.setAttribute('data-theme',mode);
      const meta=doc?.querySelector?.('meta[name="theme-color"]');if(meta?.setAttribute)meta.setAttribute('content',mode==='day'?'#e4ebe7':'#0e2230');
      return mode;
    },
    cycle(){const order=['auto','day','night'],next=order[(order.indexOf(theme.pref())+1)%order.length];try{if(next==='auto')root.localStorage?.removeItem(THEME_KEY);else root.localStorage?.setItem(THEME_KEY,next);}catch{}theme.apply(next);return next;},
    toggle(){const next=theme.resolve(theme.pref())==='day'?'night':'day';try{root.localStorage?.setItem(THEME_KEY,next);}catch{}theme.apply(next);return next;},
    label(pref=theme.pref()){return pref==='day'?'白天':pref==='night'?'夜晚':'跟随时间';}
  };
  theme.apply();
  root.QibanMoon={path,phase,svg,theme};
})(globalThis);
(function(root){
  // 远航：在海上航行是过程，登上那座岛是到达。岛越近，雾越薄。
  const clamp=f=>Math.max(0,Math.min(1,Number(f)||0));
  function seedOf(text){let h=2166136261;for(const c of String(text||'island'))h=Math.imul(h^c.charCodeAt(0),16777619);return Math.abs(h)%233280||7;}
  function rng(seed){let s=seed;return ()=>{s=(s*9301+49297)%233280;return s/233280;};}
  const n1=v=>v.toFixed(1);
  function smooth(pts,closed){
    const mid=(p,q)=>[(p[0]+q[0])/2,(p[1]+q[1])/2];
    if(closed){const n=pts.length;let d=`M${mid(pts[n-1],pts[0]).map(n1).join(' ')}`;for(let k=0;k<n;k++){const m=mid(pts[k],pts[(k+1)%n]);d+=` Q${n1(pts[k][0])} ${n1(pts[k][1])} ${n1(m[0])} ${n1(m[1])}`;}return d+'Z';}
    let d=`M${n1(pts[0][0])} ${n1(pts[0][1])}`;for(let k=1;k<pts.length-1;k++){const m=mid(pts[k],pts[k+1]);d+=` Q${n1(pts[k][0])} ${n1(pts[k][1])} ${n1(m[0])} ${n1(m[1])}`;}const last=pts.at(-1);return d+` L${n1(last[0])} ${n1(last[1])}`;
  }
  // 俯视的岛：用于群岛。
  function shape(seed){
    const r=rng(seedOf(seed)),n=13,pts=[];
    for(let k=0;k<n;k++){const a=(k/n)*Math.PI*2,rr=40*(0.68+r()*0.42);pts.push([Math.cos(a)*rr*1.15,Math.sin(a)*rr*0.85]);}
    const ridge=`M${n1(-20+r()*6)} ${n1(8-r()*6)} Q${n1(-4+r()*8)} ${n1(-18-r()*6)} ${n1(16+r()*6)} ${n1(4+r()*6)}`;
    return {path:smooth(pts,true),ridge,hue:['#7FA37A','#8DAE7B','#99B58A','#88A884','#7E9F86'][seedOf(seed)%5]};
  }
  function island({seed,size=96,flag=true,fog=0,label=''}={}){
    const s=shape(seed);
    return `<svg class="isle-svg${fog>0?' isle-fog':''}" viewBox="-60 -60 120 120" width="${size}" height="${size}" ${label?`role="img" aria-label="${label}"`:'aria-hidden="true"'} focusable="false">`+
      `<path class="isle-sand" d="${s.path}" transform="scale(1.14)"/><path class="isle-land" d="${s.path}" style="fill:${s.hue}"/><path class="isle-ridge" d="${s.ridge}"/>`+
      (flag?'<path class="isle-flag" d="M0 -10 l0 -18 l12 4 l-12 4"/>':'')+
      (fog>0?`<path class="isle-mist" d="${s.path}" transform="scale(1.2)" style="opacity:${n1(clamp(fog))}"/>`:'')+`</svg>`;
  }
  // 远处的岛：在海平线上的侧影。
  function profile(seed){
    const r=rng(seedOf(seed)+11),pts=[[-66,0]];
    for(let k=0;k<7;k++){const x=-50+k*(100/6)+(r()-0.5)*8,env=1-Math.pow(x/62,2);pts.push([x,-(8+r()*24)*Math.max(0.25,env)]);}
    pts.push([66,0]);
    let top=pts[1];for(const p of pts)if(p[1]<top[1])top=p;
    return {d:smooth(pts,false)+' Z',top};
  }
  function visibility(f){f=clamp(f);return f>=0.999?'岛就在眼前':f<0.25?'岛还在雾里':f<0.5?'雾薄了一点，看得见岛的影子':f<0.8?'能看清海岸线了':'看见岛上的那棵树了';}
  let serial=0;
  const rabbit='<g class="v-rabbit"><ellipse cx="-17" cy="-15" rx="1.6" ry="5.2" transform="rotate(-10 -17 -15)"/><ellipse cx="-13.6" cy="-15" rx="1.6" ry="5.4" transform="rotate(12 -13.6 -15)"/><circle cx="-15" cy="-8" r="3.6"/><ellipse cx="-17" cy="-2.6" rx="5.6" ry="4.4"/></g>';
  function boat(){
    return `<g class="v-boat"><g class="v-boat-bob"><path class="v-hull" d="M-30 0 L30 0 L22 10 L-22 10 Z"/><path class="v-hull-line" d="M-27 3 L27 3"/><line class="v-mast" x1="2" y1="0" x2="2" y2="-46"/><path class="v-sail" d="M4 -44 L4 -4 L30 -4 Z"/><path class="v-jib" d="M0 -40 L0 -6 L-12 -6 Z"/><path class="v-pennant" d="M2 -46 l10 3 l-10 3"/>${rabbit}<g class="v-anchor"><line x1="-24" y1="8" x2="-28" y2="34"/><path d="M-33 30 q5 8 10 0 M-28 26 v10"/></g></g></g>`;
  }
  function scene({progress=0,seed='island',landed=false,anchored=false,label='海上'}={}){
    const id='sea-'+(++serial),f=landed?1:clamp(progress),s=0.55+0.75*f,fog=landed?0:Math.max(0,0.78-f*0.85),p=profile(seed);
    const waves=k=>{let d=`M-60 ${n1(200+k*24)}`;for(let x=-60;x<450;x+=30)d+=` q15 ${k%2?-5:-4} 30 0`;return d;};
    return `<svg class="v-scene${anchored?' anchored':''}${landed?' landed':''}" viewBox="0 0 390 300" preserveAspectRatio="xMidYMax slice" role="img" aria-label="${label}" focusable="false">`+
      `<defs><linearGradient id="${id}-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="v-sky-a"/><stop offset=".62" class="v-sky-b"/><stop offset="1" class="v-sky-c"/></linearGradient><linearGradient id="${id}-sea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="v-sea-a"/><stop offset="1" class="v-sea-b"/></linearGradient><linearGradient id="${id}-mist" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="v-mist-a"/><stop offset=".55" class="v-mist-b"/><stop offset="1" class="v-mist-a"/></linearGradient></defs>`+
      `<rect width="390" height="192" fill="url(#${id}-sky)"/>`+
      `<g class="v-stars">${[[40,118],[86,92],[132,140],[214,104],[252,150],[350,96],[364,150],[22,150],[180,126],[60,40],[300,30]].map(([x,y],i)=>`<circle cx="${x}" cy="${y}" r="${i%3?0.9:1.4}"/>`).join('')}</g>`+
      `<circle class="v-sun" cx="306" cy="128" r="18"/>`+
      `<g class="v-island" transform="translate(206 190) scale(${n1(s)})"><ellipse class="v-beach" cx="0" cy="0" rx="70" ry="3.4"/><path class="v-hill" d="${p.d}"/>${f>=0.8?`<g class="v-tree" transform="translate(${n1(p.top[0])} ${n1(p.top[1])})"><line x1="0" y1="0" x2="0" y2="-9"/><circle cx="0" cy="-12" r="5"/></g>`:''}${landed?`<path class="v-flag" transform="translate(${n1(p.top[0]+8)} ${n1(p.top[1]+2)})" d="M0 0 v-14 l8 3 l-8 3"/>`:''}</g>`+
      `<rect class="v-mist" x="0" y="128" width="390" height="74" fill="url(#${id}-mist)" style="opacity:${n1(fog)}"/>`+
      `<rect y="190" width="390" height="110" fill="url(#${id}-sea)"/>`+
      `<path class="v-glint" d="M296 196 h34 M304 204 h20 M310 212 h10"/>`+
      `<g class="v-waves"><path class="v-wave v-wave-1" d="${waves(0)}"/><path class="v-wave v-wave-2" d="${waves(1)}"/><path class="v-wave v-wave-3" d="${waves(2)}"/></g>`+
      `<g transform="translate(118 246)">${boat()}</g>`+
      `</svg>`;
  }
  function buoy({passed=false,current=false,size=28}={}){
    return `<svg class="v-buoy${passed?' passed':''}${current?' current':''}" viewBox="-14 -26 28 34" width="${size}" height="${Math.round(size*34/28)}" aria-hidden="true" focusable="false"><path class="v-buoy-body" d="M-8 2 L-4 -16 L4 -16 L8 2 Z"/><path class="v-buoy-band" d="M-6.2 -6 L6.2 -6 L5.2 -10 L-5.2 -10 Z"/><line class="v-buoy-pole" x1="0" y1="-16" x2="0" y2="-23"/><circle class="v-buoy-light" cx="0" cy="-23" r="2.4"/><path class="v-buoy-water" d="M-13 4 q3.2 -2.6 6.5 0 t6.5 0 t6.5 0 t6.5 0"/></svg>`;
  }
  const LANDMARKS=['码头','小屋','瞭望塔','石阶','灯塔','山顶的旗'];
  function landmark(i,count){return i>=count-1?'山顶的旗':LANDMARKS[Math.min(i,LANDMARKS.length-2)];}
  function islandName(goal){let t=String(goal||'').trim().replace(/[，。！？,.!?\s].*$/,'');for(let i=0;i<3;i++)t=t.replace(/^(我想|我要|想要|想|学会|学着|学|把|做完|做出|做好|做成|做|完成|开始|读完|跑完|写完|写|一个|一本|一次|一场|一座|第[一二三四五六七八九十\d]+[本个次座场])/,'');t=t.slice(0,5);return (t||'无名')+(t.endsWith('岛')?'':'岛');}
  root.QibanVoyage={scene,island,buoy,visibility,landmark,islandName,seedOf,shape};
})(globalThis);
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
      const back=r.hasHistory&&(away||quiet);
      const welcome=r.hasHistory?`<div class="welcome-heading"><h2>${quiet?'船下锚了，停在这里等你。':away?'回来啦，船还在原处。':'上次记到这里'}</h2>${back?button('recap','帮我回顾一下'):''}</div>${anchor?`<button class="return-record" data-home-attempt="${esc(anchor.id)}"><span>${esc(anchor.taskTitle)}<small>${r.achievement?'已写进航线':'最近一条日志'}</small></span>${anchor.text?`<blockquote>${esc(excerpt(anchor.text,80))}</blockquote>`:''}<span class="return-record-link">翻开日志 ${o.icon('arrow')}</span></button>`:''}${r.draft?`<button class="return-draft" data-home-draft="${esc(r.draft.taskId)}">${o.icon('pen')}「${esc(r.draft.title)}」还有没写完的日志<span>接着写 ${o.icon('arrow')}</span></button>`:''}`:'';
      return welcome||trip?`<section class="home-welcome" aria-label="上次的航行">${welcome}${trip?tripCard(trip):''}</section>`:'';
    }
    function tripCard(trip){
      const f=findingFor(trip),r=responseFor(trip);
      const bottle='<svg class="bottle-glyph" viewBox="0 0 24 24" aria-hidden="true"><path d="M10 3h4v3l2 3v10a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2V9l2-3z"/><path d="M9.5 13h5M9.5 16h3.5"/></svg>';
      if(!f)return `<article class="outing-card bottle-card"><div class="outing-eyebrow">${bottle}海上漂来一个漂流瓶</div><h2>${esc(trip.title)}</h2><p>${esc(trip.intro)}</p><div class="outing-card-bottom"><button class="primary-button" data-trip="${esc(trip.id)}">打开看看 ${o.icon('arrow')}</button>${button('outings','以前的漂流瓶')}</div></article>`;
      return `<article class="outing-card bottle-card research-outing"><div class="outing-eyebrow">${bottle}海上漂来一个漂流瓶 <span>${when(trip.completedAt)}</span></div>${researchHTML(trip)}<div class="outing-card-bottom"><button class="primary-button research-save" data-home-command="save-finding" data-trip-target="${esc(trip.id)}" aria-pressed="${Boolean(r.saved)}">${r.saved?'已收下这一条':'收下这一条'}</button><button class="text-button" data-trip="${esc(trip.id)}">看看栖栖的想法 ${o.icon('arrow')}</button>${button('outings','以前的漂流瓶')}</div></article>`;
    }
    function collapseActions(){const h=S().homecoming||{};return Boolean(h.returning||Date.parse(h.quietUntil)>Date.now());}
    function archiveHTML(){const seen=list().filter(t=>{const r=H.response(S(),t.id);return r.readAt||r.saved||Object.values(r.findings||{}).some(x=>x.saved);});return seen.length?`<div class="outing-history-link">${button('outings','漂流瓶')}</div>`:'';}
    function show(mode,label,html){o.dialog.innerHTML=o.dialogTop(label)+`<div class="dialog-body home-dialog-body">${html}</div>`;o.openModal(mode);o.dialog.querySelector('#dialog-title')?.focus();}
    function openRecap(){
      const r=recap();
      show('home-recap','上次的航行',`<h2 id="dialog-title" tabindex="-1">我帮你理了一下。</h2><p class="recap-lead">船在第 ${Number(r.branch.num)||1} 段航程「${esc(r.branch.name)}」。${r.closed?'这段航程已经走完了，想再多走一程也可以。':'这段航程还在继续，不用从头来。'}</p>
      ${r.lastClosed?`<div class="recap-row"><span>走完的航程</span><button class="text-button" data-home-round="${esc(r.lastClosed.id)}">${esc(r.lastClosed.branchName)}${r.lastClosed.grade&&r.lastClosed.grade!=='—'?`<strong class="recap-grade">${esc(r.lastClosed.grade)}</strong>`:''}${o.icon('arrow')}</button></div>`:''}
      ${r.achievement?`<div class="recap-row"><span>写进航线的</span><button class="text-button" data-home-attempt="${esc(r.achievement.id)}">${esc(r.achievement.taskTitle)} ${o.icon('arrow')}</button></div>`:''}
      ${r.latest&&r.latest.id!==r.achievement?.id?`<div class="recap-row"><span>后来又记了一条</span><button class="text-button" data-home-attempt="${esc(r.latest.id)}">${esc(r.latest.taskTitle)} ${o.icon('arrow')}</button></div>`:''}
      ${r.draft?`<div class="recap-row"><span>没写完的日志</span><button class="text-button" data-home-draft="${esc(r.draft.taskId)}">${esc(r.draft.title)} ${o.icon('arrow')}</button></div>`:''}
      ${!r.hasHistory?'<p class="small-text">还没有日志，先走今天这一程就好。</p>':`<p class="recap-count">已经记下 ${r.total} 条日志，${r.adoptedCount} 程写进了航线。</p>`}<div class="dialog-actions"><button class="text-button" data-home-command="rest">今天先下锚</button><button class="primary-button" data-home-command="actions">继续航行 ${o.icon('arrow')}</button></div>`);
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
      show('outing','漂流瓶 · '+when(trip.completedAt),`${f?researchHTML(trip,{expanded:true,scope:'dialog'}):`<h2 id="dialog-title" tabindex="-1">${esc(trip.title)}</h2><p class="outing-speech">${esc(trip.intro)}</p><p class="outing-speech">${esc(trip.suggestion)}</p><details class="outing-sources"><summary>这些是在哪儿看到的？</summary>${trip.sources.map(s=>`<div><a href="${esc(H.sourceURL(s.url))}" target="_blank" rel="noopener noreferrer">${esc(s.title)} ↗</a><p>${esc(s.note)}</p></div>`).join('')}</details>`}
      <div class="outing-reactions"><button class="secondary-button ${r.saved?'selected':''}" data-home-command="save-trip" aria-pressed="${Boolean(r.saved)}">${r.saved?'已收下'+(f?'这一条':'这一趟'):'这个有用，收下了'}</button><button class="text-button" data-home-command="miss-trip" aria-pressed="${r.verdict==='miss'}">${r.verdict==='miss'?'记住了，这条没帮上忙':'这条没帮上忙'}</button></div>
      ${r.verdict==='miss'?`<div class="outing-reasons" role="group" aria-label="没帮上忙的原因">${['没什么新东西','不是我现在想看的','看完还是有压力'].map(reason=>`<button data-trip-reason="${esc(reason)}" aria-pressed="${r.reason===reason}">${esc(reason)}</button>`).join('')}</div>`:''}
      <div class="dialog-actions"><button class="text-button" data-home-command="hide-trip">这个瓶子先放回海里</button>${seed?`<button class="primary-button" data-home-command="try-trip">${savedTrip.actionId?'看看那次尝试':'试试首页回顾'} ${o.icon('arrow')}</button>`:`<button class="primary-button" data-modal-command="close">先看到这里</button>`}</div><p class="outing-status" role="status">${esc(r.reason?'这次的感受已经记下了。':r.saved?'收好啦，以后在日志的“漂流瓶”里还能找到。':'')}</p>`);
    }

    function libraryHTML({page=true}={}){
      const trips=list();
      const selected=trips.map(t=>{const r=H.response(S(),t.id);const findings=(t.findings||[]).filter(f=>libraryFilter!=='saved'||r.saved||H.findingResponse(S(),t.id,f.id).saved);return {t,r,findings};}).filter(({t,r,findings})=>libraryFilter!=='saved'||findings.length||(!t.findings&&r.saved));
      return `<section class="brought-page"><header class="brought-heading"><div><p>${esc(S().goal)}</p><${page?'h1':'h2'} id="${page?'brought-title':'dialog-title'}" tabindex="-1">漂流瓶</${page?'h1':'h2'}></div></header>${o.research?.html()||''}<div class="brought-filters" role="group" aria-label="筛选漂流瓶">${[['all','全部'],['saved','我收下的']].map(([key,label])=>`<button data-library-filter="${key}" aria-pressed="${libraryFilter===key}">${label}</button>`).join('')}</div><div class="brought-list">${selected.map(({t,r,findings})=>`<section class="brought-trip"><div class="brought-trip-heading"><span>${when(t.completedAt)} · ${esc(t.title)}</span>${r.dismissedAt?`<button class="text-button" data-restore-trip="${esc(t.id)}">放回首页</button>`:''}</div>${t.findings?findings.map(f=>{const kept=H.findingResponse(S(),t.id,f.id).saved;return `<button class="brought-finding" data-trip="${esc(t.id)}" data-trip-finding="${esc(f.id)}"><span class="brought-finding-copy"><strong>${esc(f.headline)}</strong><small>${esc(f.attribution)}${kept?' · 已收下':''}</small></span>${o.icon('arrow')}</button>`;}).join(''):`<button class="brought-finding" data-trip="${esc(t.id)}"><span class="brought-finding-copy"><strong>${esc(t.title)}</strong><small>${r.saved?'已收下这一趟':esc(t.intro)}</small></span>${o.icon('arrow')}</button>`}</section>`).join('')||`<div class="brought-empty"><p>${libraryFilter==='saved'?'还没有收下的内容。':'这座岛的航线上，还没有漂来瓶子。'}</p>${libraryFilter==='saved'?'<button class="text-button" data-library-filter="all">看看全部</button>':''}</div>`}</div><details class="outing-import"><summary>高级：导入已有调研</summary><p class="small-text">仅用于导入按栖伴格式整理的调研 JSON，日常找资料请使用上方按钮。</p><input id="outing-file" type="file" accept=".json,application/json" aria-label="选择外出记录 JSON 文件"><p id="outing-import-status" class="outing-status" role="status"></p></details></section>`;
    }
    function openLibrary(){if(o.openLibrary){if(o.dialog.open)o.closeModal();o.openLibrary();}else show('outings','漂流瓶',libraryHTML({page:false}));}
    function refreshLibrary(){if(o.dialog.open)show('outings','漂流瓶',libraryHTML({page:false}));else o.render();}
    function actions(){H.resume(S());o.save();if(o.dialog.open)o.closeModal();o.showNow?.();o.render();const target=document.querySelector('#step-title');if(target){target.tabIndex=-1;target.focus({preventScroll:true});}}
    function rest(){H.rest(S());o.save();if(o.dialog.open)o.closeModal();o.showNow?.();o.render();document.querySelector('#sea-hint')?.focus?.({preventScroll:true});}
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
