(() => {
  'use strict';
  const STORAGE_KEY = 'qiban.growth.prototype.v1';
  const STATIC_PREVIEW = Boolean(document.querySelector('meta[name="qiban-static-preview"]'));
  const VISIT_KEY = 'qiban.growth.visits.v1';
  const mascot = 'assets/qixi-editorial.png';
  const icons = {
    arrow:'<path d="M4 10h12M11 5l5 5-5 5"/>',
    plus:'<path d="M10 4v12M4 10h12"/>',
    close:'<path d="m5 5 10 10M15 5 5 15"/>',
    check:'<path d="m4 10 4 4 8-8"/>',
    spark:'<path d="m10 2 2.2 5.8L18 10l-5.8 2.2L10 18l-2.2-5.8L2 10l5.8-2.2Z"/>',
    pen:'<path d="m4 13 9-9 3 3-9 9-4 1ZM11 6l3 3"/>',
    branch:'<circle cx="5" cy="4" r="2"/><circle cx="15" cy="8" r="2"/><circle cx="5" cy="16" r="2"/><path d="M5 6v8M5 10h5q5 0 5-1"/>',
    circle:'<circle cx="10" cy="10" r="6"/>',
    compare:'<path d="M7 3v14M13 3v14M3 6h3M14 14h3"/>',
    back:'<path d="M16 10H4m5-5-5 5 5 5"/>',
    book:'<path d="M10 5q-4-3-8-1v12q4-2 8 1 4-3 8-1V4q-4-2-8 1Zm0 0v12"/>'
  };
  const icon = (name) => `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.circle}</svg>`;
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const uid = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const branches = [
    {id:'experience',num:'01',name:'找到值得用的体验',short:'值得用的体验',subtitle:'让想法，有一个落点',outcome:'找到一段自己愿意反复使用的体验'},
    {id:'build',num:'02',name:'做出可用的产品',short:'可用的产品',subtitle:'先让一个想法，变得可触碰',outcome:'一个目标从行动到回顾，完整走通'},
    {id:'growth',num:'03',name:'看见真实的进步',short:'真实的进步',subtitle:'留一点证据，给以后的自己',outcome:'能够指出自己真实发生的一项变化'},
    {id:'release',num:'04',name:'稳定地发布',short:'稳定地发布',subtitle:'给它一个，能回来的地方',outcome:'自己能稳定使用，记录能够恢复'},
    {id:'invite',num:'05',name:'邀请独立试用',short:'独立试用',subtitle:'让另一个人，也走进来',outcome:'少量用户能在各自空间独立完成首轮体验'}
  ];
  const tasks = [
    {id:'home-focus',branch:'build',title:'给首页选一个主角',kind:'一个选择',prompt:'打开栖伴的第一眼，我想看到…',choices:['我的目标与进展','现在能做的一小步','最近留下的成果'],prefix:'首页第一眼，我想看到',example:'首页第一眼，我想看到现在能做的一小步，因为我不想先整理一整份计划。',criteria:[['有明确的首页主角','目标|进展|一小步|行动|成果|回顾|栖栖|兔子'],['有一个选择理由','因为|为了|希望|不想|让我|这样|以便|所以']],hint:'给这个选择接半句理由：“因为我…”',affirm:'首页，有了一个主角。',strength:'你已经选定了第一眼要出现的内容。',next:'这一版已经够用了。下次可以看一眼原型，验证第一眼是否真的落在这里。'},
    {id:'first-click',branch:'build',title:'选一次最想试的交互',kind:'一个选择',prompt:'我想先让这一步动起来…',choices:['选行动 → 留下第一版','留下一版 → 看见反馈','再试一次 → 对比变化'],prefix:'我想先试：',example:'我想先试：再试一次 → 对比变化，因为看见差异会让我想继续。',criteria:[['选定一段交互','选行动|第一版|反馈|对比|再试|选择|点击'],['明确前后两步','→|然后|之后|再看|接着|从.+到']],hint:'把它缩成两个动作，例如：“留下一版 → 看见反馈”。',affirm:'第一个交互，定下来了。',strength:'这次尝试有了清楚的落点。',next:'可以先体验这两个动作，留下一句顺手或别扭的感受。'},
    {id:'one-detail',branch:'build',title:'留下一处想改的小细节',kind:'一句话',prompt:'这个界面里，我最想改的是…',choices:[],example:'我想把“留下这一版”按钮放得更靠近输入框，因为写完后不用再找它。',criteria:[['指向一个具体元素','按钮|标题|兔子|栖栖|颜色|卡片|输入|首页|导航|文字|字号|留白|间距'],['表达一项改动','改|放|移|大|小|少|多|靠近|缩|增加|删|换|简化']],hint:'只点名一个元素和一个改动，比如“把按钮往上移一点”。',affirm:'一个小细节，清楚了。',strength:'你留下了一条可以回看的界面判断。',next:'下次只改这一处，再看看感受有没有变化。'},
    {id:'first-feeling',branch:'experience',title:'选一种想带走的感受',kind:'一个选择',prompt:'离开栖伴时，我希望觉得…',choices:['今天真的往前走了一点','不完美的一版也值得留下','我知道下次可以从哪继续'],prefix:'离开栖伴时，我希望觉得：',example:'离开栖伴时，我希望觉得：今天真的往前走了一点。看到我刚刚留下的版本，就有这种感觉。',criteria:[['明确一个期待','往前|进步|值得|留下|继续|轻松|安心|成就|满足'],['指向一个触发时刻','看到|完成|留下的|对比|打开|提交|时候|之后']],hint:'补一个小画面：“当我看到…的时候”。',affirm:'这份期待，有了名字。',strength:'你为这段体验留下了一个清楚的期待。',next:'之后可以用一次真实体验，看看这个时刻是否出现。'},
    {id:'one-scene',branch:'experience',title:'补半句真实的使用场景',kind:'半句话',prompt:'当我又不想开始的时候，我会…',choices:[],example:'当我又不想开始的时候，我会打开栖伴，选一个只需要做一次选择的行动。',criteria:[['有使用时刻','当|时候|下班|早上|晚上|不想|拖延|打开|中断'],['有一个具体动作','选|写|看|留|点|改|打开|提交|试']],hint:'只补一个动作，比如“选一个不需要想太多的行动”。',affirm:'一个真实的场景，留下了。',strength:'你把使用想法放进了一个具体时刻。',next:'这段场景已经可以拿来试一次，不必继续写成长文。'},
    {id:'less-one',branch:'experience',title:'划掉一个暂时不做的东西',kind:'一个取舍',prompt:'第一版，我先不做…',choices:['复杂的宠物养成','连续签到和排行榜','全平台记录同步'],prefix:'第一版，我先不做',example:'第一版，我先不做连续签到和排行榜，因为我更在意和过去的自己比较。',criteria:[['有明确的暂缓对象','宠物|养成|签到|排行榜|同步|社交|商店|积分|通知|冒险'],['留下取舍原因','因为|为了|更在意|先验证|不需要|负担|优先']],hint:'接一句“我更在意…”，留住这次取舍的原因。',affirm:'少一件事，方向也更清楚。',strength:'你给第一版划出了一条边界。',next:'先沿着这个边界体验，再决定是否值得加回来。'},
    {id:'proof',branch:'growth',title:'挑一件值得留下的证据',kind:'一个选择',prompt:'将来回看时，我想保留…',choices:['最初和现在的界面截图','每次尝试的原文','第一次独立走通的记录'],prefix:'将来回看时，我想保留',example:'将来回看时，我想保留最初和现在的界面截图，看看以前纠结的地方后来是怎么改好的。',criteria:[['明确一个证据载体','截图|原文|记录|版本|链接|录屏|照片'],['有前后参照','最初|以前|当时|现在|后来|前后|变化|对比']],hint:'给证据找一个参照，例如“第一次和现在”。',affirm:'进步，有了一个参照物。',strength:'你明确了以后要回看的材料。',next:'等真正产生它时，再把证据放进阶段留影。'},
    {id:'tiny-win',branch:'growth',title:'记下一点已经发生的变化',kind:'一句话',prompt:'之前我…，现在我…',choices:[],example:'之前我只想增加一个回访钩子，现在我想让自己看见接近真实目标的过程。',criteria:[['有过去的状态','之前|以前|最初|原来|过去'],['有现在的状态','现在|已经|开始|如今|这次']],hint:'留下一个前后对照：“之前…，现在…”。',affirm:'这个变化，值得留下。',strength:'这一版保留了你对过去和现在的判断。',next:'以后可以再带上一件具体成果，让这段变化更容易被核对。'},
    {id:'return',branch:'growth',title:'给下次的自己留半句话',kind:'半句话',prompt:'下次回来，我想接着…',choices:[],example:'下次回来，我想接着试一次“再改一点”，看看历史版本有没有完整留下。',criteria:[['有下一次的落点','下次|回来|接着|继续'],['指向一个动作或对象','试|看|选|改|写|对比|版本|界面|按钮|反馈']],hint:'只留一个动作，比如“再试一次版本对比”。',affirm:'下次回来，有地方接着走。',strength:'你给下一次访问留了一个具体落点。',next:'今天可以停在这里。这句话会留在足迹里。'},
    {id:'address',branch:'release',title:'想一个自己记得住的名字',kind:'一个名字',prompt:'这个产品，我想叫它…',choices:['栖伴','栖栖的小站','我的一小步'],prefix:'这个产品，我想叫它',example:'这个产品，我想叫它栖伴，因为我希望它像一个能回来歇一会儿的地方。',criteria:[['留下产品名字','栖伴|栖栖|一小步|叫|名字|命名'],['有命名缘由','因为|希望|代表|像|寓意|让我']],hint:'补半句这个名字让你想到什么。',affirm:'未来的小站，有了名字。',strength:'这一版保留了产品名称的想法。',next:'名字可以先用着；域名是否可用，还需要单独查询。'},
    {id:'reopen',branch:'release',title:'选一次最想验证的重开场景',kind:'一个选择',prompt:'重新打开时，我最在意…',choices:['没写完的半句话还在','过去的每个版本还在','能接着上次的行动继续'],prefix:'重新打开时，我最在意',example:'重新打开时，我最在意没写完的半句话还在；我会刷新页面，看看刚才的文字有没有保留。',criteria:[['明确要保留的东西','半句话|版本|行动|草稿|文字|记录'],['有验证动作','刷新|重开|重新打开|关闭|再打开']],hint:'留一个能实际执行的验证动作，例如“刷新页面”。',affirm:'一次小小的验证，有了重点。',strength:'你选定了一个需要检查的恢复场景。',next:'记下预期不等于验证通过。实际试一次后，可以再留一个版本。'},
    {id:'backup',branch:'release',title:'挑一份最不想丢的记录',kind:'一个选择',prompt:'如果只能留下一份，我会选…',choices:['每次尝试的原文','已经采用的成果','阶段留影'],prefix:'我最不想丢的是',example:'我最不想丢的是每次尝试的原文，因为这些不完美的版本让我看得见变化。',criteria:[['明确保留对象','原文|成果|留影|记录|版本|截图'],['表达保留原因','因为|让我|重要|变化|回看']],hint:'补一句它为什么对你重要。',affirm:'值得保留的东西，更清楚了。',strength:'你留下了一项关于记录的优先选择。',next:'以后验证备份恢复时，可以先核对这一份。'},
    {id:'invite-person',branch:'invite',title:'想到一个愿意试试的人',kind:'一个人',prompt:'我想先请…来试试',choices:[],example:'我想先请一个也容易把计划越写越重的朋友来试试，因为他可能和我有相似的困扰。',criteria:[['有一个人或人群','朋友|同事|家人|同学|自己|用户|伙伴|人'],['有选择缘由','因为|相似|困扰|需要|愿意|也容易']],hint:'不用写姓名，只留他和这个产品相关的一点特点。',affirm:'第一位试用者，有了轮廓。',strength:'你对适合谁先用有了一个想法。',next:'这里只记录候选对象，还没有发出邀请。'},
    {id:'invite-question',branch:'invite',title:'留一个最想听到答案的问题',kind:'一个问题',prompt:'用完之后，我最想问…',choices:[],example:'刚才哪一刻，你觉得自己真的往前走了一点？',criteria:[['有一个提问','？|\\?|哪|是否|会不会|怎么|什么'],['围绕具体体验','刚才|哪一刻|行动|版本|反馈|界面|打开|回来|进步|往前']],hint:'让问题落在刚才的体验，例如“哪一刻你最想继续？”',affirm:'一个值得听答案的问题。',strength:'你留下了一条可用于试用回访的问题。',next:'等有人真实用过，再保存对方的回答。'},
    {id:'own-space',branch:'invite',title:'选一条独立空间的底线',kind:'一个选择',prompt:'每个人的空间，至少应该…',choices:['彼此看不到私人的记录','能独立导出自己的历程','删除自己的记录不影响别人'],prefix:'每个人的空间，至少应该',example:'每个人的空间，至少应该彼此看不到私人的记录；试用前，我会用两个账号分别检查。',criteria:[['明确一个空间边界','彼此|独立|自己|别人|私人|账号'],['有检查方式','检查|测试|验证|两个账号|分别|对照']],hint:'留一个检查方法，比如“用两个账号分别检查”。',affirm:'一个必须守住的边界。',strength:'你明确了一项独立试用的要求。',next:'这条要求还需要真正实现与验证。'}
  ];
  const freshState = () => ({schema:1,goal:'把栖伴做成完整产品并发布上线',scope:'先自己使用，再邀请少量用户独立试用',branch:'build',drafts:{},contracts:{},attempts:[],accepted:{},customTasks:[],snapshots:[],adoptions:[],stageWork:{},stageRounds:[],createdAt:new Date().toISOString()});
  let storageFailed = false;
  function load(){
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if(!raw) return freshState();
      const data = JSON.parse(raw);
      if(data.schema !== 1 || typeof data.goal !== 'string' || !Array.isArray(data.attempts) || !Array.isArray(data.snapshots) || !Array.isArray(data.customTasks) || typeof data.drafts !== 'object' || !data.drafts || !data.accepted) throw Error('Invalid saved data');
      return {...freshState(), ...data};
    } catch {storageFailed = true; return freshState();}
  }
  let state = load();
  let home;
  QibanHome.ensure(state);
  try{const visit=JSON.parse(localStorage.getItem(VISIT_KEY)||'null');if(visit&&typeof visit==='object'&&QibanHome.sameGoal(visit.goal,state.goal))state.homecoming={...state.homecoming,...visit};}catch{}
  function saveVisit(){try{localStorage.setItem(VISIT_KEY,JSON.stringify(state.homecoming||{}));return true;}catch{return false;}}

  QibanStages.ensure(state);
  QibanActions.ensure(state);
  for(const id of Object.keys(state.drafts))state.drafts[id]=QibanRecordInput.unify(state.drafts[id]);
  const viewFromHash=()=>['history','outings'].includes(location.hash.slice(1))?location.hash.slice(1):'now';
  let view = viewFromHash();
  let historyFilter = 'all', doneOnly = false, activeTaskId = null, activeAttemptId = null, modalMode = null;
  let compareIds = [], helpVisible = false, opener = null, toastTimer;
  let aiConfig={configured:false,baseUrl:'https://api.deepseek.com',model:'deepseek-flash',format:'json_object',tokenField:'max_tokens'};
  let serviceAvailable=false;
  const assistance=new Map(), feedbackRequests=new Set(), uploading=new Set();
  const main = document.querySelector('#main');
  const dialog = document.querySelector('#workspace-dialog');
  const allTasks = () => [...tasks,...state.customTasks];
  const getTask = id => allTasks().find(t => t.id === id);
  const getBranch = id => branches.find(b => b.id === id) || branches[1];
  const records = id => state.attempts.filter(a => a.taskId === id);
  const getAttempt = id => state.attempts.find(a => a.id === id);
  const formatDate = (iso, time=false) => {const d=new Date(iso);return `${d.getMonth()+1} 月 ${d.getDate()} 日${time ? ' · '+d.toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit',hour12:false}) : ''}`;};
  const versionNumber = attempt => records(attempt.taskId).findIndex(a=>a.id===attempt.id)+1;
  function save(){
    try {localStorage.setItem(STORAGE_KEY,JSON.stringify(state));saveVisit();storageFailed=false;} catch {storageFailed=true;}
    document.querySelector('#saved-state').innerHTML = `<i></i>${storageFailed?'本次尚未保存':'已在本机保存'}`;
    document.querySelector('#saved-state').title=storageFailed?'浏览器存储不可用，请导出历程保留本次记录。':'记录只保存在当前浏览器';
    return !storageFailed;
  }
  function toast(message){clearTimeout(toastTimer);const el=document.querySelector('#toast');el.textContent=message;el.classList.add('visible');toastTimer=setTimeout(()=>el.classList.remove('visible'),2800);}
  function persistNotice(message){toast(save()?message:'本次未能保存，请先导出历程。');}
  function go(next){view=['now','history','outings'].includes(next)?next:'now';location.hash=view;render();window.scrollTo({top:0,behavior:'instant'});}
  function render(){
    document.querySelectorAll('[data-view]').forEach(btn=>{const selected=btn.dataset.view===view;btn.classList.toggle('active',selected);if(selected)btn.setAttribute('aria-current','page');else btn.removeAttribute('aria-current');});
    document.querySelector('#history-dot').hidden=!(state.attempts.length||state.stageRounds.length) || view==='history';
    document.querySelector('#footer-note').textContent=state.attempts.length?`${state.attempts.length} 个版本，${Object.keys(state.accepted).length} 个行动已收尾`:'从一个真实的愿望开始';
    if(view==='history')renderHistory();else if(view==='outings')main.innerHTML=home.libraryHTML();else renderNow();
  }
  function breathingMascot(){
    // Reuse the original illustration in two complementary regions: the book stays still.
    const silhouette='M 421 925 C 433 897 447 881 453 859 C 442 827 444 796 454 764 C 464 661 508 563 566 505 C 609 460 666 426 728 408 C 731 338 758 243 821 186 C 867 143 928 125 972 155 C 1015 188 986 261 951 312 C 932 341 907 370 884 396 C 945 331 1035 264 1103 268 C 1170 269 1207 307 1205 353 C 1201 408 1141 463 1069 497 C 1113 581 1140 692 1145 788 L 1153 902 C 1183 905 1217 928 1220 967 C 1224 1014 1199 1050 1158 1063 C 1151 1091 1125 1117 1077 1122 C 1032 1148 975 1142 932 1128 C 838 1135 767 1128 703 1119 C 626 1121 557 1118 504 1106 C 461 1112 422 1087 421 1047 C 416 1008 420 960 421 925 Z';
    return `<svg class="breathing-portrait" viewBox="0 0 1254 1254" width="224" height="224" role="img" aria-label="安静呼吸的栖栖兔子，抱着月亮坐在书旁"><defs><clipPath id="qixi-rabbit-region"><path d="${silhouette}"/></clipPath><mask id="qixi-still-scene" x="0" y="0" width="1254" height="1254" maskUnits="userSpaceOnUse" style="mask-type:luminance"><rect width="1254" height="1254" fill="white"/><path d="${silhouette}" fill="black"/></mask></defs><image href="${mascot}" width="1254" height="1254" mask="url(#qixi-still-scene)"/><g class="qixi-breath"><image href="${mascot}" width="1254" height="1254" clip-path="url(#qixi-rabbit-region)"/></g></svg>`;
  }
  function renderNow(){
    const branch=getBranch(state.branch);const items=allTasks().filter(t=>t.branch===branch.id&&!state.hiddenActions[t.id]).filter(t=>!doneOnly || state.accepted[t.id]);
    const recent=state.attempts.at(-1);const adopted=recent && state.accepted[recent.taskId]===recent.id;
    main.innerHTML=`<section class="hero" aria-labelledby="goal-title"><div class="hero-copy"><h1 id="goal-title" class="${state.goal.length<12?'short-goal':''}">${state.goal==='把栖伴做成完整产品并发布上线'?'把栖伴做成完整产品<br>并发布上线':escape(state.goal)}</h1></div><figure class="hero-mascot">${breathingMascot()}<figcaption class="mascot-caption">栖栖，陪你一点点</figcaption></figure></section>
      ${home.homeHTML()}
      <div class="home-action-content" ${home.collapseActions()?'hidden':''}>
      <section class="path-area" aria-label="目标分支"><div class="path-root-line" aria-hidden="true"></div><div class="path-tree" role="group" aria-label="目标分支">${branches.map(b=>{const selected=b.id===branch.id;const n=state.attempts.filter(a=>getTask(a.taskId)?.branch===b.id).length;return `<button class="branch ${selected?'selected':''}" data-branch="${b.id}" aria-pressed="${selected}" aria-label="${b.name}"><span class="branch-top"><span class="branch-number">${b.num}</span><span class="branch-state">${state.stageWork[b.id]?.closedId?'已收尾 · 第 '+state.stageWork[b.id].round+' 轮':selected?'<i class="branch-indicator"></i>正在探索':n?n+' 个版本':'可探索'}</span></span><h2><span class="desktop-branch-name">${b.name}</span><span class="mobile-branch-name">${["体验<br>方向","产品<br>成形","进步<br>证据","稳定<br>发布","独立<br>试用"][branches.indexOf(b)]}</span></h2>${stageGradeBadge(b)}</button>`;}).join('')}</div><div class="branch-leaf-line" style="--selected-branch:${branches.indexOf(branch)}" aria-hidden="true"></div></section>
      ${stageEntry(branch)}
      <section class="action-area" aria-labelledby="actions-title"><div class="section-head"><h2 class="section-title" id="actions-title">${doneOnly?'已收尾的行动':'这一刻，想做哪件？'}</h2><div class="action-toolbar"><button class="filter-button ${doneOnly?'active':''}" data-command="filter-done" aria-pressed="${doneOnly}">${doneOnly?'全部行动':'已收尾'}</button><button class="text-button" data-command="add-action">${icon('plus')}自己加一个</button></div></div><div class="action-grid">${items.length?items.map((task,i)=>actionCard(task,i)).join(''):'<div class="empty-inline">这里暂时没有行动。<button class="text-button" data-command="filter-done">看看可以做的</button></div>'}</div>${hiddenActionsHTML(branch.id)}</section>
      <section class="start-note" aria-label="最近的足迹"><div class="note-symbol">${recent?'✧':'“'}</div><div class="note-copy"><div class="note-label">${recent?'最近留下的':'我们的起点'}</div><p>${recent?`${escape(recent.taskTitle)} <span class="quiet">· 第 ${versionNumber(recent)} 版${adopted?'，已采用':''}</span>`:'从“想做一个回访钩子”，<span class="quiet">到“看见自己接近目标”。</span>'}</p><div class="note-meta">${recent?formatDate(recent.createdAt,true)+' · '+escape(recent.provenance):'一个真实目标 · 一套喜欢的美术风格 · 从这里开始'}</div></div><button class="text-button" ${recent?`data-open-attempt="${escape(recent.id)}"`:'data-command="history"'}>${recent?'回看这一版':'起点已留存'}${icon('arrow')}</button></section></div>`;
  }
  function actionCard(task,i){const list=records(task.id),accepted=getAttempt(state.accepted[task.id]),draft=hasDraft(state.drafts[task.id]);return `<button class="action-card ${accepted?'done':''}" data-open-task="${escape(task.id)}"><span class="card-top"><span class="card-kind">${icon(task.choices?.length?'branch':'pen')}${escape(task.kind)}</span><span class="card-serial">${String(i+1).padStart(2,'0')}</span></span><h3>${escape(task.title)}</h3><p class="card-prompt">${escape(task.prompt)}</p><span class="card-bottom"><span class="card-status">${accepted?icon('check')+'已收尾 · 第 '+versionNumber(accepted)+' 版':draft?'有一句话，还在等你':list.length?list.length+' 个版本 · 继续这里':'从这一小步开始'}${accepted?` <span class="card-grade">${escape(accepted.feedback.grade)}</span>`:''}</span><span class="card-arrow">${icon('arrow')}</span></span></button>`;}
  function renderHistory(){
    const history=historyFilter==='adopted'?state.attempts.filter(a=>state.accepted[a.taskId]===a.id):state.attempts;
    main.innerHTML=`<section class="history-hero"><div><div class="eyebrow"><span class="index">MEMORIES</span><span class="small-line"></span><span>我的足迹</span></div><h1>每一版，都算数。</h1><div class="pill-stat">${state.attempts.length?`${state.attempts.length} 个版本 · ${Object.keys(state.accepted).length} 个行动收尾`:'从这里，开始留下自己'}</div></div><button class="secondary-button" data-command="snapshot" ${!state.attempts.length?'disabled':''}>${icon('book')}留住此刻</button></section>
      ${home.archiveHTML()}
      <div class="history-tabs" role="group" aria-label="足迹筛选">${[['all','所有尝试'],['adopted','采用的版本'],['snapshots','阶段留影']].map(([id,label])=>`<button class="history-tab ${historyFilter===id?'active':''}" data-history-filter="${id}" aria-pressed="${historyFilter===id}">${label}${id==='snapshots'&&(state.snapshots.length+state.stageRounds.length)?' · '+(state.snapshots.length+state.stageRounds.length):''}</button>`).join('')}</div>
      <div class="history-layout"><section class="history-list" aria-label="成长记录">${historyFilter==='snapshots'?renderSnapshots():history.length?[...history].reverse().map(historyEntry).join(''):emptyHistory(historyFilter)}</section><aside class="history-aside"><div class="aside-label">起点 · 来自我们的讨论</div><h2>还没有成形的产品，<br>已经有了想去的地方。</h2><div class="baseline-item"><small>想要的价值</small>看见自己，一点点接近真实目标</div><div class="baseline-item"><small>第一版的边界</small>先自己使用，再邀请少量用户独立试用</div><div class="baseline-item"><small>愿意保留的</small>纸白、紫苏色，和栖栖</div><img class="aside-mascot" src="${mascot}" alt="栖栖" width="165" height="165"></aside></div>`;
  }
  function emptyHistory(filter){return `<div class="history-empty"><div class="empty-ornament">${filter==='snapshots'?'✧':'01'}</div><h2>${filter==='adopted'?'还没有采用的版本。':filter==='snapshots'?'这一段，正在发生。':'第一步，可以很轻。'}</h2><button class="text-button" data-command="${filter==='snapshots'&&state.attempts.length?'snapshot':'now'}">${filter==='snapshots'&&state.attempts.length?'留住这个阶段':'选一个小行动'}${icon('arrow')}</button></div>`;}
  function historyEntry(attempt){const adopted=state.accepted[attempt.taskId]===attempt.id;return `<article class="history-entry"><div class="entry-top"><div><h2>${escape(attempt.taskTitle)}</h2><div class="entry-info"><span>第 ${versionNumber(attempt)} 版</span><span>${formatDate(attempt.createdAt,true)}</span><span>${escape(attempt.provenance)}</span></div></div><span class="entry-grade">${escape(attempt.feedback.grade)}</span></div><p class="entry-body">${escape(attempt.text)}</p>${attempt.artifacts?.length?`<div class="history-artifacts">${attempt.artifacts.map(a=>escape(a.name)).join(" · ")}</div>`:""}<div class="entry-bottom">${adopted?`<span class="adopted-tag">${icon('check')}已采用</span>`:'<span class="small-text">'+escape(attempt.feedback.label)+'</span>'}<button class="text-button" data-open-attempt="${escape(attempt.id)}">${records(attempt.taskId).length>1?'回看与对比':'回看这一版'}${icon('arrow')}</button></div></article>`;}
  function renderSnapshots(){return renderStageRounds()+(state.snapshots.length?[...state.snapshots].reverse().map((snap,i)=>`<article class="snapshot-card"><span class="snapshot-number">CHAPTER ${String(state.snapshots.length-i).padStart(2,'0')}</span><h2>${escape(snap.title)}</h2><div class="entry-info">${formatDate(snap.createdAt,true)} · ${escape(snap.branchName)}</div><blockquote>${escape(snap.note || '这段时间留下的每一版，都保存在这里。')}</blockquote><div class="snapshot-evidence">${snap.evidence.map(e=>`<span>${escape(e.title)} · V${e.version}${e.adopted?' · 已采用':''}</span>`).join('')}</div><button class="text-button" data-open-snapshot="${escape(snap.id)}">展开这一页${icon('arrow')}</button></article>`).join(''):state.stageRounds.length?'':emptyHistory('snapshots'));}
  function focusDialogTitle(){const title=dialog.querySelector('#dialog-title');if(title){title.tabIndex=-1;title.focus({preventScroll:true});}}
  function openModal(mode){opener=dialog.open?opener:document.activeElement;modalMode=mode;if(!dialog.open)dialog.showModal();dialog.scrollTop=0;}
  function closeModal(){const returnTask=activeTaskId;dialog.close();dialog.className='';activeTaskId=null;activeAttemptId=null;modalMode=null;helpVisible=false;render();if(opener?.isConnected)opener.focus();else (returnTask?document.querySelector(`[data-open-task="${returnTask}"]`):null)?.focus();}
  const dialogTop=label=>`<div class="dialog-top"><div class="breadcrumb">${label}</div><button class="icon-button" data-modal-command="close" aria-label="关闭">${icon('close')}</button></div>`;
  function openTask(id,attemptId=null){const task=getTask(id);if(!task)return;activeTaskId=id;helpVisible=false;activeAttemptId=attemptId;const list=records(id);if(!attemptId&&!hasDraft(state.drafts[id])&&list.length)activeAttemptId=state.accepted[id]||list.at(-1).id;renderTaskDialog();openModal(activeAttemptId?'feedback':'compose');}
  function versionStrip(task){const list=records(task.id);if(!list.length)return '';return `<div class="attempt-strip" aria-label="行动版本">${list.map((a,i)=>`<button class="version-pill ${a.id===activeAttemptId?'active':''}" data-version="${escape(a.id)}">V${i+1}<span>${escape(a.feedback.grade)}</span>${state.accepted[task.id]===a.id?icon('check'):''}</button>`).join('')}${!activeAttemptId?'<span class="version-pill active">新的一版</span>':hasDraft(state.drafts[task.id])?'<button class="version-pill" data-modal-command="resume-draft">草稿</button>':''}${list.length>1?`<button class="text-button compare-link" data-modal-command="compare">${icon('compare')}对比版本</button>`:''}</div>`;}
  function renderTaskDialog(){const task=getTask(activeTaskId);if(!task)return;dialog.className='';const attempt=getAttempt(activeAttemptId);const branch=getBranch(task.branch);dialog.innerHTML=dialogTop(`${escape(branch.name)}<span class="slash">/</span>${escape(task.kind)}`)+`<div class="dialog-body"><h2 id="dialog-title">${escape(attempt?.taskTitle||task.title)}</h2>${actionOptions(task)}${versionStrip(task)}${attempt?feedbackHTML(attempt,task):composerHTML(task)}</div>`;modalMode=attempt?'feedback':'compose';loadImagePreviews();if(dialog.open)focusDialogTitle();}
  const clone = value => JSON.parse(JSON.stringify(value));
  const hasDraft = d => Boolean(d && (d.text || d.artifacts?.length || d.link || d.observation || d.contract));
  function contractFor(task) {
    return clone(state.drafts[task.id]?.contract || state.contracts[task.id] || task.contract || {
      kind:'decision', outcome:task.id==='proof'?'留下一件能体现变化的成果或体验':task.title,
      ...(task.id==='proof'?{criteria:[{label:'留下一项具体成果或真实体验',method:'content',clue:'提到成果或感受，但具体内容还不清楚'},{label:'指出前后感受、想法或行动中的一项变化',method:'content',clue:'提到受到触动或有所改善，但具体变化还不清楚'}]}:{criteria:(task.aiCriteria || task.criteria?.map(c=>c[0]) || [task.title]).map(label=>({label,method:'content'}))})
    });
  }
  function contractHTML(contract,editable=false) {
    return `<details class="delivery-contract"><summary><span>做到这里就够了</span>${escape(contract.outcome)}</summary><ul>${contract.criteria.map(c=>`<li>${escape(c.label)}${c.clue?`<small class="anchor-clue">已有线索：${escape(c.clue)}</small>`:''}<small>${c.method==='experience'?'实际体验':'内容审阅'}</small></li>`).join('')}</ul>${editable?'<button class="text-button" data-modal-command="edit-contract">调整完成标准</button>':''}</details>`;
  }
  const safeLink = value => {try{const u=new URL(value);return ['http:','https:'].includes(u.protocol)&&!u.username&&!u.password?u.href:'';}catch{return '';}};
  const imagePreviews=new Map();
  function imageGallery(items=[],editable=false){
    return `<div class="image-gallery">${items.filter(a=>a.kind==='image').map(a=>`<figure><img data-artifact-image="${escape(a.id)}" alt="${escape(a.name)}"><figcaption><button class="text-button" data-download-artifact="${escape(a.id)}">${escape(a.name)}</button>${editable?`<button class="icon-button" data-remove-artifact="${escape(a.id)}" aria-label="移除 ${escape(a.name)}">${icon('close')}</button>`:''}</figcaption></figure>`).join('')}</div>`;
  }
  async function loadImagePreviews(){
    for(const img of dialog.querySelectorAll('[data-artifact-image]')){
      const id=img.dataset.artifactImage;
      try{
        if(!imagePreviews.has(id))imagePreviews.set(id,api('artifacts/read',{id}).then(a=>{
          const mime=a.mime||({'png':'image/png','jpg':'image/jpeg','jpeg':'image/jpeg','webp':'image/webp','gif':'image/gif'}[a.name.split('.').at(-1).toLowerCase()]);
          if(!mime)throw new Error('图片格式无法识别');
          return 'data:'+mime+';base64,'+a.base64;
        }).catch(e=>{imagePreviews.delete(id);throw e;}));
        const src=await imagePreviews.get(id);if(img.isConnected)img.src=src;
      }catch(e){if(img.isConnected)img.alt='图片暂时无法加载：'+e.message;}
    }
  }
  function artifactList(items=[],editable=false) {
    return imageGallery(items,editable)+(items.some(a=>a.kind!=='image')?`<ul class="artifact-list">${items.filter(a=>a.kind!=='image').map(a=>`<li><div><button class="text-button artifact-name" data-download-artifact="${escape(a.id)}">${escape(a.name)}</button><small>${(a.size/1024).toFixed(1)} KB · ${a.truncated?'AI 仅读取部分内容':'可供 AI 内容审阅'}${a.omittedEmbedded?' · 内嵌图片未读取':''}</small></div>${editable?`<button class="icon-button" data-remove-artifact="${escape(a.id)}" aria-label="移除 ${escape(a.name)}">${icon('close')}</button>`:''}</li>`).join('')}</ul>`:'');
  }

  function evidenceHTML(a) {
    if(!a.contract)return '';
    const d=a.delivery||{}, link=safeLink(d.link);
    return `<section class="submitted-evidence">${contractHTML(a.contract)}${artifactList(a.artifacts)}${link?`<a class="preview-link" href="${escape(link)}" target="_blank" rel="noopener noreferrer">打开预览 ↗<small>引用地址 · AI 未访问</small></a>`:''}${d.observation&&d.observation.trim()!==a.text?.trim()?`<div class="personal-observation"><small>我的试用感受</small><p>${escape(d.observation)}</p></div>`:''}${a.feedback?.scope?`<div class="verification-label">${a.feedback.scope==='mixed'?'AI 内容审阅 · 含本人体验确认':a.feedback.scope==='visual'?'AI 已审阅图片 · 未运行验证':a.feedback.scope==='content'?(a.contract.kind==='artifact'?'AI 已审阅内容 · 未运行验证':'AI 已审阅这次决定'):'尚未确认完成标准'}</div>`:''}</section>`;
  }
  function composerHTML(task){
    const draft=state.drafts[task.id]||{text:''}, contract=contractFor(task), artifacts=draft.artifacts||[], experiential=contract.criteria.some(c=>c.method==='experience');
    return `${contractHTML(contract,true)}${task.sourceText?`<details class="source-decision"><summary>沿用的方案 · 第 ${task.sourceVersion} 版</summary><p>${escape(task.sourceText)}</p></details>`:''}<label class="composer-label" for="action-text">${escape(experiential?'这一次，我留下…':task.prompt)}</label>${task.choices?.length&&contract.kind==='decision'?`<div class="choice-list">${task.choices.map((c,i)=>`<button class="choice-chip" data-choice="${i}">${escape(c)}</button>`).join('')}</div>`:''}<div class="composer"><textarea id="action-text" maxlength="6000" aria-label="这次的行动记录" placeholder="${experiential?'做了什么，实际感觉如何…':contract.kind==='artifact'?'这次做出了什么…':'半句话也好。'}">${escape(draft.text||'')}</textarea>${imageGallery(artifacts,true)}<div class="composer-tools"><label class="text-button upload-button">${icon('plus')}图片<input id="composer-images" type="file" multiple accept="image/png,image/jpeg,image/webp,image/gif" aria-label="添加图片" ${uploading.has(task.id)?'disabled':''}></label><button class="assist-button" data-modal-command="help" aria-expanded="${helpVisible}">${icon('spark')}栖栖，搭把手</button><span class="char-count" id="char-count">${(draft.text||'').length} / 6000</span></div></div><div class="record-confirmations">${experiential?`<div class="experience-checks">${contract.criteria.map((c,i)=>c.method==='experience'?`<label><input type="checkbox" data-experience-check="${i}" ${(draft.confirmed||[]).includes(i)?'checked':''}><span>我已确认：${escape(c.label)}</span></label>`:'').join('')}</div>`:''}</div><div id="assist-slot">${helpVisible?assistHTML(task):''}</div>
      <details class="delivery-input" ${contract.kind==='artifact'||artifacts.length||draft.link?'open':''}><summary>附件与链接${artifacts.length?' · '+artifacts.length+' 份文件':''}</summary><div class="delivery-fields"><div class="upload-row"><label class="secondary-button upload-button">${icon('plus')}附上文件<input id="artifact-files" type="file" multiple accept=".html,.htm,.css,.js,.mjs,.jsx,.ts,.tsx,.json,.md,.txt,.py,.vue,.svelte,.svg,.png,.jpg,.jpeg,.webp,.gif" aria-label="附上成果文件" ${uploading.has(task.id)?'disabled':''}></label><span class="small-text">${uploading.has(task.id)?'正在保存…':'最多 4 份 · 每份 4 MB'}</span></div><div id="artifact-list">${artifactList(artifacts.filter(a=>a.kind!=='image'),true)}</div><div id="delivery-error" class="delivery-error" role="status"></div><label class="field-label" for="delivery-link">预览地址 <small>AI 不访问链接</small></label><input class="text-field" id="delivery-link" type="url" maxlength="2000" value="${escape(draft.link||'')}" placeholder="https://…"></div></details>
      ${draft.retryOf?`<div class="draft-context">接着第 ${versionNumber(getAttempt(draft.retryOf)||records(task.id).at(-1))} 版，留下一点变化</div>`:''}<div class="dialog-actions"><span class="draft-state" id="draft-state">${hasDraft(draft)?(storageFailed?'尚未保存':'草稿已留下'):'留一点，此刻的想法'}</span><button class="primary-button" id="submit-attempt" data-modal-command="submit" ${canSubmit(draft,task.id)?'':'disabled'}>留下这一版${icon('arrow')}</button></div>`;
  }
  function canSubmit(draft={},taskId=activeTaskId){return !uploading.has(taskId)&&Boolean(draft.text?.trim()||draft.artifacts?.length||draft.link?.trim());}
  function editContract(){
    const c=contractFor(getTask(activeTaskId));modalMode='contract';
    dialog.innerHTML=dialogTop('这一步的落点')+`<div class="dialog-body"><h2 id="dialog-title">做到这里，就可以。</h2><label class="field-label" for="contract-kind">这次留下</label><select class="text-field" id="contract-kind"><option value="decision" ${c.kind==='decision'?'selected':''}>一个决定 / 一段内容</option><option value="artifact" ${c.kind==='artifact'?'selected':''}>可交付的成果</option></select><label class="field-label" for="contract-outcome">预期成果</label><input class="text-field" id="contract-outcome" maxlength="200" value="${escape(c.outcome)}"><label class="field-label">完成标准</label>${[0,1,2].map(i=>`<div class="criterion-editor"><input class="text-field" data-criterion-label="${i}" maxlength="100" aria-label="完成标准 ${i+1}" value="${escape(c.criteria[i]?.label||'')}" placeholder="${i?'可留空':'什么出现了，就算完成'}"><select class="text-field" data-criterion-method="${i}" aria-label="标准 ${i+1} 验证方式"><option value="content">内容审阅</option><option value="experience" ${c.criteria[i]?.method==='experience'?'selected':''}>实际体验 · 本人确认</option></select></div>`).join('')}<div class="dialog-actions"><button class="text-button" data-modal-command="cancel-contract">返回</button><button class="primary-button" data-modal-command="save-contract">就以此为准</button></div></div>`;focusDialogTitle();
  }
  function saveContract(){
    const outcome=dialog.querySelector('#contract-outcome').value.trim(),kind=dialog.querySelector('#contract-kind').value;
    const criteria=[...dialog.querySelectorAll('[data-criterion-label]')].map(el=>({label:el.value.trim(),method:dialog.querySelector(`[data-criterion-method="${el.dataset.criterionLabel}"]`).value})).filter(c=>c.label);
    if(!outcome||!criteria.length||new Set(criteria.map(c=>c.label)).size!==criteria.length){toast('留下一个预期成果和不重复的完成标准。');return;}
    for(const c of criteria){const old=contractFor(getTask(activeTaskId)).criteria.find(k=>k.label===c.label&&k.method===c.method);if(old?.clue)c.clue=old.clue;}
    updateDraft(state.drafts[activeTaskId]?.text||'',{contract:{kind,outcome,criteria},confirmed:[]});assistance.delete(activeTaskId);renderTaskDialog();
  }
  function refreshAttachmentComposer(taskId){
    if(activeTaskId!==taskId||modalMode!=='compose')return;
    const field=document.activeElement,id=field?.id,start=field?.selectionStart,end=field?.selectionEnd,scroll=dialog.scrollTop;
    renderTaskDialog();
    const replacement=id?document.getElementById(id):null;
    if(replacement&&id!=='artifact-files'){replacement.focus({preventScroll:true});if(typeof start==='number'&&replacement.setSelectionRange)replacement.setSelectionRange(start,end);}
    dialog.scrollTop=scroll;
  }
  async function attachFiles(files){
    const taskId=activeTaskId;if(!taskId)return;if(uploading.has(taskId)){toast('上一份文件还在保存，请稍后再试。');return;}
    if(!files.length)return;
    const owner=state;
    if(!serviceAvailable){toast('附上文件需要本机服务。');return;}
    if((state.drafts[taskId]?.artifacts?.length||0)+files.length>4){toast('一版最多附上 4 份文件。');return;}
    uploading.add(taskId);refreshAttachmentComposer(taskId);
    let error='';
    try{
      for(const file of files){
        if(file.size>4*1024*1024)throw Error('每个文件最多 4 MB。');
        const base64=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(Error('文件没有读完，请重试。'));reader.readAsDataURL(file);});
        const imageExtension={'image/png':'png','image/jpeg':'jpg','image/webp':'webp','image/gif':'gif','image/svg+xml':'svg'}[file.type];
        const name=imageExtension&&!/\.(png|jpe?g|webp|gif|svg)$/i.test(file.name)?`图片-${uid()}.${imageExtension}`:file.name;
        const artifact=await api('artifacts/upload',{name,base64});
        if(state!==owner)break;
        const d=state.drafts[taskId]||{text:''};d.artifacts=[...(d.artifacts||[]).filter(a=>a.id!==artifact.id),artifact];state.drafts[taskId]=d;save();
      }
    }catch(e){error=e.message;toast(error);}finally{uploading.delete(taskId);if(activeTaskId===taskId&&modalMode==='compose'){refreshAttachmentComposer(taskId);dialog.querySelector('#delivery-error').textContent=error;}}
  }
  async function downloadArtifact(id){
    try{const a=await api('artifacts/read',{id});const bytes=Uint8Array.from(atob(a.base64),c=>c.charCodeAt(0));downloadBlob(new Blob([bytes],{type:'application/octet-stream'}),a.name);}catch(e){toast(e.message);}
  }
  function downloadBlob(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  function buildFromDecision(){
    const a=getAttempt(activeAttemptId);if(!a)return;
    const existing=state.customTasks.find(t=>t.derivedFrom===a.id);if(existing){openTask(existing.id);return;}
    const rabbit=/兔|栖栖/.test(a.text)&&/呼吸|起伏/.test(a.text),title=rabbit?'让首页的兔子轻轻呼吸':'把首页的主角做出来';
    const task={id:'custom-'+uid(),branch:a.branch,title,kind:'一份成果',prompt:'这一次，我做出了…',custom:true,choices:[],derivedFrom:a.id,sourceText:a.text,sourceVersion:versionNumber(a),contract:{kind:'artifact',outcome: rabbit?'可以打开体验的首页，沿用这一版兔子方案':'可以打开体验的首页主角',criteria:[{label:rabbit?'代码实现所选兔子及约定的呼吸动画':'代码实现所选首页主角',method:'content'},{label:rabbit?'实际打开后，呼吸节奏和起伏符合所选方案':'实际打开后，首页效果符合所选方案',method:'experience'}]}};
    state.customTasks.push(task);save();render();openTask(task.id);
  }
  function assistHTML(task){
    const item=assistance.get(task.id);
    if(!serviceAvailable||!aiConfig.configured)return `<div class="assist-panel"><p>栖栖还没有连上 AI。</p><button class="text-button" data-modal-command="ai-settings">连接 AI${icon('arrow')}</button></div>`;
    if(item?.status==='pending')return `<div class="assist-panel" role="status"><div class="ai-working">${icon('spark')}栖栖在读你的想法…</div></div>`;
    if(item?.status==='error')return `<div class="assist-panel"><p>${escape(item.message)}</p><button class="text-button" data-modal-command="refresh-assist">再试一次${icon('arrow')}</button></div>`;
    if(!item)return `<div class="assist-panel"><button class="text-button" data-modal-command="refresh-assist">请栖栖想一想${icon('spark')}</button></div>`;
    return `<div class="assist-panel"><div class="assist-label">栖栖的草稿 · AI 协助</div><p>${escape(item.result.draft)}</p>${item.result.question?`<p class="assist-question">${escape(item.result.question)}</p>`:''}<div class="assist-actions"><button class="text-button" data-modal-command="use-example">从这句改起${icon('arrow')}</button><button class="text-button" data-modal-command="use-starter">只给我半句</button><button class="text-button" data-modal-command="refresh-assist">换个想法</button></div></div>`;
  }
  function feedbackHTML(attempt,task){if(attempt.aiStatus&&attempt.aiStatus!=='complete')return waitingFeedbackHTML(attempt,task);const f=attempt.feedback;if(f.ratingVersion==='anchored-v1')return progressHTML(attempt,task);const accepted=state.accepted[task.id]===attempt.id;return `<div class="feedback-header"><div class="grade-seal"><strong>${escape(f.grade)}</strong><small>VERSION ${versionNumber(attempt)}</small></div><div><div class="feedback-title">${escape(f.title)}</div><div class="feedback-meta"><span>${formatDate(attempt.createdAt,true)}</span><span>·</span><span>${escape(attempt.provenance)}</span><span>·</span><span title="${escape(f.meta?.model||'')}">${escape(f.label)}</span></div></div></div><blockquote class="submission-quote">${escape(attempt.text)}</blockquote>${evidenceHTML(attempt)}${f.hint?`<div class="next-improvement">${icon('spark')}<div><small>${f.grade==='—'?'还缺一份依据':f.grade==='A'?'留给下一次':'下一点，可以很轻'}</small><p>${escape(f.hint)}</p></div></div>`:''}${f.checks.length?`<details class="rubric"><summary>本次标尺</summary><ul>${f.checks.map(c=>`<li class="${c.pass?'criteria-pass':''}">${icon(c.pass?'check':'circle')}${escape(c.label)}${c.status?`<small class="check-source">${c.status==='self'?'本人确认':c.status==='visual'?'AI 图像观察':c.status==='content'?'AI 内容审阅':'待验证'}</small>`:''}${c.source&&c.source!=='current'&&c.source!=='observation'?`<small>${escape(attempt.artifacts?.find(a=>a.id===c.source)?.name||'成果文件')}</small>`:''}${c.evidence?`<span class="criterion-evidence">${c.status==='visual'?escape(c.evidence):'「'+escape(c.evidence)+'」'}</span>`:''}</li>`).join('')}</ul><p style="margin-top:10px">${attempt.aiStatus==='complete'?'C · 起点　B · 有用的一步　A · 本次已足够　S · 额外的证据':'C · 留下想法　B · 一个要点　A · 两个要点'}</p></details>`:''}${f.comparison?`<p class="ai-comparison">${escape(f.comparison)}</p>`:''}${task.id==='home-focus'?'<div class="next-action-link"><button class="text-button" data-modal-command="build-decision">拿这版方案，去做出效果 ↗</button></div>':''}<div class="dialog-actions feedback-footer"><span class="${accepted?'accepted-note':'draft-state'}">${accepted?icon('check')+(attempt.contract?.kind==='artifact'?'已完成 · 本人确认':'这一版，已采用'):'第 '+versionNumber(attempt)+' 版，已独立留存'}</span><div class="action-buttons"><button class="secondary-button" data-modal-command="retry">${attempt.contract?.kind==='artifact'?'再交一版':'再改一点'}</button><button class="primary-button" data-modal-command="${accepted?'close':'adopt'}">${accepted?'这次先到这里':attempt.contract?.kind==='artifact'?'我认为已完成':'采用这版'}${icon('check')}</button></div></div>`;}
  function updateDraft(text,extra={}){if(!activeTaskId)return;state.drafts[activeTaskId]={text,...(state.drafts[activeTaskId]||{}),...extra};state.drafts[activeTaskId].text=text;state.drafts[activeTaskId].inputVersion=2;state.drafts[activeTaskId].updatedAt=new Date().toISOString();save();const counter=document.querySelector('#char-count');if(counter)counter.textContent=`${text.length} / 6000`;const submit=document.querySelector('#submit-attempt');if(submit)submit.disabled=!canSubmit(state.drafts[activeTaskId]);const draftStatus=document.querySelector('#draft-state');if(draftStatus)draftStatus.textContent=storageFailed?'尚未保存':'草稿已留下';}
  function insertDraft(text,extra){updateDraft(text,{...extra,confirmed:[]});dialog.querySelectorAll('[data-experience-check]').forEach(el=>el.checked=false);const textarea=document.querySelector('#action-text');textarea.value=text;textarea.focus();textarea.setSelectionRange(text.length,text.length);}
  function submit(){
    const task=getTask(activeTaskId),textarea=document.querySelector('#action-text');if(!textarea)return;
    const draft=state.drafts[task.id]||{}, contract=contractFor(task);if(!canSubmit(draft,task.id))return;
    if(draft.link&&!safeLink(draft.link)){toast('请填写完整的 HTTP / HTTPS 预览地址。');return;}
    if(draft.confirmed?.length&&!textarea.value.trim()){toast('先在记录里写下实际体验，再确认。');textarea.focus();return;}
    const text=textarea.value.trim()||('交付：'+((draft.artifacts||[]).map(a=>a.name).join('、')||draft.link));
    const provenance=draft.aiHelped?'AI 协助起草':draft.helped?'借助预设草稿':draft.chosen?'从候选中选择':'自己写下';
    const delivery={artifactIds:(draft.artifacts||[]).map(a=>a.id),link:draft.link||'',observation:QibanRecordInput.observation({...draft,text:textarea.value}),confirmed:draft.confirmed||[]};
    const attempt={id:uid(),taskId:task.id,taskTitle:task.title,branch:task.branch,goal:state.goal,text,createdAt:new Date().toISOString(),provenance,parentId:draft.retryOf||null,contract,delivery:clone(delivery),artifacts:clone(draft.artifacts||[]),aiStatus:'waiting',feedback:pendingFeedback(),aiContext:makeContext(task,text,provenance,contract,delivery)};
    state.attempts.push(attempt);state.contracts[task.id]=clone(contract);delete state.drafts[task.id];activeAttemptId=attempt.id;helpVisible=false;
    persistNotice('这一版的记录与成果，已经留下。');renderTaskDialog();dialog.scrollTop=0;focusDialogTitle();render();
    if(serviceAvailable&&aiConfig.configured)requestFeedback(attempt.id);
  }
  function adopt(id=activeAttemptId){const attempt=getAttempt(id);if(!attempt)return;state.accepted[attempt.taskId]=id;state.adoptions.push({attemptId:id,taskId:attempt.taskId,at:new Date().toISOString()});persistNotice(`已采用第 ${versionNumber(attempt)} 版，这一步收尾了。`);if(modalMode==='compare'){renderCompare();render();}else closeModal();}
  function retry(){const old=getAttempt(activeAttemptId);if(!old)return;state.drafts[old.taskId]=QibanRecordInput.unify({text:old.text,contract:clone(old.contract||contractFor(getTask(old.taskId))),artifacts:clone(old.artifacts||[]),link:old.delivery?.link||'',observation:old.delivery?.observation||'',confirmed:[],retryOf:old.id,aiHelped:old.provenance==='AI 协助起草',helped:old.provenance==='借助预设草稿',chosen:old.provenance==='从候选中选择'});save();activeAttemptId=null;helpVisible=false;renderTaskDialog();document.querySelector('#action-text').focus();}
  function renderCompare(){const task=getTask(activeTaskId);const list=records(task.id);if(list.length<2)return;modalMode='compare';dialog.className='compare-dialog';if(compareIds.length!==2||compareIds.some(id=>!list.some(a=>a.id===id)))compareIds=[list[0].id,list.at(-1).id];const pair=compareIds.map(getAttempt);dialog.innerHTML=dialogTop(`${escape(task.title)}<span class="slash">/</span>版本对比`)+`<div class="dialog-body"><h2 id="dialog-title">看看，这一点点变化。</h2><div class="comparison">${pair.map((a,side)=>`<section class="compare-column"><div class="compare-select-row"><select aria-label="${side?'右':'左'}侧版本" data-compare-side="${side}">${list.map((opt,i)=>`<option value="${escape(opt.id)}" ${opt.id===a.id?'selected':''}>第 ${i+1} 版${state.accepted[task.id]===opt.id?' · 已采用':''}</option>`).join('')}</select><span class="entry-grade">${escape(a.feedback.grade)}</span></div><p class="compare-content">${escape(a.text)}</p>${evidenceHTML(a)}<div class="compare-facts">${formatDate(a.createdAt,true)}<br>${escape(a.provenance)} · ${escape(a.feedback.label)}${a.feedback.checks.length?'<br>'+a.feedback.checks.filter(c=>c.pass).map(c=>escape(c.label)).join(' · '):''}</div><button class="text-button" data-adopt-version="${escape(a.id)}" ${state.accepted[task.id]===a.id?'disabled':''}>${state.accepted[task.id]===a.id?icon('check')+'当前采用':'采用第 '+versionNumber(a)+' 版'+icon('arrow')}</button></section>`).join('')}</div><div class="compare-summary">${comparisonNote(pair)}</div><div class="dialog-actions"><button class="text-button" data-modal-command="back-to-attempt">${icon('back')}回到行动</button><button class="secondary-button" data-modal-command="close">先到这里</button></div></div>`;loadImagePreviews();dialog.scrollTop=0;focusDialogTitle();}
  function comparisonNote([left,right]){if((left.aiStatus&&left.aiStatus!=='complete')||(right.aiStatus&&right.aiStatus!=='complete'))return '有一版还没有 AI 反馈，原文仍然可以对照。';if(left.id===right.id)return '这是同一个版本。';if(JSON.stringify(left.contract)!==JSON.stringify(right.contract))return '两版的完成标准不同，不直接比较评级。';if(JSON.stringify((left.artifacts||[]).map(a=>a.id).sort())!==JSON.stringify((right.artifacts||[]).map(a=>a.id).sort()))return '成果文件发生了变化。请对照文件内容与实际体验，文字评级不代表运行效果。';if(left.contract?.kind==='artifact'&&right.contract?.kind==='artifact'&&JSON.stringify(left.delivery)!==JSON.stringify(right.delivery))return '成果文件未变；两版的本人试用记录、确认或预览地址不同。';if(left.text===right.text&&JSON.stringify(left.delivery)===JSON.stringify(right.delivery))return '文字没有变化。这两次尝试，都独立保留着。';if(left.feedback.ratingVersion!==right.feedback.ratingVersion)return '评价方式已更新，两版评级不直接比较。';if(left.feedback.label!==right.feedback.label)return '两版的评价方式不同，先看原文里的变化。';if(right.parentId===left.id&&right.feedback.comparison)return escape(right.feedback.comparison);if(JSON.stringify(left.feedback.checks.map(c=>c.label))!==JSON.stringify(right.feedback.checks.map(c=>c.label)))return '这两版使用的标尺不同，评级不直接比较。';const added=right.feedback.checks.filter((c,i)=>c.level?['absent','clue','enough'].indexOf(c.level)>['absent','clue','enough'].indexOf(left.feedback.checks[i]?.level):c.pass&&!left.feedback.checks[i]?.pass);if(added.length)return `右侧多留下了一点：${added.map(c=>escape(c.label)).join('、')}。`;const lost=left.feedback.checks.filter((c,i)=>c.pass&&!right.feedback.checks[i]?.pass);if(lost.length)return `右侧暂时没有呈现：${lost.map(c=>escape(c.label)).join('、')}。两版都可以保留。`;return '当前标准下没有新增的达成项；两版原文都保留着。';}
  function openSimple(mode){dialog.className='';activeTaskId=null;activeAttemptId=null;const titles={add:'自己想走的一小步',goal:'把愿望，说得更准确一点',snapshot:'给这一段，留一张影',reset:'重新开始这份体验？'};let content='';
    if(mode==='add')content=`<label class="field-label" for="custom-title">这次想做的事</label><input class="text-field" id="custom-title" maxlength="50" placeholder="比如：给首页换一个标题" autofocus><label class="field-label" for="custom-kind">这次留下</label><select class="text-field" id="custom-kind"><option value="decision">一个决定 / 一段内容</option><option value="artifact">可交付的成果</option></select><label class="field-label" for="custom-prompt">一句开头 · 可留空</label><input class="text-field" id="custom-prompt" maxlength="100" placeholder="这一次，我想…"><div class="dialog-actions"><span class="draft-state">${escape(getBranch(state.branch).name)}</span><button class="primary-button" data-modal-command="save-custom">留下这个入口${icon('arrow')}</button></div>`;
    if(mode==='goal')content=`<label class="field-label" for="goal-input">目标表述</label><textarea class="text-field textarea" id="goal-input" maxlength="120" autofocus>${escape(state.goal)}</textarea><label class="field-label" for="scope-input">这一段的边界</label><input class="text-field" id="scope-input" maxlength="100" value="${escape(state.scope)}"><div class="dialog-actions"><span class="draft-state">旧版本里的目标，会留在原处</span><button class="primary-button" data-modal-command="save-goal">保存这一刻${icon('check')}</button></div>`;
    if(mode==='snapshot'){const recent=state.attempts.at(-1);content=`<label class="field-label" for="snapshot-title">这一页的名字</label><input class="text-field" id="snapshot-title" maxlength="60" value="${state.snapshots.length?'又往前走了一点':'第一次，把想法落在纸上'}"><label class="field-label" for="snapshot-note">和起点相比，现在的我…</label><textarea class="text-field textarea" id="snapshot-note" maxlength="2000" placeholder="留一句自己能认出的变化。"></textarea><div class="snapshot-preview"><small>此刻的切片</small><p>${state.attempts.length} 个版本 · ${Object.keys(state.accepted).length} 个行动收尾</p><p>${escape(recent?.taskTitle||'')} · 第 ${recent?versionNumber(recent):1} 版</p></div><div class="dialog-actions"><span class="draft-state">${formatDate(new Date().toISOString())}</span><button class="primary-button" data-modal-command="save-snapshot">留住这一段${icon('book')}</button></div>`;}
    if(mode==='reset')content='<p class="danger-copy">这份原型里的尝试、草稿和留影将被清空。</p><div class="dialog-actions"><button class="text-button" data-modal-command="export">先导出历程</button><div class="action-buttons"><button class="secondary-button" data-modal-command="close">保留</button><button class="primary-button" data-modal-command="confirm-reset">清空并重来</button></div></div>';
    dialog.innerHTML=dialogTop('栖伴 · 此刻')+`<div class="dialog-body"><h2 id="dialog-title">${titles[mode]}</h2>${content}</div>`;openModal(mode);
  }
  function saveSnapshot(){const title=document.querySelector('#snapshot-title').value.trim();if(!title){document.querySelector('#snapshot-title').focus();return;}const snap={id:uid(),title,note:document.querySelector('#snapshot-note').value.trim(),createdAt:new Date().toISOString(),goal:state.goal,scope:state.scope,branchName:getBranch(state.branch).name,evidence:state.attempts.map(a=>({id:a.id,title:a.taskTitle,version:versionNumber(a),text:a.text,grade:a.feedback.grade,provenance:a.provenance,...(a.contract?{contract:clone(a.contract),delivery:clone(a.delivery),artifacts:clone(a.artifacts),feedback:clone(a.feedback)}:{}),adopted:state.accepted[a.taskId]===a.id}))};state.snapshots.push(snap);persistNotice('这一段，已经留住。');closeModal();historyFilter='snapshots';go('history');}
  function openSnapshot(id){const snap=state.snapshots.find(s=>s.id===id);if(!snap)return;dialog.className='';dialog.innerHTML=dialogTop('阶段留影'+`<span class="slash">/</span>${formatDate(snap.createdAt)}`)+`<div class="dialog-body"><h2 id="dialog-title">${escape(snap.title)}</h2><p class="small-text">${escape(snap.goal)}</p><blockquote class="submission-quote" style="margin-top:20px">${escape(snap.note||'这段时间留下的每一版，都保存在这里。')}</blockquote>${snap.evidence.map(e=>`<article class="history-entry"><div class="entry-top"><h2>${escape(e.title)} · V${e.version}</h2><span class="entry-grade">${escape(e.grade)}</span></div><p class="entry-body">${escape(e.text)}</p>${evidenceHTML(e)}<div class="entry-info">${escape(e.provenance)}${e.adopted?' · 当时采用':''}</div></article>`).join('')}<div class="dialog-actions"><span class="draft-state">${escape(snap.branchName)} · 当时的样子</span><button class="primary-button" data-modal-command="close">收好这一页</button></div></div>`;openModal('snapshot-view');}
  async function exportData(){
    const snapshot=clone(state), ids=[...new Set([...snapshot.attempts.flatMap(a=>(a.artifacts||[]).map(f=>f.id)),...Object.values(snapshot.drafts).flatMap(d=>(d.artifacts||[]).map(f=>f.id)),...snapshot.snapshots.flatMap(s=>s.evidence.flatMap(e=>(e.artifacts||[]).map(f=>f.id))),...snapshot.stageRounds.flatMap(s=>s.evidence.flatMap(e=>(e.artifacts||[]).map(f=>f.id)))])];
    try{const files=[];for(const id of ids)files.push(await api('artifacts/read',{id}));const payload={product:'栖伴 · 成果行动原型',exportedAt:new Date().toISOString(),...snapshot,files};downloadBlob(new Blob([JSON.stringify(payload,null,2)],{type:'application/json;charset=utf-8'}),`栖伴-成长历程-${new Date().toISOString().slice(0,10)}.json`);toast('历程与成果文件已一同导出。');}
    catch(e){toast('导出未完成：'+e.message);}
  }
  main.addEventListener('click',event=>{const el=event.target.closest('button');if(!el)return;if(el.dataset.actionRestore){QibanActions.restore(state,el.dataset.actionRestore);persistNotice('行动已恢复。');render();return;}if(el.dataset.branch){QibanHome.resume(state);state.branch=el.dataset.branch;doneOnly=false;save();render();document.querySelector(`[data-branch="${state.branch}"]`)?.focus();}if(el.dataset.openTask)openTask(el.dataset.openTask);if(el.dataset.openAttempt){const a=getAttempt(el.dataset.openAttempt);openTask(a.taskId,a.id);}if(el.dataset.historyFilter){historyFilter=el.dataset.historyFilter;renderHistory();}if(el.dataset.openSnapshot)openSnapshot(el.dataset.openSnapshot);if(el.dataset.stageRound)openStageRound(el.dataset.stageRound);if(el.dataset.command)command(el.dataset.command);});
  function command(cmd){if(cmd==='home-recap')home.openRecap();if(cmd==='outings')home.openLibrary();if(cmd==='stage-review')openStage();if(cmd==='ai-settings')openAISettings();if(cmd==='history'||cmd==='now')go(cmd);if(cmd==='filter-done'){doneOnly=!doneOnly;renderNow();}if(cmd==='add-action')openSimple('add');if(cmd==='snapshot'&&state.attempts.length)openSimple('snapshot');if(cmd==='edit-goal')openSimple('goal');if(cmd==='export')exportData();if(cmd==='reset')openSimple('reset');}
  document.querySelectorAll('[data-view]').forEach(btn=>btn.addEventListener('click',()=>go(btn.dataset.view)));
  window.addEventListener('hashchange',()=>{view=viewFromHash();render();});
  document.querySelector('.brand').addEventListener('click',()=>go('now'));
  document.querySelector('#more-button').addEventListener('click',()=>{const menu=document.querySelector('#more-menu');menu.hidden=!menu.hidden;document.querySelector('#more-button').setAttribute('aria-expanded',String(!menu.hidden));});
  document.querySelector('#more-menu').addEventListener('click',event=>{const btn=event.target.closest('[data-command]');if(!btn)return;document.querySelector('#more-menu').hidden=true;document.querySelector('#more-button').setAttribute('aria-expanded','false');command(btn.dataset.command);});
  document.addEventListener('click',event=>{if(!event.target.closest('.top-actions')){document.querySelector('#more-menu').hidden=true;document.querySelector('#more-button').setAttribute('aria-expanded','false');}});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'){document.querySelector('#more-menu').hidden=true;document.querySelector('#more-button').setAttribute('aria-expanded','false');}});
  dialog.addEventListener('cancel',event=>{event.preventDefault();closeModal();});
  dialog.addEventListener('click',event=>{
    const btn=event.target.closest('button');if(!btn)return;
    if(btn.dataset.downloadArtifact){downloadArtifact(btn.dataset.downloadArtifact);return;}
    if(btn.dataset.removeArtifact){const d=state.drafts[activeTaskId];if(d){d.artifacts=d.artifacts.filter(a=>a.id!==btn.dataset.removeArtifact);save();renderTaskDialog();}return;}
    if(btn.dataset.actionRestore){QibanActions.restore(state,btn.dataset.actionRestore);persistNotice('行动已恢复。');render();renderTaskDialog();return;}
    if(btn.dataset.replaceReason){const w=state.replacements[activeTaskId];if(w.status==='pending')return;if(w.proposal){QibanActions.reject(state,getTask(activeTaskId).branch,w.proposal,'换一种偏好');w.declined.push({title:w.proposal.title,reason:'换一种偏好'});}w.reason=w.reason===btn.dataset.replaceReason?'':btn.dataset.replaceReason;delete w.proposal;w.status='idle';save();renderReplacement();return;}
    if(btn.dataset.version){activeAttemptId=btn.dataset.version;helpVisible=false;renderTaskDialog();return;}
    if(btn.dataset.adoptVersion){adopt(btn.dataset.adoptVersion);return;}
    if(btn.dataset.choice!==undefined){const task=getTask(activeTaskId);const text=(task.prefix||'')+task.choices[Number(btn.dataset.choice)]+'。';insertDraft(text,{chosen:true,helped:false,aiHelped:false});dialog.querySelectorAll('[data-choice]').forEach(c=>c.classList.toggle('chosen',c===btn));return;}
    const cmd=btn.dataset.modalCommand;
    if(cmd==='close')closeModal();
    if(cmd==='submit')submit();
    if(cmd==='skip-action')skipAction();
    if(cmd==='replace-action')openReplacement();
    if(cmd==='cancel-replacement')renderTaskDialog();
    if(cmd==='generate-replacement')requestReplacement();
    if(cmd==='retry-replacement')requestReplacement(true);
    if(cmd==='use-replacement')applyReplacement();
    if(cmd==='edit-contract')editContract();
    if(cmd==='save-contract')saveContract();
    if(cmd==='cancel-contract')renderTaskDialog();
    if(cmd==='build-decision')buildFromDecision();
    if(cmd==='adopt')adopt();
    if(cmd==='retry')retry();
    if(cmd==='help'){helpVisible=!helpVisible;document.querySelector('#assist-slot').innerHTML=helpVisible?assistHTML(getTask(activeTaskId)):'';btn.setAttribute('aria-expanded',String(helpVisible));if(helpVisible&&!assistance.has(activeTaskId)&&serviceAvailable&&aiConfig.configured)requestAssistance(activeTaskId);}
    if(cmd==='use-example'){const value=assistance.get(activeTaskId);if(value?.status==='complete')insertDraft(value.result.draft,{aiHelped:true});}
    if(cmd==='use-starter'){const value=assistance.get(activeTaskId);if(value?.status==='complete')insertDraft(value.result.starter,{aiHelped:true});}
    if(cmd==='refresh-assist')requestAssistance(activeTaskId);
    if(cmd==='ai-settings')openAISettings();
    if(cmd==='save-ai')saveAISettings();
    if(cmd==='retry-feedback')requestFeedback(activeAttemptId);
    if(cmd==='ai-settings-back')returnFromAISettings();
    if(cmd==='compare'){compareIds=[];renderCompare();}
    if(cmd==='back-to-attempt')renderTaskDialog();
    if(cmd==='resume-draft'){activeAttemptId=null;renderTaskDialog();}
    if(cmd==='save-custom'){const title=document.querySelector('#custom-title').value.trim();if(!title){document.querySelector('#custom-title').focus();return;}const task={id:'custom-'+uid(),title,branch:state.branch,kind:'自己的一步',prompt:document.querySelector('#custom-prompt').value.trim()||'这一次，我留下…',custom:true,choices:[]};if(document.querySelector('#custom-kind').value==='artifact'){task.kind='一份成果';task.contract={kind:'artifact',outcome:title,criteria:[{label:'成果内容实现了本次约定',method:'content'},{label:'实际体验符合预期',method:'experience'}]};}state.customTasks.push(task);persistNotice('多了一个自己的入口。');closeModal();openTask(task.id);}
    if(cmd==='save-goal'){const title=document.querySelector('#goal-input').value.trim();if(!title){document.querySelector('#goal-input').focus();return;}state.goal=title;QibanHome.resume(state);state.scope=document.querySelector('#scope-input').value.trim();persistNotice('目标已经更新，旧版本仍在。');closeModal();}
    if(cmd==='save-snapshot')saveSnapshot();
    if(cmd==='export')exportData();
    if(cmd==='confirm-reset'){assistance.clear();state=freshState();QibanActions.ensure(state);QibanHome.ensure(state);doneOnly=false;historyFilter='all';persistNotice('重新从这里开始。');closeModal();go('now');}
  });
  QibanAttachmentInput.bind(dialog,{canReceive:()=>dialog.open&&modalMode==='compose'&&Boolean(activeTaskId),onFiles:attachFiles,onUnavailable:()=>toast('先进入新一版，再附上文件。')});
  dialog.addEventListener('input',event=>{if(event.target.id==='replacement-reason'){const w=state.replacements[activeTaskId];w.reason=event.target.value;save();}if(event.target.id==='action-text')updateDraft(event.target.value);const key={'delivery-link':'link'}[event.target.id];if(key)updateDraft(state.drafts[activeTaskId]?.text||'',{[key]:event.target.value});});
  dialog.addEventListener('change',event=>{if((event.target.id==='artifact-files'||event.target.id==='composer-images')){attachFiles([...event.target.files]);return;}if(event.target.dataset.experienceCheck!==undefined){const confirmed=[...dialog.querySelectorAll('[data-experience-check]:checked')].map(el=>Number(el.dataset.experienceCheck));updateDraft(state.drafts[activeTaskId]?.text||'',{confirmed});return;}if(event.target.dataset.compareSide!==undefined){compareIds[Number(event.target.dataset.compareSide)]=event.target.value;renderCompare();}});
  function pendingFeedback(message='原文已经留下，等栖栖来读。'){
    return {grade:'—',label:'待 AI 反馈',title:'这一版，先留下了。',strength:message,hint:'',checks:[]};
  }
  function makeContext(task,current,provenance,contract=contractFor(task),delivery=null){
    return {ratingVersion:'anchored-v1',goal:state.goal,scope:state.scope,branch:getBranch(task.branch).outcome,
      constraints:state.goal.includes('栖伴')?['保留多个可选行动，允许用户改变方向；可以突出一个建议，但不能把它变成唯一入口。','行动颗粒度小，AI 可以先起草，用户做选择。','每次提交独立保存；评级不强制决定收尾。','沿用纸白、紫苏色和栖栖兔子，界面简洁，不陈列功能使用说明。']:[],
      task:{title:task.title,prompt:task.prompt,criteria:contract.criteria.map(c=>c.label),contract,...(task.sourceText?{reference:task.sourceText}:{})},current,provenance,delivery:delivery||{artifactIds:(state.drafts[task.id]?.artifacts||[]).map(a=>a.id),link:state.drafts[task.id]?.link||'',observation:QibanRecordInput.observation(state.drafts[task.id]),confirmed:state.drafts[task.id]?.confirmed||[]},
      continuity:{accepted:getAttempt(state.accepted[task.id])?.text||'',advice:records(task.id).filter(a=>a.feedback.hint).slice(-12).map(a=>a.feedback.hint)},
      previous:records(task.id).slice(-3).map(a=>({text:a.text,grade:a.feedback.grade,source:a.feedback.label,...(a.feedback.ratingVersion?{ratingVersion:a.feedback.ratingVersion,levels:a.feedback.checks.map(c=>c.level)}:{}),hint:a.feedback.hint||'',...(a.contract?{deliverySummary:{fileIds:(a.artifacts||[]).map(f=>f.id),contractKey:JSON.stringify(a.contract),observation:a.delivery?.observation||'',confirmedKey:JSON.stringify(a.delivery?.confirmed||[]),link:a.delivery?.link||''}}:{})}))};
  }
  async function api(path,payload){
    if(STATIC_PREVIEW)throw Error('当前是界面预览，AI 与成果上传需要运行本机版。');
    const session=document.querySelector('meta[name="qiban-session"]')?.content;
    if(location.protocol==='file:'||(!session&&payload))throw Error('本地 AI 服务还没有启动。');
    try{
      const response=await fetch('/api/ai/'+path,{method:payload?'POST':'GET',headers:payload?{'Content-Type':'application/json','X-Qiban-Token':session}:{},body:payload?JSON.stringify(payload):undefined,signal:AbortSignal.timeout(65000)});
      let result;try{result=await response.json();}catch{throw Error('本地 AI 服务还没有启动。');}
      if(!response.ok)throw Error(result.message||'暂时无法完成请求。');
      return result;
    }catch(error){
      if(error.name==='TimeoutError'||error.name==='AbortError')throw Error('这次等待有点久，原文已保留，可以稍后重试。');
      if(error instanceof TypeError)throw Error('本地服务暂时无法连接，原文已保留。');
      throw error;
    }
  }
  function renderAIStatus(){
    const status=document.querySelector('#ai-connection');
    status.classList.toggle('connected',Boolean(aiConfig.lastTest?.ok));
    status.querySelector('span').textContent=STATIC_PREVIEW?'界面预览':aiConfig.lastTest?.ok?'AI 已连接':aiConfig.configured?'AI 待验证':'连接 AI';
    status.setAttribute('aria-label',STATIC_PREVIEW?'关于在线预览':'AI 连接设置');
  }
  async function refreshAIConfig(){
    if(STATIC_PREVIEW){serviceAvailable=false;renderAIStatus();return;}
    try{const data=await api('config');aiConfig={...aiConfig,...data,baseUrl:data.baseUrl||'https://api.deepseek.com',model:data.model||'deepseek-flash'};serviceAvailable=true;}catch{serviceAvailable=false;}
    renderAIStatus();
  }
  async function requestAssistance(taskId){
    if(!serviceAvailable||!aiConfig.configured){openAISettings();return;}
    if(assistance.get(taskId)?.status==='pending')return;
    const task=getTask(taskId);if(!task)return;
    const entry={status:'pending'};assistance.set(taskId,entry);renderAssistSlot(taskId);
    const context=makeContext(task,state.drafts[taskId]?.text||'',state.drafts[taskId]?.aiHelped?'AI 协助起草':'用户当前草稿');
    try{const result=await api('assist',{requestId:'assist-'+uid(),context});if(assistance.get(taskId)!==entry)return;assistance.set(taskId,{status:'complete',...result});}
    catch(error){if(assistance.get(taskId)!==entry)return;assistance.set(taskId,{status:'error',message:error.message});}
    renderAssistSlot(taskId);
  }
  function renderAssistSlot(taskId){if(activeTaskId===taskId&&modalMode==='compose'&&helpVisible){const slot=document.querySelector('#assist-slot');if(slot)slot.innerHTML=assistHTML(getTask(taskId));}}
  async function requestFeedback(attemptId){
    const attempt=getAttempt(attemptId);
    if(!attempt||attempt.aiStatus==='complete'||feedbackRequests.has(attemptId))return;
    if(!serviceAvailable||!aiConfig.configured){openAISettings();return;}
    feedbackRequests.add(attemptId);attempt.aiStatus='pending';attempt.feedback=pendingFeedback('栖栖正在读这一版…');save();refreshAttempt(attemptId);
    try{
      const output=await api('feedback',{requestId:attempt.id,context:attempt.aiContext});
      if(getAttempt(attemptId)!==attempt)return;
      attempt.feedback={...output.result,label:output.result.scope==='mixed'?'AI 反馈 · 含本人确认':output.result.scope==='visual'?'AI 图片反馈':output.result.scope?'AI 内容反馈':'AI 反馈',engine:'model',meta:output.meta};attempt.aiStatus='complete';delete attempt.aiError;
      const task=getTask(attempt.taskId);if(task.custom&&!task.aiCriteria)task.aiCriteria=output.result.checks.map(c=>c.label);
      persistNotice('栖栖读完了这一版。');
    }catch(error){
      if(getAttempt(attemptId)!==attempt)return;
      attempt.aiStatus='error';attempt.aiError=error.message;attempt.feedback=pendingFeedback(error.message);save();
    }finally{feedbackRequests.delete(attemptId);if(getAttempt(attemptId)===attempt)refreshAttempt(attemptId);}
  }
  function refreshAttempt(id){render();if(dialog.open&&activeAttemptId===id&&modalMode==='feedback')renderTaskDialog();}
  function waitingFeedbackHTML(attempt,task){
    const pending=attempt.aiStatus==='pending',accepted=state.accepted[task.id]===attempt.id;
    const message=pending?'栖栖正在读这一版…':attempt.aiError||attempt.feedback.strength;
    return `<div class="feedback-header"><div class="grade-seal"><strong>—</strong><small>VERSION ${versionNumber(attempt)}</small></div><div><div class="feedback-title">这一版，先留下了。</div><div class="feedback-meta">${formatDate(attempt.createdAt,true)} · ${escape(attempt.provenance)}</div></div></div><blockquote class="submission-quote">${escape(attempt.text)}</blockquote>${evidenceHTML(attempt)}<div class="ai-feedback-state" role="status"><div class="${pending?'ai-working':''}">${icon('spark')}<span>${escape(message)}</span></div>${!pending?`<button class="text-button" data-modal-command="${aiConfig.configured?'retry-feedback':'ai-settings'}">${aiConfig.configured?'请栖栖读这一版':'连接 AI'}${icon('arrow')}</button>`:''}</div><div class="dialog-actions feedback-footer"><span class="${accepted?'accepted-note':'draft-state'}">${accepted?icon('check')+(attempt.contract?.kind==='artifact'?'已完成 · 本人确认':'这一版，已采用'):'原文已独立留存'}</span><div class="action-buttons"><button class="secondary-button" data-modal-command="retry">${attempt.contract?.kind==='artifact'?'再交一版':'再改一点'}</button><button class="primary-button" data-modal-command="${accepted?'close':'adopt'}">${accepted?'这次先到这里':attempt.contract?.kind==='artifact'?'我认为已完成':'采用这版'}${icon('check')}</button></div></div>`;
  }
  let settingsReturn=null;
  function openAISettings(){
    if(STATIC_PREVIEW){dialog.innerHTML=dialogTop('栖伴 · 在线预览')+'<div class="dialog-body"><h2 id="dialog-title">先看看栖伴。</h2><p class="outing-speech">行动与收藏会留在当前浏览器。AI 反馈和图片上传，可以在本机版里使用。</p><div class="dialog-actions"><a class="text-button" href="https://github.com/ciki-9876/qiban#本机运行" target="_blank" rel="noopener noreferrer">获取本机版 ↗</a><button class="primary-button" data-modal-command="close">继续看看</button></div></div>';openModal('static-preview');return;}

    if(modalMode!=='ai-settings')settingsReturn=activeTaskId?{taskId:activeTaskId,attemptId:activeAttemptId,helpVisible}:null;
    dialog.className='';
    dialog.innerHTML=dialogTop('栖伴 · AI 连接')+`<div class="dialog-body"><h2 id="dialog-title">让栖栖，读懂这一小步。</h2><div class="connection-state" id="connection-state" role="status">${serviceAvailable?(aiConfig.lastTest?.ok?'已连接 · '+escape(aiConfig.model):'尚未验证连接'):'本地 AI 服务未连接'}</div><form id="ai-settings-form"><label class="field-label" for="ai-base-url">API 地址</label><input class="text-field" id="ai-base-url" type="url" value="${escape(aiConfig.baseUrl)}" maxlength="600" required autocomplete="off"><label class="field-label" for="ai-model">模型</label><input class="text-field" id="ai-model" value="${escape(aiConfig.model)}" maxlength="200" required autocomplete="off"><label class="field-label" for="ai-key">API Key <small>${aiConfig.keySaved?'已保存在本机服务端':'仅保存在本机服务端'}</small></label><input class="text-field" id="ai-key" type="password" maxlength="4096" autocomplete="off" placeholder="${aiConfig.keySaved?'已保存，留空沿用':'输入服务商提供的密钥'}"><details class="ai-options"><summary>兼容选项</summary><label class="field-label" for="ai-format">输出格式</label><select class="text-field" id="ai-format">${[['json_object','JSON 模式'],['json_schema','严格 JSON Schema'],['prompt','提示词兼容']].map(([id,label])=>`<option value="${id}" ${aiConfig.format===id?'selected':''}>${label}</option>`).join('')}</select><label class="field-label" for="ai-token-field">长度参数</label><select class="text-field" id="ai-token-field"><option value="max_tokens" ${aiConfig.tokenField==='max_tokens'?'selected':''}>max_tokens</option><option value="max_completion_tokens" ${aiConfig.tokenField==='max_completion_tokens'?'selected':''}>max_completion_tokens</option></select></details><div class="dialog-actions"><button class="text-button" type="button" data-modal-command="ai-settings-back">${icon('back')}${settingsReturn?'回到行动':'先到这里'}</button><button class="primary-button" id="save-ai-button" type="submit" ${!serviceAvailable?'disabled':''}>保存并测试${icon('spark')}</button></div></form></div>`;
    openModal('ai-settings');
    document.querySelector('#ai-settings-form').addEventListener('submit',event=>{event.preventDefault();saveAISettings();});
  }
  async function saveAISettings(){
    const button=document.querySelector('#save-ai-button');if(!button||button.disabled)return;
    const payload={baseUrl:document.querySelector('#ai-base-url').value.trim(),model:document.querySelector('#ai-model').value.trim(),apiKey:document.querySelector('#ai-key').value.trim(),format:document.querySelector('#ai-format').value,tokenField:document.querySelector('#ai-token-field').value};
    button.disabled=true;button.textContent='正在连接…';const status=document.querySelector('#connection-state');status.textContent='正在验证连接…';document.querySelector('#ai-key').value='';
    try{
      aiConfig=await api('config',payload);payload.apiKey='';aiConfig=await api('test',{});renderAIStatus();
      if(modalMode==='ai-settings'){status.textContent='已连接 · '+aiConfig.model;button.textContent='连接已验证';document.querySelector('#ai-key').placeholder='已保存，留空沿用';toast('栖栖已经连上 AI。');}
    }catch(error){payload.apiKey='';if(modalMode==='ai-settings'){status.textContent=error.message;button.textContent='保存并测试';}renderAIStatus();}
    finally{if(modalMode==='ai-settings')button.disabled=false;}
  }
  function returnFromAISettings(){
    const previous=settingsReturn;settingsReturn=null;
    if(!previous){closeModal();return;}
    activeTaskId=previous.taskId;activeAttemptId=previous.attemptId;helpVisible=previous.helpVisible;renderTaskDialog();
    if(serviceAvailable&&aiConfig.lastTest?.ok){if(activeAttemptId&&getAttempt(activeAttemptId)?.aiStatus!=='complete')requestFeedback(activeAttemptId);else if(!activeAttemptId&&helpVisible&&!assistance.has(activeTaskId))requestAssistance(activeTaskId);}
  }
  document.querySelector('#ai-connection').addEventListener('click',openAISettings);

  const levelName={absent:'还没出现',clue:'已有线索',enough:'已经足够'};
  function actionOptions(task){return state.hiddenActions[task.id]?`<div class="task-options"><span class="small-text">已从当前行动移走</span><button class="text-button" data-action-restore="${escape(task.id)}">恢复这个行动</button></div>`:`<div class="task-options"><button class="text-button" data-modal-command="replace-action">${icon('spark')}让栖栖换一个</button><button class="text-button" data-modal-command="skip-action">我不想做这个</button></div>`;}
  function hiddenActionsHTML(branch){const list=allTasks().filter(t=>t.branch===branch&&state.hiddenActions[t.id]);return list.length?`<details class="hidden-actions"><summary>暂不做 · ${list.length}</summary>${list.map(t=>`<div><span>${escape(t.title)}</span><button class="text-button" data-action-restore="${escape(t.id)}">${state.hiddenActions[t.id].replacementId?'撤销替换':'恢复'}</button></div>`).join('')}</details>`:'';}
  function skipAction(){const task=getTask(activeTaskId);if(!task)return;QibanActions.hide(state,task);persistNotice('已移走，可以在“暂不做”里恢复。');closeModal();}
  function openReplacement(){const task=getTask(activeTaskId);if(!task)return;state.replacements[task.id] ||= {reason:'',declined:[]};renderReplacement();}
  function renderReplacement(){
    const task=getTask(activeTaskId),w=state.replacements[task.id],busy=w.status==='pending',p=w.proposal;
    dialog.className='';modalMode='replacement';
    dialog.innerHTML=dialogTop('换一条适合自己的路')+`<div class="dialog-body"><h2 id="dialog-title">换一个，试试看。</h2><p class="small-text">${escape(task.title)}</p><div class="replacement-reasons">${['再小一点','换种做法','换个方向'].map(r=>`<button class="choice-chip ${w.reason===r?'chosen':''}" data-replace-reason="${r}" aria-pressed="${w.reason===r}" ${busy?'disabled':''}>${r}</button>`).join('')}</div><input id="replacement-reason" class="text-field" maxlength="300" aria-label="换行动的偏好" placeholder="也可以说说偏好 · 可留空" value="${escape(w.reason||'')}" ${busy?'disabled':''}>${busy?'<p class="stage-working" role="status">栖栖在找另一条小路…</p>':w.error?`<p class="delivery-error" role="status">${escape(w.error)}</p>`:''}${p&&!busy?`<article class="replacement-preview"><h3>${escape(p.title)}</h3><p>${escape(p.why)}</p>${contractHTML(p.contract)}</article>`:''}<div class="dialog-actions"><button class="text-button" data-modal-command="cancel-replacement">先保留原行动</button><div class="action-buttons"><button class="${p?'secondary-button':'primary-button'}" data-modal-command="generate-replacement" ${busy?'disabled':''}>${busy?'正在想…':p?'再换一个':'请栖栖换一个'}</button>${p&&!busy?'<button class="primary-button" data-modal-command="use-replacement">就做这个</button>':''}${w.status==='error'||w.status==='interrupted'?'<button class="text-button" data-modal-command="retry-replacement">重试</button>':''}</div></div></div>`;focusDialogTitle();
  }
  async function requestReplacement(retry=false){
    const id=activeTaskId,task=getTask(id),w=state.replacements[id];if(!w||w.status==='pending'||state.hiddenActions[id])return;
    if(!serviceAvailable||!aiConfig.configured){toast('先连接 AI，再请栖栖换一个。');return;}
    const owner=state;
    if(!retry){if(w.proposal){QibanActions.reject(state,task.branch,w.proposal,w.reason||'这个候选也不想做');w.declined.push({title:w.proposal.title,reason:w.reason||'这个候选也不想做'});}delete w.proposal;w.requestId='replace-'+uid();w.context={goal:state.goal,scope:state.scope,branch:stageWork(task.branch).outcome,task:{title:task.title,outcome:contractFor(task).outcome},reason:w.reason||'',existing:allTasks().filter(t=>t.branch===task.branch&&!state.hiddenActions[t.id]).slice(-100).map(t=>t.title),declined:[...new Map([...QibanActions.declined(state,task.branch),...w.declined].map(t=>[t.title,t])).values()].slice(-30)};}
    w.status='pending';delete w.error;save();renderReplacement();
    try{const out=await api('replace',{requestId:w.requestId,context:w.context});if(state!==owner||state.replacements[id]!==w)return;w.status='complete';w.proposal=out.result;}
    catch(e){if(state!==owner||state.replacements[id]!==w)return;w.status='error';w.error=e.message;}
    finally{if(state===owner&&state.replacements[id]===w){save();if(dialog.open&&modalMode==='replacement'&&activeTaskId===id)renderReplacement();}}
  }
  function applyReplacement(){const old=getTask(activeTaskId),w=state.replacements[old.id];if(!w.proposal||w.status!=='complete')return;const task=QibanActions.replace(state,old,w.proposal,{id:'custom-'+uid(),reason:w.context?.reason||w.reason});if(!task)return;delete state.replacements[old.id];persistNotice('换好了，之前的记录还在。');activeTaskId=task.id;activeAttemptId=null;helpVisible=false;render();renderTaskDialog();}
  function progressHTML(a,task){
    const f=a.feedback,accepted=state.accepted[task.id]===a.id,list=records(a.taskId),prev=list[list.findIndex(x=>x.id===a.id)-1],comparable=prev?.feedback.ratingVersion===f.ratingVersion&&JSON.stringify(prev.contract)===JSON.stringify(a.contract);
    return `<div class="progress-feedback-header"><div><div class="feedback-title">${escape(f.change.summary)}</div><div class="feedback-meta">${formatDate(a.createdAt,true)} · 第 ${versionNumber(a)} 版 · ${escape(f.label)}</div>${f.change.adviceStatus==='applied'?'<span class="advice-followed">'+icon('check')+'上次建议，已回应</span>':''}</div><div class="progress-grade" aria-label="本次评级 ${escape(f.grade)}"><strong>${escape(f.grade)}</strong><small>${f.grade==='A'?'本次已足够':f.grade==='S'?'额外的证据':f.grade==='B'?'有用的一步':f.grade==='C'?'相关的起点':'待确认'}</small></div></div><div class="progress-checks">${f.checks.map((c,i)=>{const from=comparable?prev.feedback.checks[i]?.level:null;return `<details class="progress-check"><summary><span>${escape(c.label)}</span><span class="criterion-level ${c.level}"><i class="level-dots" aria-hidden="true">${[0,1,2].map(n=>`<b class="${n<=['absent','clue','enough'].indexOf(c.level)?'filled':''}"></b>`).join('')}</i>${from&&from!==c.level?escape(levelName[from])+' → ':''}${levelName[c.level]}</span></summary>${c.evidence?`<p>${c.status==='visual'?escape(c.evidence):'「'+escape(c.evidence)+'」'}</p>`:'<p>这次记录里还未找到对应依据。</p>'}${c.source?`<small>${c.status==='self'?'本人确认':c.status==='reported'?'本人描述 · 尚未确认':c.status==='visual'?'AI 图像观察':c.source==='current'?'本次原文':'成果内容'}</small>`:''}</details>`;}).join('')}</div><blockquote class="submission-quote">${escape(a.text)}</blockquote>${evidenceHTML(a)}${f.hint?`<div class="next-improvement">${icon('spark')}<div><small>还差这一点</small><p>${escape(f.hint)}</p></div></div>`:''}${f.comparison&&prev&&/(不直接比较|暂未取得分析|尚未对比文件内容|未访问该地址|未变，不将)/.test(f.comparison)?`<p class="ai-comparison">${escape(f.comparison)}</p>`:''}${task.id==='home-focus'?'<div class="next-action-link"><button class="text-button" data-modal-command="build-decision">拿这版方案，去做出效果 ↗</button></div>':''}<div class="dialog-actions feedback-footer"><span class="${accepted?'accepted-note':'draft-state'}">${accepted?icon('check')+'这一版，已采用':'第 '+versionNumber(a)+' 版，已独立留存'}</span><div class="action-buttons"><button class="secondary-button" data-modal-command="retry">${a.contract?.kind==='artifact'?'再交一版':'再试一次'}</button><button class="primary-button" data-modal-command="${accepted?'close':'adopt'}">${accepted?'这次先到这里':a.contract?.kind==='artifact'?'我认为已完成':'就留下这版'}${icon('check')}</button></div></div>`;
  }

  let activeStageId=null;
  const stageWork=id=>QibanStages.current(state,getBranch(id));
  const stageKey=id=>JSON.stringify({goal:state.goal,declined:QibanActions.declined(state,id),outcome:stageWork(id).outcome,records:state.attempts.filter(a=>a.branch===id).map(a=>[a.id,a.aiStatus,a.feedback]),adopted:[...new Set(state.attempts.filter(a=>a.branch===id).map(a=>a.taskId))].map(id=>[id,state.accepted[id]||null])});
  function stageEntry(branch){
    const w=stageWork(branch.id), ts=allTasks().filter(t=>t.branch===branch.id&&!state.hiddenActions[t.id]),done=ts.length&&ts.every(t=>state.accepted[t.id]);
    return `<div class="stage-entry ${done?'stage-ready':''}"><span>${w.closedId?`第 ${w.round} 轮，已收尾`:done?'这些行动，已经收尾':`第 ${w.round} 轮`}</span><button class="${done?'secondary-button':'text-button'}" data-command="stage-review">${w.closedId?'回看这一阶段':'和栖栖聊聊这一阶段'}${icon('arrow')}</button></div>`;
  }
  function stageContext(id,message){
    const w=stageWork(id), prior=state.stageRounds.filter(r=>r.branchId===id).at(-1), all=state.attempts.filter(a=>a.branch===id), chosen=[...all.filter(a=>state.accepted[a.taskId]===a.id),...all.slice().reverse()];
    const seen=new Set();const records=chosen.filter(a=>{if(seen.has(a.id))return false;seen.add(a.id);return true;}).slice(0,60).map(a=>({id:a.id,title:a.taskTitle,text:a.text,adopted:state.accepted[a.taskId]===a.id,version:versionNumber(a),grade:a.feedback.grade,outcome:a.contract?.outcome||'',observation:a.delivery?.observation||'',files:(a.artifacts||[]).map(f=>f.name),checks:(a.feedback.checks||[]).map(c=>({label:c.label,pass:c.pass,status:c.status||'',evidence:c.evidence||''}))}));
    return {declined:QibanActions.declined(state,id),goal:state.goal,scope:state.scope,stage:{id,name:getBranch(id).name,outcome:w.outcome,round:w.round},records,totalRecords:all.length,tasks:allTasks().filter(t=>t.branch===id&&!state.hiddenActions[t.id]).slice(0,80).map(t=>({title:t.title,done:Boolean(state.accepted[t.id])})),message,...(prior?{baseline:{outcome:prior.outcome,grade:prior.grade,summary:prior.review?.result.summary||'',recordIds:prior.evidence.map(a=>a.id).slice(-60)}}:{}),discussion:[...(prior?.discussion||[]).slice(-2),...w.reviews].filter(r=>r.status==='complete'&&r.context.stage.outcome===w.outcome).slice(-8).map(r=>({user:r.message,recommendation:r.result.recommendation,reason:r.result.reason}))};
  }
  function openStage(id=state.branch){
    activeStageId=id;activeTaskId=null;activeAttemptId=null;const w=stageWork(id);
    if(w.closedId){openStageRound(w.closedId);return;}
    renderStage();openModal('stage');if(!w.reviews.length&&serviceAvailable&&aiConfig.configured)requestStage();
  }
  function stageReviewHTML(review,archived=false){
    const r=review.result;
    return `<div class="stage-verdict"><span class="stage-grade">${escape(r.grade)}</span><div><small>栖栖建议</small><h3>${r.recommendation==='advance'?'可以进入下一阶段了':'先补一处，再往前走'}</h3><p>${escape(r.reason)}</p></div></div><details class="stage-evidence"><summary>判断依据</summary>${r.findings.map(f=>`<div class="stage-finding"><span class="stage-finding-status">${{met:'已有依据',gap:'仍有缺口',unknown:'待确认'}[f.status]}</span><strong>${escape(f.label)}</strong><p>${escape(f.detail)}</p><div>${f.sources.map(id=>id==='user'?'<span class="small-text">本人的讨论记录</span>':`<button class="text-button" data-stage-evidence="${escape(id)}">${escape(review.context.records.find(a=>a.id===id)?.title||'行动记录')} ↗</button>`).join('')}</div></div>`).join('')}</details>${!archived&&r.suggestions.length?`<div class="stage-suggestions">${r.suggestions.map((s,i)=>`<article><small>${s.kind==='gap'?'建议先做':'以后也可以'}</small><h3>${escape(s.title)}</h3><p>${escape(s.why)}</p><button class="text-button" data-stage-suggestion="${i}" data-review-id="${escape(review.id)}" ${stageWork(activeStageId).addedSuggestions[review.id+':'+i]?'disabled':''}>${stageWork(activeStageId).addedSuggestions[review.id+':'+i]?'已加入行动':'选这一小步'}${icon('plus')}</button></article>`).join('')}</div>`:''}${r.question&&!archived?`<p class="stage-question">${escape(r.question)}</p>`:''}`;
  }
  function renderStage(){
    const id=activeStageId,w=stageWork(id),last=w.reviews.at(-1),busy=last?.status==='pending',current=last?.status==='complete'&&last.key===stageKey(id);
    dialog.className='stage-dialog';dialog.innerHTML=dialogTop(`${escape(getBranch(id).name)} · 第 ${w.round} 轮`)+`<div class="dialog-body"><h2 id="dialog-title">这一段，走到哪里了？</h2><details class="stage-outcome"><summary>这一轮的目标</summary><textarea id="stage-outcome" class="text-field" maxlength="400" aria-label="本轮阶段目标" ${busy?'disabled':''}>${escape(w.outcome)}</textarea><button class="text-button" data-stage-command="outcome" ${busy?'disabled':''}>更新目标</button></details>${current?stageReviewHTML(last):busy?'<p class="stage-working" role="status">栖栖正在回看这一段…</p>':`<p class="stage-working" role="status">${escape(last?.error|| (last?.status==='complete'?'成果或目标有变化，重新看一次吧。':'准备好时，一起看看已有的成果。'))}</p>`}
      ${w.reviews.length?`<details class="stage-discussion"><summary>之前的讨论 · ${w.reviews.length}</summary>${w.reviews.map(r=>`<article>${r.message?`<p><small>我</small>${escape(r.message)}</p>`:''}${r.result?`<p><small>栖栖 · ${r.result.grade}</small>${escape(r.result.reason)}</p>`:`<p class="small-text">${r.status==='pending'?'正在回顾':escape(r.error||'这次讨论还没有返回')}</p>`}</article>`).join('')}</details>`:''}
      <div class="stage-reply"><textarea id="stage-message" class="text-field" maxlength="1500" aria-label="和栖栖讨论阶段" placeholder="我觉得…" ${busy?'disabled':''}>${escape(w.message||'')}</textarea><button class="secondary-button" data-stage-command="discuss" ${busy?'disabled':''}>${busy?'正在回看…':current?'继续聊聊':'请栖栖判断'}${icon('spark')}</button>${last&&['error','interrupted'].includes(last.status)?'<button class="text-button" data-stage-command="retry">重试上次讨论</button>':''}</div><div class="dialog-actions"><button class="text-button" data-modal-command="close">先到这里</button><button class="primary-button" data-stage-command="finish" ${busy?'disabled':''}>这一阶段，视作完成${icon('check')}</button></div></div>`;
    modalMode='stage';focusDialogTitle();
  }
  async function requestStage(retry=false){
    const id=activeStageId,w=stageWork(id);if(w.closedId||w.reviews.some(r=>r.status==='pending'))return;
    if(!serviceAvailable||!aiConfig.configured){toast('先在右上角连接 AI，也可以直接收尾。');return;}
    const owner=state;let review=retry?w.reviews.at(-1):null;
    if(!review){const message=w.message||'';review={id:'stage-'+uid(),key:stageKey(id),message,context:stageContext(id,message),createdAt:new Date().toISOString()};w.reviews.push(review);w.message='';}
    review.status='pending';delete review.error;save();renderStage();
    try{const out=await api('stage',{requestId:review.id,context:review.context});if(state!==owner||state.stageWork[id]!==w)return;review.status='complete';review.result=out.result;review.meta=out.meta;}
    catch(e){if(state!==owner||state.stageWork[id]!==w)return;review.status='error';review.error=e.message;}
    finally{if(state===owner&&state.stageWork[id]===w){save();if(dialog.open&&modalMode==='stage'&&activeStageId===id)renderStage();}}
  }
  function finishStage(){
    const id=activeStageId,w=stageWork(id),last=w.reviews.at(-1);const review=last?.status==='complete'&&last.key===stageKey(id)?last:null;
    const round=QibanStages.close(state,getBranch(id),{id:'round-'+uid(),at:new Date().toISOString(),review,revisionKey:stageKey(id)});persistNotice('这一阶段，已经留住。');render();openStageRound(round.id,{celebrate:true});
  }
  function stageGradeBadge(branch){
    const round=state.stageRounds.filter(r=>r.branchId===branch.id).at(-1);if(!round)return '';
    const closed=state.stageWork[branch.id]?.closedId===round.id;
    return `<span class="branch-grade" aria-label="第 ${round.round} 轮${round.grade==='—'?'尚未评级':'评级 '+escape(round.grade)}" title="第 ${round.round} 轮 · ${round.grade==='—'?'未取得 AI 评价':'AI 评价'}"><small>${closed?'本轮':'上轮'}</small><strong>${escape(round.grade)}</strong></span>`;
  }
  function completionHTML(r,recap){
    return `<section class="stage-completion" aria-label="阶段收尾纪念"><div class="completion-portrait" aria-hidden="true"><span class="completion-orbit"></span><img src="${mascot}" alt="" width="144" height="144"><span class="completion-star star-one">✧</span><span class="completion-star star-two">✦</span><span class="completion-star star-three">✧</span></div><div class="completion-kicker">${escape(r.branchName)} · 第 ${r.round} 轮</div><h2 id="dialog-title">这一段，走过了。</h2><p class="completion-companion">${recap.total?'你留下的每一版，都在这里。':'这一次的收尾，也留在这里。'}</p><div class="completion-seal" aria-label="本轮${r.grade==='—'?'未评级':'评级 '+escape(r.grade)}"><strong>${escape(r.grade)}</strong><span>${r.grade==='—'?'未评级':'本轮评级'}</span></div><div class="completion-tally">${recap.total?`<span><b>${recap.newCount}</b> ${recap.previous?'次新尝试':'次尝试'}</span><i></i><span><b>${recap.adopted.length}</b> 个行动已收尾</span>`:'<span>本轮目标与讨论已归档</span>'}</div>${recap.highlights.length?`<div class="completion-keepsakes">${recap.highlights.map(a=>`<button class="completion-keepsake" data-stage-evidence="${escape(a.id)}">${icon('check')}${escape(a.taskTitle)}</button>`).join('')}</div>`:''}<div class="completion-date">${formatDate(r.closedAt)} · 已留在足迹</div></section>`;
  }
  function openStageRound(id,{celebrate=false}={}){
    const r=state.stageRounds.find(r=>r.id===id);if(!r)return;activeStageId=r.branchId;activeTaskId=null;activeAttemptId=null;
    const next=branches[branches.findIndex(b=>b.id===r.branchId)+1],recap=QibanStages.recap(state,r);dialog.className='stage-dialog completion-dialog'+(celebrate?' celebrating':'');
    dialog.innerHTML=dialogTop('栖栖 · 陪你把这一段收好')+`<div class="dialog-body">${completionHTML(r,recap)}<div class="completion-actions">${next?`<button class="primary-button" data-stage-go="${next.id}">去 ${next.num} · ${next.name}${icon('arrow')}</button>`:''}<button class="secondary-button" data-modal-command="close">今天先到这里</button></div><details class="completion-details"><summary>回看这一轮</summary><p class="stage-closed-goal">${escape(r.outcome)}</p>${recap.comparison?`<div class="completion-comparison"><div><small>最初留下</small><p>${escape(recap.comparison.first.text)}</p></div><div><small>这次采用</small><p>${escape(recap.comparison.last.text)}</p></div></div>`:''}${r.review?stageReviewHTML(r.review,true):'<p class="small-text">本轮由你确认收尾，未取得当前 AI 评价。</p>'}<details class="stage-evidence"><summary>当时的成果 · ${r.evidence.length} 个版本</summary>${r.evidence.map(a=>`<article><button class="text-button" data-stage-evidence="${escape(a.id)}">${escape(a.taskTitle)} · ${escape(a.feedback.grade)}${a.adopted?' · 当时采用':''} ↗</button><p>${escape(a.text)}</p></article>`).join('')}</details><details class="stage-discussion"><summary>这一轮的讨论</summary>${r.discussion.map(d=>`<article>${d.message?`<p>${escape(d.message)}</p>`:''}<p>${escape(d.result?.reason||d.error||'未取得反馈')}</p></article>`).join('')}</details></details><div class="completion-extra"><button class="text-button" data-stage-replay="${escape(r.id)}">再看这一刻${icon('spark')}</button><details><summary>换个方向</summary><button class="text-button" data-stage-command="reopen">在这里开启新一轮</button>${branches.filter(b=>b.id!==r.branchId&&b.id!==next?.id).map(b=>`<button class="text-button" data-stage-go="${b.id}">${b.num} · ${b.name}</button>`).join('')}</details></div></div>`;
    openModal('stage-round');focusDialogTitle();
  }
  function renderStageRounds(){return [...state.stageRounds].reverse().map(r=>`<article class="snapshot-card"><span class="snapshot-number">${escape(r.branchName)} · 第 ${r.round} 轮 · ${escape(r.grade)}</span><h2>${escape(r.review?.result.summary||'这一轮，已经收尾')}</h2><div class="entry-info">${formatDate(r.closedAt,true)} · 本人确认收尾</div><blockquote>${escape(r.outcome)}</blockquote><button class="text-button" data-stage-round="${escape(r.id)}">回看与继续${icon('arrow')}</button></article>`).join('');}
  dialog.addEventListener('input',e=>{if(e.target.id==='stage-message'){stageWork(activeStageId).message=e.target.value;save();}});
  dialog.addEventListener('click',e=>{
    const b=e.target.closest('button');if(!b)return;
    if(b.dataset.stageReplay){openStageRound(b.dataset.stageReplay,{celebrate:true});return;}
    if(b.dataset.stageEvidence){const a=getAttempt(b.dataset.stageEvidence);if(a)openTask(a.taskId,a.id);return;}
    if(b.dataset.stageGo){QibanHome.resume(state);state.branch=b.dataset.stageGo;doneOnly=false;save();closeModal();go('now');return;}
    if(b.dataset.stageSuggestion!==undefined){const w=stageWork(activeStageId),r=w.reviews.find(r=>r.id===b.dataset.reviewId),i=Number(b.dataset.stageSuggestion),s=r?.result.suggestions[i],key=r?.id+':'+i;if(!s||w.closedId||w.addedSuggestions[key])return;const existing=allTasks().find(t=>t.branch===activeStageId&&t.title===s.title&&!state.hiddenActions[t.id]);const id=existing?.id||'custom-'+uid();if(!existing)state.customTasks.push({id,title:s.title,branch:activeStageId,kind:s.contract?.kind==='artifact'?'一份成果':'自己的一步',prompt:s.prompt,custom:true,choices:[],...(s.contract?{contract:clone(s.contract)}:{}),fromStageReview:r.id});w.addedSuggestions[key]=id;persistNotice('这一小步，已加入。');render();openTask(id);return;}
    const cmd=b.dataset.stageCommand;if(cmd==='discuss')requestStage();if(cmd==='retry')requestStage(true);if(cmd==='finish')finishStage();
    if(cmd==='outcome'){const el=dialog.querySelector('#stage-outcome'),v=el.value.trim();if(!v){el.focus();return;}stageWork(activeStageId).outcome=v;save();renderStage();}
    if(cmd==='reopen'){QibanStages.reopen(state,getBranch(activeStageId));save();render();openStage(activeStageId);}
  });

  home=QibanHomeUI.create({
    state:()=>state,tasks:allTasks,branches,escape,icon,main,dialog,dialogTop,save,render,closeModal,openLibrary:()=>go('outings'),showNow:()=>go('now'),
    openModal:mode=>{activeTaskId=null;activeAttemptId=null;dialog.className='';openModal(mode);},
    openAttempt:id=>{const a=getAttempt(id);if(a)openTask(a.taskId,a.id);},
    openTask:id=>openTask(id),openRound:id=>openStageRound(id),
    addReturnTrial:tripId=>{
      const task={id:'custom-'+uid(),branch:state.branch,title:'选一下：这次回来，感觉怎么样',kind:'一个选择',prompt:'这次回来，我觉得…',custom:true,choices:['知道上次做到哪了','看懂了，但还不想继续','还是不知道下一步做什么'],prefix:'这次回来，我觉得：',sourceTripId:tripId,contract:{kind:'decision',outcome:'留下一句这次回来的真实感受',criteria:[{label:'说出这次回来的真实感受，选一句也可以',method:'content'}]}};
      state.customTasks.push(task);return task;
    }
  });
  if(!storageFailed){QibanHome.visit(state);saveVisit();}
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'&&!storageFailed){QibanHome.touch(state);saveVisit();}});
  window.addEventListener('pagehide',()=>{if(!storageFailed){QibanHome.touch(state);saveVisit();}});
  for(const w of Object.values(state.replacements))if(w.status==='pending'){w.status='interrupted';w.error='上次的候选还没取回，可以重试。';}
  for(const w of Object.values(state.stageWork))for(const r of w.reviews)if(r.status==='pending'){r.status='interrupted';r.error='上次讨论尚未取回，可以重试。';}
  for(const attempt of state.attempts){if(attempt.aiStatus==='pending'){attempt.aiStatus='interrupted';attempt.feedback=pendingFeedback('上次的反馈还没取回，原文已经保留。');}}
  render();
  refreshAIConfig();
  if(storageFailed){document.querySelector('#saved-state').innerHTML='<i></i>本机记录读取异常';toast('本机记录未能读取。原记录尚未改动。');}
})();
