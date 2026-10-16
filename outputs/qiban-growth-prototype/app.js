(async () => {
  'use strict';
  const cloud=globalThis.QibanCloud;
  if(cloud){try{await cloud.ready;}catch{return;}}
  const storage=cloud?.storage||localStorage;
  const STATIC_PREVIEW = Boolean(document.querySelector('meta[name="qiban-static-preview"]'));
  const STORAGE_KEY = 'qiban.growth.prototype.v1';
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
    book:'<path d="M10 5q-4-3-8-1v12q4-2 8 1 4-3 8-1V4q-4-2-8 1Zm0 0v12"/>',
    chevron:'<path d="m6 8 4 4 4-4"/>',
    shuffle:'<path d="M13 3h4v4M3 17 17 3M17 13v4h-4M12 12l5 5M3 3l4 4"/>',
    up:'<path d="M10 16V4m-5 5 5-5 5 5"/>'
  };
  const icon = (name) => `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.circle}</svg>`;
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const uid = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  let branches = [
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
  const defaultBranches=JSON.parse(JSON.stringify(branches));
  const projectSeed=()=>({...freshState(),branches:defaultBranches,tasks});
  let storageFailed = false, storageReadError=false, storedRaw=null, workspace, firstRun=false;
  const SEED_GOAL='把栖伴做成完整产品并发布上线';
  // 从没用过的内置示例目标，不算用户的数据：第一次打开时换成新手引导。
  const untouchedSeed=p=>Boolean(p)&&p.goal===SEED_GOAL&&p.status==='active'&&!p.attempts.length&&!p.customTasks.length&&!p.snapshots.length&&!(p.stageRounds||[]).length&&!(p.closures||[]).length&&!Object.keys(p.hiddenActions||{}).length&&!Object.values(p.drafts||{}).some(d=>d&&(d.text||d.artifacts?.length||d.link));
  function load(){
    try{storedRaw=storage.getItem(STORAGE_KEY);workspace=QibanProjects.load(storedRaw?JSON.parse(storedRaw):null,projectSeed());firstRun=!storedRaw||(workspace.projects.length===1&&untouchedSeed(workspace.projects[0]));}
    catch{storageFailed=true;storageReadError=true;workspace=QibanProjects.load(null,projectSeed());}
    return workspace.projects.find(p=>p.id===workspace.selectedId);
  }
  let state = load();
  branches=state.branches;
  let home;
  QibanHome.ensure(state);
  try{const visit=JSON.parse(storage.getItem(VISIT_KEY)||'null');if(visit&&typeof visit==='object'&&((visit.projectId===state.id)||(!visit.projectId&&state.id==='project-original'))&&QibanHome.sameGoal(visit.goal,state.goal))state.homecoming={...state.homecoming,...visit};}catch{}
  function saveVisit(){try{storage.setItem(VISIT_KEY,JSON.stringify({projectId:state.id,...(state.homecoming||{})}));return true;}catch{return false;}}

  QibanStages.ensure(state);
  QibanActions.ensure(state);
  for(const id of Object.keys(state.drafts))state.drafts[id]=QibanRecordInput.unify(state.drafts[id]);
  const VIEWS=['now','chart','history','outings','projects'];
  const viewFromHash=()=>VIEWS.includes(location.hash.slice(1))?location.hash.slice(1):'now';
  let view = viewFromHash();
  let historyFilter = view==='outings'?'bottles':'all', doneOnly = false, activeTaskId = null, activeAttemptId = null, modalMode = null;
  let compareIds = [], helpVisible = false, opener = null, toastTimer, hold = null;
  let aiConfig={configured:false,baseUrl:'https://api.deepseek.com',model:'deepseek-flash',format:'json_object',tokenField:'max_tokens'};
  let serviceAvailable=false;
  const assistance=new Map(), feedbackRequests=new Set(), uploading=new Set();
  const main = document.querySelector('#main');
  const dialog = document.querySelector('#workspace-dialog');
  const allTasks = () => [...state.tasks,...state.customTasks];
  const getTask = id => allTasks().find(t => t.id === id);
  const getBranch = id => branches.find(b => b.id === id) || branches[0];
  const records = id => state.attempts.filter(a => a.taskId === id);
  const getAttempt = id => state.attempts.find(a => a.id === id);
  const formatDate = (iso, time=false) => {const d=new Date(iso);return `${d.getMonth()+1} 月 ${d.getDate()} 日${time ? ' · '+d.toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit',hour12:false}) : ''}`;};
  const versionNumber = attempt => records(attempt.taskId).findIndex(a=>a.id===attempt.id)+1;
  function save(){
    if(cloud?.isLocked?.())return false;
    if(firstRun)return true;
    try {persistWorkspace(workspace);saveVisit();storageFailed=false;} catch {storageFailed=true;}
    document.querySelector('#saved-state').innerHTML = `<i></i>${storageFailed?'本次尚未保存':cloud?'正在同步':'已在本机保存'}`;
    document.querySelector('#saved-state').title=storageFailed?'浏览器存储不可用，请导出历程保留本次记录。':'记录只保存在当前浏览器';
    cloud?.renderStatus();
    return !storageFailed;
  }
  function toast(message){if(cloud?.isLocked?.())return;clearTimeout(toastTimer);const el=document.querySelector('#toast');if(!el)return;el.textContent=message;el.classList.add('visible');toastTimer=setTimeout(()=>el.classList.remove('visible'),2800);}
  function persistNotice(message){toast(save()?message:'本次未能保存，请先导出历程。');}
  function setView(next){view=VIEWS.includes(next)?next:'now';if(view==='outings')historyFilter='bottles';else if(view==='history'&&historyFilter==='bottles')historyFilter='all';}
  function go(next){setView(next);location.hash=view;render();window.scrollTo({top:0,behavior:'instant'});}
  function render(){
    cancelHold();
    if(cloud?.isLocked?.())return;
    document.documentElement?.classList?.toggle?.('first-run',firstRun);
    const navView=view==='outings'?'history':view;
    document.querySelectorAll('[data-view]').forEach(btn=>{const selected=btn.dataset.view===navView;btn.classList.toggle('active',selected);if(selected)btn.setAttribute('aria-current','page');else btn.removeAttribute('aria-current');});
    document.querySelector('#history-dot').hidden=firstRun||!(state.attempts.length||state.stageRounds.length)||navView==='history';
    document.querySelector('#footer-note').textContent=firstRun?'先选一座想去的岛':state.attempts.length?`${state.attempts.length} 条日志 · ${Object.keys(state.accepted).length} 程写进航线`:'从一座想去的岛开始';
    if(firstRun){renderOnboarding();return;}
    if(view==='projects')renderProjects();else if(view==='history'||view==='outings')renderHistory();else if(isArchived())renderArchived();else if(view==='chart')renderChart();else renderNow();
  }
  function breathingMascot(){
    // Reuse the original illustration in two complementary regions: the book stays still.
    const silhouette='M 421 925 C 433 897 447 881 453 859 C 442 827 444 796 454 764 C 464 661 508 563 566 505 C 609 460 666 426 728 408 C 731 338 758 243 821 186 C 867 143 928 125 972 155 C 1015 188 986 261 951 312 C 932 341 907 370 884 396 C 945 331 1035 264 1103 268 C 1170 269 1207 307 1205 353 C 1201 408 1141 463 1069 497 C 1113 581 1140 692 1145 788 L 1153 902 C 1183 905 1217 928 1220 967 C 1224 1014 1199 1050 1158 1063 C 1151 1091 1125 1117 1077 1122 C 1032 1148 975 1142 932 1128 C 838 1135 767 1128 703 1119 C 626 1121 557 1118 504 1106 C 461 1112 422 1087 421 1047 C 416 1008 420 960 421 925 Z';
    return `<svg class="breathing-portrait" viewBox="0 0 1254 1254" width="224" height="224" role="img" aria-label="安静呼吸的栖栖兔子，抱着月亮坐在书旁"><defs><clipPath id="qixi-rabbit-region"><path d="${silhouette}"/></clipPath><mask id="qixi-still-scene" x="0" y="0" width="1254" height="1254" maskUnits="userSpaceOnUse" style="mask-type:luminance"><rect width="1254" height="1254" fill="white"/><path d="${silhouette}" fill="black"/></mask></defs><image href="${mascot}" width="1254" height="1254" mask="url(#qixi-still-scene)"/><g class="qixi-breath"><image href="${mascot}" width="1254" height="1254" clip-path="url(#qixi-rabbit-region)"/></g></svg>`;
  }
  const WEEK='日一二三四五六';
  function timeLabel(d=new Date()){const h=d.getHours();const part=h<5?'深夜':h<9?'清晨':h<12?'上午':h<14?'中午':h<18?'午后':h<23?'夜':'深夜';return `${d.getMonth()+1}.${String(d.getDate()).padStart(2,'0')} 周${WEEK[d.getDay()]} · ${part}`;}
  // 进度按航程算：过了浮标的航程算满，没过的按写进航线的程数。
  function legFraction(p,b){
    const w=p.stageWork?.[b.id];if(w?.closedId)return 1;
    const ts=[...p.tasks,...p.customTasks].filter(t=>t.branch===b.id&&!p.hiddenActions?.[t.id]);if(!ts.length)return 0;
    const adopted=ts.filter(t=>p.accepted[t.id]).length,tried=ts.filter(t=>!p.accepted[t.id]&&p.attempts.some(a=>a.taskId===t.id)).length;
    return Math.min(0.95,(adopted+0.35*tried)/ts.length);
  }
  function projectProgress(p=state){if(p.status==='completed')return 1;const bs=p.branches||[];if(!bs.length)return 0;return bs.reduce((sum,b)=>sum+legFraction(p,b),0)/bs.length;}
  const aiAvailable=()=>!STATIC_PREVIEW&&serviceAvailable&&Boolean(aiConfig.configured);
  let stepShift=0,lastSail={id:null,f:0},launching=false;
  function featuredTask(branch){
    const ts=allTasks().filter(t=>t.branch===branch.id&&!state.hiddenActions[t.id]&&!state.accepted[t.id]);if(!ts.length)return null;
    const drafts=ts.filter(t=>hasDraft(state.drafts[t.id])),pool=drafts.length&&!stepShift?drafts:ts;
    return pool[((stepShift%pool.length)+pool.length)%pool.length];
  }
  const anchorIcon='<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="10" cy="4.5" r="1.8"/><path d="M10 6.3V17M6.5 9h7M3.5 12.5q1 4.5 6.5 4.5t6.5-4.5"/></svg>';
  function stepHTML(branch,featured){
    const w=stageWork(branch.id),i=branches.indexOf(branch),next=branches[i+1];
    if(!featured){
      const empty=!w.closedId&&!allTasks().some(t=>t.branch===branch.id&&!state.hiddenActions[t.id]);
      const title=w.closedId?'这个浮标，已经过了。':empty?'这段航程，还没有安排。':'这段航程的每一程，都走过了。';
      const lead=w.closedId?(next?`下一段航程是「${escape(next.name)}」。`:'岛就在前面了。'):empty?'加一件今天就能做完的小事。':'回头看看这一段，觉得可以了，就过这个浮标。';
      const primary=w.closedId?(next?`<button class="primary-button" data-branch="${escape(next.id)}">驶向第 ${i+2} 段航程${icon('arrow')}</button>`:''):empty?`<button class="primary-button" data-command="add-action">${icon('plus')}加一程</button>`:`<button class="primary-button" data-command="stage-review">过这个浮标${icon('arrow')}</button>`;
      return `<section class="one-step step-clear" aria-labelledby="step-title"><span class="step-label">第 ${i+1} 段航程 · ${escape(branch.name)}</span><h1 id="step-title" tabindex="-1">${title}</h1><p class="step-prompt">${lead}</p><div class="step-actions">${primary}${empty?'':`<button class="text-button" data-command="add-action">${icon('plus')}再加一程</button>`}</div></section>`;
    }
    const list=records(featured.id),draft=hasDraft(state.drafts[featured.id]),outcome=contractFor(featured).outcome,others=allTasks().filter(t=>t.branch===branch.id&&!state.hiddenActions[t.id]&&!state.accepted[t.id]).length;
    const prompt=featured.prompt&&!/^这一次，我(留下|做了)…$/.test(featured.prompt)?featured.prompt:'';
    return `<section class="one-step" aria-labelledby="step-title"><span class="step-label">今天这一程${draft?' · 有没写完的日志':list.length?` · 记过 ${list.length} 条`:''}</span><h1 id="step-title" tabindex="-1">${escape(featured.title)}</h1>${prompt?`<p class="step-prompt">${escape(prompt)}</p>`:''}${outcome&&outcome!==featured.title?`<p class="step-enough"><span>做到这样就够了</span>${escape(outcome)}</p>`:''}
      <button class="sail-button" id="sail-button" type="button" data-sail-task="${escape(featured.id)}" aria-describedby="sea-hint"><span class="sail-fill" aria-hidden="true"></span><span class="sail-label">按住帆绳，扬帆</span></button>
      <p class="sea-hint" id="sea-hint" tabindex="-1" aria-live="polite">做完了，就按住帆绳。船会往前走一点。</p>
      <div class="step-actions"><button class="text-button" data-open-task="${escape(featured.id)}" data-compose="true">${icon('pen')}${draft?'接着写日志':'写几句再扬帆'}</button>${others>1?`<button class="text-button step-shuffle" data-command="shuffle-step">${icon('shuffle')}换一程</button>`:''}<button class="text-button" data-home-command="rest">${anchorIcon}今天先下锚</button></div></section>`;
  }
  function anchoredHTML(){return `<section class="one-step step-anchored" aria-labelledby="step-title"><span class="step-label">下锚中</span><h1 id="step-title" tabindex="-1">今天先歇一歇。</h1><p class="step-prompt">船会一直停在这儿等你，不会漂走，也不会算你落后。</p><p class="sea-hint" id="sea-hint" tabindex="-1" aria-live="polite"></p><div class="step-actions"><button class="primary-button" data-home-command="actions">起锚，继续航行${icon('arrow')}</button></div></section>`;}
  function renderNow(){
    cancelHold();
    if(isArchived()){renderArchived();return;}
    const branch=getBranch(state.branch),bi=branches.indexOf(branch),featured=featuredTask(branch),f=projectProgress(state),quiet=Date.parse(state.homecoming?.quietUntil)>Date.now();
    const sailed=lastSail.id===state.id&&f>lastSail.f+0.001;lastSail={id:state.id,f};
    const seen=QibanVoyage.visibility(f);
    main.innerHTML=`<section class="sea-stage${sailed?' sailed':''}${launching?' launching':''}" aria-label="海上"><div class="sea-meta"><span class="sea-date">${timeLabel()}</span><button class="goal-chip" data-command="projects" aria-label="正在驶向：${escape(state.goal)}。看看我的群岛"><small>驶向</small><span>${escape(state.goal)}</span>${icon('chevron')}</button></div>
      <div class="sea-view">${QibanVoyage.scene({progress:f,seed:state.id,anchored:quiet,label:`小船正驶向「${escape(state.goal)}」，${seen}`})}</div>
      <div class="sea-status"><button class="sea-leg" data-command="chart" aria-label="第 ${bi+1} 段航程，共 ${branches.length} 段，${escape(branch.name)}。打开海图"><b>第 ${bi+1} 段航程</b><span>共 ${branches.length} 段 · ${escape(branch.name)}</span></button><span class="sea-fog">${seen}</span></div></section>
      ${quiet?anchoredHTML():stepHTML(branch,featured)}
      ${projectBanner()}
      ${home.homeHTML()}`;
    launching=false;
  }
  function stepRow(t){const acc=state.accepted[t.id],n=records(t.id).length,draft=hasDraft(state.drafts[t.id]);return `<button class="step-row${acc?' done':''}" data-open-task="${escape(t.id)}"><span class="step-check" aria-hidden="true">${acc?icon('check'):''}</span><span class="step-row-copy"><b>${escape(t.title)}</b><small>${acc?'写进航线':draft?'有没写完的日志':n?`记过 ${n} 条`:'还没走'}</small></span>${icon('arrow')}</button>`;}
  function legHTML(b,i,selected){
    const w=stageWork(b.id),ts=allTasks().filter(t=>t.branch===b.id&&!state.hiddenActions[t.id]),done=ts.filter(t=>state.accepted[t.id]).length,closed=Boolean(w.closedId);
    return `<li class="chart-leg${selected?' selected':''}${closed?' passed':''}"><span class="leg-marker">${QibanVoyage.buoy({passed:closed,current:selected})}</span><div class="leg-body"><button class="leg-head" data-branch="${escape(b.id)}" aria-expanded="${selected}"><small>第 ${i+1} 段航程${closed?' · 已过浮标':selected?' · 船在这里':''}</small><h2>${escape(b.name)}</h2><span class="leg-count">${ts.length?`${done} / ${ts.length} 程`:'还没安排'}${stageGradeBadge(b)}</span></button>${selected?`<div class="leg-steps">${b.outcome&&b.outcome!==b.name?`<p class="leg-outcome">${escape(b.outcome)}</p>`:''}${ts.map(stepRow).join('')||'<p class="small-text">这段航程还没有安排，加一程吧。</p>'}<div class="leg-tools"><button class="text-button" data-command="add-action">${icon('plus')}加一程</button><button class="text-button" data-command="rename-leg">${icon('pen')}改航程</button><button class="${!closed&&ts.length&&done===ts.length?'secondary-button':'text-button'}" data-command="stage-review">${closed?'回看这个浮标':'过这个浮标'}${icon('arrow')}</button></div>${hiddenActionsHTML(b.id)}</div>`:''}</div></li>`;
  }
  function renderChart(){
    const cur=getBranch(state.branch),f=projectProgress(state),r=QibanProjects.stats(state);
    main.innerHTML=`<section class="page-hero chart-hero"><div><div class="eyebrow">海图</div><h1>${escape(state.goal)}</h1><p class="history-goal">过了 ${r.closed} / ${r.total} 个浮标 · ${QibanVoyage.visibility(f)}</p></div><button class="secondary-button" data-command="edit-goal">${icon('pen')}改改这座岛</button></section>
      <ol class="chart-route" aria-label="航线">${branches.map((b,i)=>legHTML(b,i,b.id===cur.id)).join('')}<li class="chart-leg chart-island"><span class="leg-marker">${QibanVoyage.island({seed:state.id,size:46,flag:false,fog:Math.max(0,0.85-f)})}</span><div class="leg-body"><h2>${escape(state.goal)}</h2><p class="small-text">${r.ready?'每个浮标都过了，可以靠岸了。':'只要你觉得已经到了，也可以提前靠岸。'}</p><button class="${r.ready?'primary-button':'text-button'}" data-project-command="archive">准备靠岸${icon('arrow')}</button></div></li></ol>
      ${branches.length<6?`<div class="chart-add"><button class="text-button" data-command="add-leg">${icon('plus')}加一段航程</button></div>`:''}`;
  }
  const dayKey=iso=>{const d=new Date(iso);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
  const MONTHS=['一月','二月','三月','四月','五月','六月','七月','八月','九月','十月','十一月','十二月'];
  function calendarHTML(now=new Date()){
    const y=now.getFullYear(),m=now.getMonth(),days=new Date(y,m+1,0).getDate(),lead=(new Date(y,m,1).getDay()+6)%7,today=now.getDate();
    const counts={};for(const a of state.attempts){const d=new Date(a.createdAt);if(d.getFullYear()===y&&d.getMonth()===m)counts[d.getDate()]=(counts[d.getDate()]||0)+1;}
    const total=Object.values(counts).reduce((x,n)=>x+n,0),cells=[];
    for(let i=0;i<lead;i++)cells.push('<span class="cal-cell" aria-hidden="true"></span>');
    for(let d=1;d<=days;d++){const n=counts[d]||0,key=`${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`,size=n>=3?13:n===2?9:n?6:0,cls=`cal-cell${d===today?' today':''}${d>today?' future':''}${n?' has':''}`;
      cells.push(n?`<button class="${cls}" data-calendar-day="${key}" aria-label="${m+1} 月 ${d} 日，记下 ${n} 条日志"><span>${d}</span><i style="--dot:${size}px"></i></button>`:`<span class="${cls}"${d===today?' aria-label="今天"':''}><span>${d}</span><i style="--dot:${size}px"></i></span>`);}
    return `<section class="moon-calendar" aria-label="${MONTHS[m]}的航迹"><div class="cal-head"><h2>${MONTHS[m]}</h2><span>${y}</span></div><p class="cal-sub">${total?`这个月记下 ${total} 条日志。`:'这个月还没有日志。船不会因此漂远。'}</p><div class="cal-week" aria-hidden="true">${'一二三四五六日'.split('').map(w=>`<span>${w}</span>`).join('')}</div><div class="cal-grid">${cells.join('')}</div></section>`;
  }
  function renderHistory(){
    const tabs=[['all','全部日志'],['adopted','写进航线的'],['snapshots','浮标与纪念'],['bottles','漂流瓶']];
    const history=historyFilter==='adopted'?state.attempts.filter(a=>state.accepted[a.taskId]===a.id):state.attempts;
    const marks=state.snapshots.length+state.stageRounds.length;
    const body=historyFilter==='bottles'?(isArchived()?'<div class="history-empty"><h2>这座岛已经靠岸了。</h2><p class="small-text">漂流瓶只漂向还在航行的岛。</p></div>':home.libraryHTML()):historyFilter==='snapshots'?renderSnapshots():history.length?[...history].reverse().map(historyEntry).join(''):emptyHistory(historyFilter);
    main.innerHTML=`<section class="page-hero history-hero"><div><div class="eyebrow">航海日志</div><h1>每一程，都记在这里。</h1><p class="history-goal">${escape(state.goal)}${isArchived()?(state.status==='completed'?' · 已登岛':' · 下锚中'):''}</p><div class="pill-stat">${state.attempts.length?`${state.attempts.length} 条日志 · ${Object.keys(state.accepted).length} 程写进航线`:'第一条日志，可以很短'}</div></div><button class="secondary-button" data-command="snapshot" ${isArchived()||!state.attempts.length?'disabled':''}>${icon('book')}留一张纪念</button></section>
      ${state.closures.length?`<details class="project-past-closures"><summary>靠岸记录 · ${state.closures.length}</summary>${state.closures.map(c=>`<article><strong>${c.status==='completed'?'登岛':'下锚'} · ${formatDate(c.at)}</strong><p>${escape(c.note||c.goal)}</p><small>当时记下 ${c.stats.attempts} 条日志 · 过了 ${c.stats.closed} / ${c.stats.total} 个浮标</small></article>`).join('')}</details>`:''}
      <div class="history-tabs" role="group" aria-label="日志筛选">${tabs.map(([id,label])=>`<button class="history-tab ${historyFilter===id?'active':''}" data-history-filter="${id}" aria-pressed="${historyFilter===id}">${label}${id==='snapshots'&&marks?' · '+marks:''}</button>`).join('')}</div>
      ${historyFilter==='bottles'?`<div class="bottle-shelf">${body}</div>`:`<div class="history-layout"><aside class="history-aside">${calendarHTML()}<div class="aside-goal"><div class="aside-label">这座岛</div><h2>${escape(state.goal)}</h2><div class="baseline-item"><small>做到什么程度就算登岛</small>${escape(state.scope||'还没写，想到了随时补上。')}</div></div></aside><section class="history-main"><div class="history-list" aria-label="航海日志">${body}</div></section></div>`}`;
  }
  function emptyHistory(filter){return `<div class="history-empty"><div class="empty-ornament">${filter==='snapshots'?QibanVoyage.buoy({size:34}):'~'}</div><h2>${filter==='adopted'?'还没有写进航线的。':filter==='snapshots'?'过了浮标，会记在这里。':'第一条日志，可以很短。'}</h2><button class="text-button" data-command="${filter==='snapshots'&&state.attempts.length?'snapshot':'now'}">${filter==='snapshots'&&state.attempts.length?'留一张纪念':'回到海上'}${icon('arrow')}</button></div>`;}
  const legName=id=>branches.find(b=>b.id===id)?.name||'';
  function historyEntry(attempt){const adopted=state.accepted[attempt.taskId]===attempt.id,n=records(attempt.taskId).length,graded=attempt.aiStatus==='complete'&&attempt.feedback?.grade&&attempt.feedback.grade!=='—';return `<article class="history-entry${attempt.text?'':' quiet-entry'}" data-day="${dayKey(attempt.createdAt)}"><div class="entry-top"><div><h2>${escape(attempt.taskTitle)}</h2><div class="entry-info"><span>${formatDate(attempt.createdAt,true)}</span>${legName(attempt.branch)?`<span>${escape(legName(attempt.branch))}</span>`:''}${attempt.provenance&&!['扬帆完成','自己写下'].includes(attempt.provenance)?`<span>${escape(attempt.provenance)}</span>`:''}</div></div>${adopted?'<span class="route-stamp">写进航线</span>':''}</div><p class="entry-body">${attempt.text?escape(attempt.text):'走完了这一程，没写日志。'}</p>${attempt.artifacts?.length?`<div class="history-artifacts">${attempt.artifacts.map(a=>escape(a.name)).join(" · ")}</div>`:""}<div class="entry-bottom">${graded?`<span class="entry-grade" title="栖栖的评价">${escape(attempt.feedback.grade)}</span>`:'<span></span>'}<button class="text-button" data-open-attempt="${escape(attempt.id)}">${n>1?`翻开 · 这一程共 ${n} 条`:'翻开这一条'}${icon('arrow')}</button></div></article>`;}
  function renderSnapshots(){return renderStageRounds()+(state.snapshots.length?[...state.snapshots].reverse().map((snap,i)=>`<article class="snapshot-card"><span class="snapshot-number">纪念 ${String(state.snapshots.length-i).padStart(2,'0')}</span><h2>${escape(snap.title)}</h2><div class="entry-info">${formatDate(snap.createdAt,true)} · ${escape(snap.branchName)}</div><blockquote>${escape(snap.note || '这段时间的每一条日志，都夹在这里。')}</blockquote><div class="snapshot-evidence">${snap.evidence.map(e=>`<span>${escape(e.title)}${e.adopted?' · 写进航线':''}</span>`).join('')}</div><button class="text-button" data-open-snapshot="${escape(snap.id)}">展开这一页${icon('arrow')}</button></article>`).join(''):state.stageRounds.length?'':emptyHistory('snapshots'));}
  function focusDialogTitle(){const title=dialog.querySelector('#dialog-title');if(title){title.tabIndex=-1;title.focus({preventScroll:true});}}
  const formFields=new Set(['custom-title','custom-kind','custom-prompt','goal-input','scope-input','snapshot-title','snapshot-note','project-note','new-project-goal','new-project-scope','new-project-first','contract-outcome','contract-kind','stage-outcome','island-name','leg-name','leg-outcome']);
  let formKey=null;
  function formIdentity(mode){if(mode==='new-project')return 'new-project';if(mode==='contract'||mode==='compose')return state.id+':'+mode+':'+activeTaskId;if(mode==='stage')return state.id+':stage:'+activeStageId+':'+stageWork(activeStageId).round;return state.id+':'+mode;}
  function rememberNewProject(){if(!cloud)return;const d=newProjectDraft;cloud.setForm('new-project',{fields:{'new-project-goal':d.goal,'new-project-scope':d.scope,'new-project-first':d.first},plan:d.plan?clone(d.plan):null,legs:[...d.legs]});}
  function rememberForm(){
    if(!cloud||!formKey)return;if(modalMode==='new-project'){rememberNewProject();return;}
    const fields={};for(const el of dialog.querySelectorAll('input[id],textarea[id],select[id]'))if(formFields.has(el.id))fields[el.id]=el.value;
    const criteria=modalMode==='contract'?[...dialog.querySelectorAll('[data-criterion-label]')].map(el=>({label:el.value,method:dialog.querySelector(`[data-criterion-method="${el.dataset.criterionLabel}"]`).value})):null;
    if(Object.keys(fields).length||criteria)cloud.setForm(formKey,{fields,...(criteria?{criteria}:{})});
  }
  function restoreForm(mode){
    formKey=formIdentity(mode);const record=cloud?.getForm(formKey);if(!record)return;
    for(const [id,value]of Object.entries(record.fields||record)){const el=dialog.querySelector('#'+id);if(el&&formFields.has(id)&&typeof value==='string')el.value=value;}
    if(mode==='contract'&&Array.isArray(record.criteria))for(const [i,c]of record.criteria.slice(0,3).entries()){
      const label=dialog.querySelector(`[data-criterion-label="${i}"]`),method=dialog.querySelector(`[data-criterion-method="${i}"]`);
      if(label&&typeof c.label==='string')label.value=c.label;if(method&&['content','experience'].includes(c.method))method.value=c.method;
    }
  }
  function clearForm(){if(formKey)cloud?.clearForm(formKey);formKey=null;}
  function openModal(mode){cancelHold();restoreForm(mode);opener=dialog.open?opener:document.activeElement;modalMode=mode;if(!dialog.open)dialog.showModal();dialog.scrollTop=0;}
  function closeModal(){const returnTask=activeTaskId;dialog.close();dialog.className='';activeTaskId=null;activeAttemptId=null;modalMode=null;formKey=null;helpVisible=false;render();if(opener?.isConnected)opener.focus();else (returnTask?document.querySelector(`[data-open-task="${returnTask}"]`):null)?.focus();}
  const dialogTop=label=>`<div class="dialog-top"><div class="breadcrumb">${label}</div><button class="icon-button" data-modal-command="close" aria-label="关闭">${icon('close')}</button></div>`;
  function openTask(id,attemptId=null,{compose=false}={}){const task=getTask(id);if(!task||cloud?.isLocked?.())return;activeTaskId=id;helpVisible=false;activeAttemptId=attemptId;const list=records(id);if(!compose&&!attemptId&&!hasDraft(state.drafts[id])&&list.length)activeAttemptId=state.accepted[id]||list.at(-1).id;renderTaskDialog();openModal(activeAttemptId?'feedback':'compose');}
  function versionStrip(task){const list=records(task.id);if(list.length<2&&!(list.length&&!activeAttemptId))return '';return `<div class="attempt-strip" aria-label="这一程的日志">${list.map((a,i)=>`<button class="version-pill ${a.id===activeAttemptId?'active':''}" data-version="${escape(a.id)}" aria-label="第 ${i+1} 条">${i+1}${a.aiStatus==='complete'&&a.feedback.grade!=='—'?`<span>${escape(a.feedback.grade)}</span>`:''}${state.accepted[task.id]===a.id?icon('check'):''}</button>`).join('')}${!activeAttemptId?'<span class="version-pill active">新的一条</span>':hasDraft(state.drafts[task.id])?'<button class="version-pill" data-modal-command="resume-draft">草稿</button>':''}${list.length>1?`<button class="text-button compare-link" data-modal-command="compare">${icon('compare')}对比两条</button>`:''}</div>`;}
  function renderTaskDialog(){if(isArchived()){renderArchivedAttempt();return;}const task=getTask(activeTaskId);if(!task)return;dialog.className='';const attempt=getAttempt(activeAttemptId);const branch=getBranch(task.branch);dialog.innerHTML=dialogTop(`${escape(branch.name)}<span class="slash">/</span>这一程`)+`<div class="dialog-body"><h2 id="dialog-title">${escape(attempt?.taskTitle||task.title)}</h2>${actionOptions(task)}${versionStrip(task)}${attempt?feedbackHTML(attempt,task):composerHTML(task)}</div>`;modalMode=attempt?'feedback':'compose';restoreForm(modalMode);loadImagePreviews();if(dialog.open)focusDialogTitle();}
  function renderArchivedAttempt(){
    const task=getTask(activeTaskId),list=records(activeTaskId),a=getAttempt(activeAttemptId)||list.at(-1);if(!a)return;
    activeAttemptId=a.id;dialog.className='';dialog.innerHTML=dialogTop('已靠岸 · 航海日志')+`<div class="dialog-body"><h2 id="dialog-title">${escape(a.taskTitle)}</h2><div class="attempt-strip">${list.map((v,i)=>`<button class="version-pill ${v.id===a.id?'active':''}" data-version="${escape(v.id)}">第 ${i+1} 条</button>`).join('')}</div><div class="feedback-title">${escape(a.feedback.title||'当时留下的')}</div><blockquote class="submission-quote">${escape(a.text||'走完了这一程，没写日志。')}</blockquote>${evidenceHTML(a)}<p class="small-text">${escape(a.feedback.strength||'')}</p>${a.feedback.checks?.length?`<details class="rubric"><summary>当时的标尺</summary><ul>${a.feedback.checks.map(c=>`<li>${escape(c.label)} · ${c.pass?'已满足':'还未满足'}${c.evidence?`<span>${escape(c.evidence)}</span>`:''}</li>`).join('')}</ul></details>`:''}${a.feedback.comparison?`<p class="ai-comparison">${escape(a.feedback.comparison)}</p>`:''}${a.feedback.hint?`<p class="ai-comparison">当时的建议：${escape(a.feedback.hint)}</p>`:''}<div class="dialog-actions">${a.aiStatus==='complete'?`<span class="entry-grade">${escape(a.feedback.grade)}</span>`:'<span></span>'}<button class="secondary-button" data-modal-command="close">合上</button></div></div>`;modalMode='feedback';loadImagePreviews();
  }
  function isArchived(){return state.status!=='active';}
  function projectBusy(){return feedbackRequests.size||uploading.size||[...assistance.values()].some(x=>x.status==='pending')||Object.values(state.stageWork).some(w=>w.reviews?.some(r=>r.status==='pending'))||Object.values(state.replacements||{}).some(w=>w.status==='pending');}
  function persistWorkspace(next){
    if(storageReadError)throw Error('旧记录未能读取，请先导出原始记录，暂不覆盖。');
    if(storage.getItem(STORAGE_KEY)!==storedRaw)throw Error('另一个页面更新了记录，请刷新后再继续。');
    if(storedRaw&&JSON.parse(storedRaw).schema===1&&!storage.getItem(STORAGE_KEY+'.before-projects'))storage.setItem(STORAGE_KEY+'.before-projects',storedRaw);
    const raw=JSON.stringify(next);storage.setItem(STORAGE_KEY,raw);storedRaw=raw;
  }
  function prepareProject(){
    branches=state.branches;QibanStages.ensure(state);QibanActions.ensure(state);QibanHome.ensure(state);
    for(const id of Object.keys(state.drafts))state.drafts[id]=QibanRecordInput.unify(state.drafts[id]);
  }
  function commitProjects(change){
    if(projectBusy()){toast('栖栖还在处理这次记录，等它结束就可以。');return false;}
    try{
      const next=clone(workspace);change(next);persistWorkspace(next);workspace=next;state=workspace.projects.find(p=>p.id===workspace.selectedId);prepareProject();
      assistance.clear();doneOnly=false;historyFilter='all';activeTaskId=null;activeAttemptId=null;activeStageId=null;compareIds=[];storageFailed=false;return true;
    }catch(e){toast('没有改动目标：'+e.message);return false;}
  }
  function switchProject(id){
    if(!workspace.projects.some(p=>p.id===id))return;
    if(!commitProjects(w=>{w.selectedId=id;}))return;
    if(dialog.open)closeModal();if(!isArchived()){QibanHome.visit(state);saveVisit();}go('now');
  }
  function projectStatsHTML(p){const r=QibanProjects.stats(p);return `<div class="project-stats"><span><b>${r.closed}/${r.total}</b> 个浮标</span><span><b>${r.attempts}</b> 条日志</span><span><b>${r.adopted}</b> 程写进航线</span></div>`;}
  function projectBanner(){
    const r=QibanProjects.stats(state),ready=r.ready,atEnd=state.branch===branches.at(-1).id&&state.stageWork[state.branch]?.closedId;
    return ready||atEnd?`<section class="project-finish-banner"><div><h2>${ready?'岛就在眼前了。':'走到这里，是不是已经到了？'}</h2><p>${ready?'每个浮标都过了，可以靠岸了。':`已经过了 ${r.closed} / ${r.total} 个浮标。`}</p></div><button class="primary-button" data-project-command="archive">准备靠岸${icon('arrow')}</button></section>`:'';
  }
  const isleName=p=>p.islandName||QibanVoyage.islandName(p.goal);
  function isleCard(p){
    const done=p.status==='completed',f=projectProgress(p),note=p.closures?.at(-1)?.note,current=p.id===state.id;
    const label=done?`${isleName(p)}，${formatDate(p.archivedAt)} 登岛`:`${p.goal}，${p.status==='active'?'航行中':'下锚中'}`;
    return `<article class="isle-card ${p.status}${current?' current':''}"><div class="isle-art">${QibanVoyage.island({seed:p.id,size:108,flag:done,fog:done?0:Math.max(0.2,0.85-f),label:escape(label)})}</div><div class="isle-copy"><small>${done?formatDate(p.archivedAt)+' 登岛':p.status==='active'?(current?'船在这里 · 航行中':'航行中'):'下锚中'}</small><h3>${escape(done?isleName(p):p.goal)}</h3>${done?`<p class="isle-goal">${escape(p.goal)}</p>`:''}${projectStatsHTML(p)}${note?`<p class="project-note">${escape(note)}</p>`:''}<button class="text-button" data-project-open="${escape(p.id)}">${done?'上岛看看':p.status==='active'?(current?'回到船上':'驶过去'):'去看看'}${icon('arrow')}</button></div></article>`;
  }
  function renderProjects(){
    const all=workspace.projects,done=all.filter(p=>p.status==='completed').length,sailing=all.filter(p=>p.status==='active').length;
    const order=[...all.filter(p=>p.status==='active'),...all.filter(p=>p.status==='shelved'),...all.filter(p=>p.status==='completed').reverse()];
    main.innerHTML=`<section class="page-hero isles-hero"><div><div class="eyebrow">群岛</div><h1>我的群岛</h1><p class="history-goal">${done?`登上过 ${done} 座岛`:'还没有登上过岛'}${sailing?` · 正在驶向 ${sailing} 座`:''}</p></div><button class="primary-button" data-project-command="new">驶向一座新岛${icon('plus')}</button></section><div class="isles-sea">${order.map(isleCard).join('')}</div><div class="project-library-footer"><button class="text-button" data-project-command="export-all">导出所有航海日志${icon('book')}</button></div>`;
  }
  const shellIcon='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4c-5 0-8 4-8 8.5 0 2 1 3.5 2.5 4.5L12 20l5.5-3c1.5-1 2.5-2.5 2.5-4.5C20 8 17 4 12 4Z"/><path d="M12 5v14M8 6.5l2 12M16 6.5l-2 12"/></svg>';
  function renderArchived(){
    const receipt=state.closures.at(-1),r=QibanProjects.stats(state),done=state.status==='completed',first=state.attempts[0],last=state.attempts.at(-1),shells=state.attempts.filter(a=>state.accepted[a.taskId]===a.id);
    main.innerHTML=`<section class="landing-hero${done?'':' shelved'}"><div class="landing-art">${done?QibanVoyage.island({seed:state.id,size:210,flag:true,label:escape(isleName(state))}):QibanVoyage.scene({progress:projectProgress(state),seed:state.id,anchored:true,label:'下锚中的小船'})}</div><small>${done?'登岛':'下锚'} · ${formatDate(receipt.at)}</small><h1>${escape(done?isleName(state):state.goal)}</h1>${done?`<p class="landing-goal">${escape(state.goal)}</p>`:''}<p>${escape(receipt.note||(done?'这件事，你做到了。':'船先停在这里，想继续时再起锚。'))}</p>${projectStatsHTML(state)}<div class="completion-actions"><button class="primary-button" data-project-command="new">驶向一座新岛${icon('arrow')}</button><button class="secondary-button" data-command="history">翻翻航海日志</button></div></section>
      <section class="landing-marks"><h2>${done?'岛上的地标':'走过的航程'}</h2>${r.milestones.map((b,i)=>`<div class="landing-mark"><span class="mark-name">${done?QibanVoyage.landmark(i,r.milestones.length):'第 '+(i+1)+' 段'}</span><span class="mark-leg">${escape(b.name)}</span>${b.closedId?`<button class="text-button" data-stage-round="${escape(b.closedId)}">回看 ↗</button>`:'<small>没过浮标</small>'}</div>`).join('')}</section>
      ${shells.length?`<section class="landing-shells"><h2>${done?'沙滩上的贝壳':'写进航线的'}<span>${shells.length}</span></h2><div class="shell-list">${shells.slice(-12).map(a=>`<button class="shell" data-open-attempt="${escape(a.id)}">${shellIcon}<span>${escape(a.taskTitle)}</span></button>`).join('')}</div></section>`:''}
      ${first&&last&&first.id!==last.id&&first.text&&last.text?`<div class="completion-comparison project-comparison"><div><small>第一条日志</small><p>${escape(first.text)}</p><button class="text-button" data-open-attempt="${escape(first.id)}">翻开 ↗</button></div><div><small>最后一条日志</small><p>${escape(last.text)}</p><button class="text-button" data-open-attempt="${escape(last.id)}">翻开 ↗</button></div></div>`:''}<div class="project-library-footer"><button class="text-button" data-project-command="reopen">${done?'重新起航':'起锚，继续航行'}</button><button class="text-button" data-command="export">导出这段航海日志</button><button class="text-button" data-project-command="list">我的群岛</button></div>`;
  }
  function openArchiveProject(){
    if(isArchived()){if(dialog.open)closeModal();go('now');return;}
    if(projectBusy()){toast('等这次记录处理完，就可以靠岸。');return;}
    const r=QibanProjects.stats(state);dialog.className='project-dialog landing-dialog';
    dialog.innerHTML=dialogTop('准备靠岸')+`<div class="dialog-body"><div class="landing-preview">${QibanVoyage.island({seed:state.id,size:150,flag:true})}</div><h2 id="dialog-title">岛就在眼前了。</h2><p class="project-goal-label">${escape(state.goal)}</p><ol class="landing-legs">${r.milestones.map((b,i)=>`<li><b>${QibanVoyage.landmark(i,r.milestones.length)}</b><span>${escape(b.name)}</span><small>${b.closedId?'已过浮标':'没走完也没关系'}</small></li>`).join('')}</ol><p class="landing-shell-count">一路写进航线的 ${r.adopted} 程，会变成沙滩上的贝壳。</p>${!r.ready?`<p class="project-archive-notice">还有 ${r.total-r.closed} 个浮标没过。只要你觉得到了，就可以登岛。</p>`:''}<label class="field-label" for="island-name">给这座岛起个名字</label><input id="island-name" class="text-field" maxlength="12" value="${escape(isleName(state))}"><label class="field-label" for="project-note">留给以后的自己 <small>可选</small></label><textarea id="project-note" class="text-field" maxlength="1000" placeholder="现在回头看…"></textarea><div class="dialog-actions"><button class="text-button" data-project-command="shelve">先下锚</button><button class="primary-button" data-project-command="finish">登岛，收进群岛${icon('check')}</button></div></div>`;openModal('project-archive');focusDialogTitle();
  }
  function finishProject(status){
    const note=dialog.querySelector('#project-note')?.value||'',name=String(dialog.querySelector('#island-name')?.value||'').trim().slice(0,12);const id=state.id;
    if(!commitProjects(w=>{const p=w.projects.find(p=>p.id===id);if(status==='completed'&&name)p.islandName=name;QibanProjects.archive(p,{id:'closure-'+uid(),at:new Date().toISOString(),note,status});}))return;
    clearForm();closeModal();go('now');if(status==='completed')main.querySelector('.landing-hero')?.classList.add('celebrating');toast(status==='completed'?'登岛了。这座岛，收进了你的群岛。':'船先下锚，随时可以起锚。');
  }
  function reopenProject(){const id=state.id;if(!commitProjects(w=>QibanProjects.reopen(w.projects.find(p=>p.id===id))))return;QibanHome.resume(state);save();go('now');toast('重新起航了，之前的航海日志都还在。');}
  const DEFAULT_LEGS=['出发','中途','靠岸'];
  let newProjectDraft={goal:'',scope:'',first:'',legs:[...DEFAULT_LEGS],plan:null,busy:false,error:''};
  function openNewProject(){
    if(dialog.open)closeModal();const record=cloud?.getForm('new-project');if(record){const fields=record.fields||record;newProjectDraft.goal=fields['new-project-goal']||'';newProjectDraft.scope=fields['new-project-scope']||'';newProjectDraft.first=fields['new-project-first']||'';if(Array.isArray(record.legs)&&record.legs.length&&record.legs.length<=6&&record.legs.every(n=>typeof n==='string'))newProjectDraft.legs=[...record.legs];if(!newProjectDraft.busy)newProjectDraft.plan=Array.isArray(record.plan)&&record.plan.length<=6&&record.plan.every(b=>b&&Array.isArray(b.actions)&&b.actions.every(a=>Array.isArray(a?.contract?.criteria)))?clone(record.plan):null;}
    renderNewProject();openModal('new-project');focusDialogTitle();
  }
  function renderNewProject(){
    const d=newProjectDraft;dialog.className='project-dialog';
    const legsHTML=`<details class="new-legs"><summary>航程 · ${d.legs.map(n=>escape(n||'…')).join(' / ')}</summary><p class="small-text">先这样分就好，之后在海图里随时能改。</p>${d.legs.map((n,i)=>`<label class="leg-input"><span>第 ${i+1} 段</span><input class="text-field" data-new-leg="${i}" maxlength="40" value="${escape(n)}" aria-label="第 ${i+1} 段航程"></label>`).join('')}</details>`;
    dialog.innerHTML=dialogTop('驶向一座新岛')+`<div class="dialog-body"><h2 id="dialog-title">下一座岛，是哪里？</h2><label class="field-label" for="new-project-goal">我想做成的事</label><input id="new-project-goal" class="text-field" maxlength="120" value="${escape(d.goal)}" placeholder="比如：做出我的第一本摄影集" ${d.busy?'disabled':''}><p class="delivery-error" role="status">${escape(d.error)}</p>${d.busy?'<p role="status" class="stage-working">栖栖正在画航线…</p>':d.plan?`<div class="project-plan-heading"><h3>栖栖画的航线</h3><button class="text-button" data-project-command="plan">重新画一版${icon('spark')}</button></div><div class="project-plan">${d.plan.map((b,i)=>`<section><label class="field-label" for="plan-name-${i}">第 ${i+1} 段航程</label><input id="plan-name-${i}" class="text-field" maxlength="40" data-plan-name="${i}" value="${escape(b.name)}"><label class="field-label" for="plan-outcome-${i}">这段航程想抵达</label><input id="plan-outcome-${i}" class="text-field" maxlength="200" data-plan-outcome="${i}" value="${escape(b.outcome)}">${b.actions.map(a=>`<details class="project-plan-action"><summary>${escape(a.title)}</summary><p>${escape(a.prompt)}</p><ul>${a.contract.criteria.map(c=>`<li>${escape(c.label)}</li>`).join('')}</ul></details>`).join('')}</section>`).join('')}</div>`:`<label class="field-label" for="new-project-first">今天的第一程 <small>可选</small></label><input id="new-project-first" class="text-field" maxlength="50" value="${escape(d.first)}" placeholder="比如：挑出一张想放进去的照片">${legsHTML}`}<details class="more-options"><summary>做到什么程度就算登岛 <small>可选</small></summary><input id="new-project-scope" class="text-field" maxlength="100" value="${escape(d.scope)}" aria-label="做到什么程度就算登岛" placeholder="比如：选出 12 张照片，做成一本小册子" ${d.busy?'disabled':''}></details><div class="dialog-actions"><button class="text-button" data-modal-command="close">先不出发</button><div class="action-buttons">${!d.plan&&aiAvailable()?`<button class="secondary-button" data-project-command="plan" ${d.busy?'disabled':''}>栖栖，帮我画航线${icon('spark')}</button>`:''}<button class="primary-button" data-project-command="create" ${d.busy?'disabled':''}>扬帆出发${icon('arrow')}</button></div></div></div>`;modalMode='new-project';
  }
  async function planProject(){
    const d=newProjectDraft;if(d.busy)return;
    if(!d.goal.trim()){d.error='先说说想去哪座岛。';renderNewProject();return;}
    if(!serviceAvailable||!aiConfig.configured){d.error='连接 AI 后，栖栖可以帮你画航线；也可以直接出发。';renderNewProject();return;}
    d.busy=true;d.error='';renderNewProject();
    try{const out=await api('plan',{requestId:'plan-'+uid(),context:{goal:d.goal.trim(),scope:d.scope.trim()}});d.plan=out.result.stages;}
    catch(e){d.error=e.message;}finally{d.busy=false;rememberNewProject();if(dialog.open&&modalMode==='new-project')renderNewProject();}
  }
  function legsPlan(legs,first,scope){const names=legs.map(n=>String(n||'').trim().slice(0,40)).filter(Boolean).slice(0,6);if(!names.length)names.push(...DEFAULT_LEGS);return names.map((name,i)=>({name,outcome:i===names.length-1&&scope?scope:name,actions:i?[]:[{title:first||'迈出第一步',prompt:'这一次，我做了…'}]}));}
  function createProject(){
    const d=newProjectDraft;if(d.busy)return;
    if(!d.goal.trim()){d.error='先说说想去哪座岛。';renderNewProject();return;}
    const plan=d.plan||legsPlan(d.legs,d.first.trim(),d.scope.trim());
    let p;try{p=QibanProjects.create({id:'project-'+uid(),goal:d.goal,scope:d.scope,plan,at:new Date().toISOString()});}catch(e){d.error=e.message;renderNewProject();return;}
    if(!commitProjects(w=>{w.projects.push(p);w.selectedId=p.id;}))return;
    clearForm();newProjectDraft={goal:'',scope:'',first:'',legs:[...DEFAULT_LEGS],plan:null,busy:false,error:''};closeModal();launching=true;go('now');toast('扬帆了。');
  }
  // 第一次打开：三步就能出海，不预设任何示例目标。
  let onboard={step:0,goal:'',legs:[...DEFAULT_LEGS],first:'',error:''};
  const ONBOARD_EXAMPLES=['学会自由泳','读完一本想读的书','做出第一本作品集'];
  function renderOnboarding(){
    const o=onboard,cards=[
      ()=>`<h1 id="onboard-title" tabindex="-1">你想抵达哪座岛？</h1><p class="onboard-lead">这座岛，就是你想做成的那件事。不用很大，说得清楚就好。</p><label class="field-label" for="onboard-goal">我想做成的事</label><input id="onboard-goal" class="text-field" maxlength="120" value="${escape(o.goal)}" placeholder="比如：学会自由泳" autocomplete="off"><div class="choice-list onboard-examples" role="group" aria-label="举几个例子">${ONBOARD_EXAMPLES.map(c=>`<button class="choice-chip${o.goal===c?' chosen':''}" data-onboard-example="${escape(c)}" aria-pressed="${o.goal===c}">${escape(c)}</button>`).join('')}</div>`,
      ()=>`<h1 id="onboard-title" tabindex="-1">这一路，分几段航程？</h1><p class="onboard-lead">先分三段就够了。每走完一段，会经过一个浮标。之后在海图里随时能改。</p><div class="onboard-legs">${o.legs.map((n,i)=>`<label class="leg-input"><span>${QibanVoyage.buoy({size:18})}第 ${i+1} 段</span><input class="text-field" data-onboard-leg="${i}" maxlength="40" value="${escape(n)}" aria-label="第 ${i+1} 段航程的名字"></label>`).join('')}</div>${o.legs.length<6?`<button class="text-button" data-onboard="add-leg">${icon('plus')}再加一段</button>`:''}`,
      ()=>`<h1 id="onboard-title" tabindex="-1">今天的第一程是什么？</h1><p class="onboard-lead">挑一件今天就能做完的小事。做完了，按住帆绳，船就会往前走一点。</p><label class="field-label" for="onboard-first">今天的第一程</label><input id="onboard-first" class="text-field" maxlength="50" value="${escape(o.first)}" placeholder="比如：查好附近泳池的开放时间" autocomplete="off">`
    ];
    main.innerHTML=`<section class="onboard" aria-labelledby="onboard-title"><div class="onboard-art">${QibanVoyage.scene({progress:0.04+o.step*0.06,seed:'first-island',label:'一条小船停在海上，远处有一座雾里的岛'})}</div><div class="onboard-card"><div class="onboard-steps" role="img" aria-label="第 ${o.step+1} 步，共 3 步">${[0,1,2].map(i=>`<i class="${i<=o.step?'on':''}"></i>`).join('')}</div>${cards[o.step]()}<p class="delivery-error" role="status">${escape(o.error)}</p><div class="onboard-actions">${o.step?`<button class="text-button" data-onboard="back">${icon('back')}上一步</button>`:'<span></span>'}<button class="primary-button" data-onboard="${o.step<2?'next':'launch'}">${o.step<2?'下一步':'扬帆出发'}${icon('arrow')}</button></div></div></section>`;
  }
  function onboardClick(b){
    const o=onboard,act=b.dataset.onboard;
    if(b.dataset.onboardExample){o.goal=b.dataset.onboardExample;o.error='';renderOnboarding();main.querySelector('#onboard-goal')?.focus?.();return;}
    if(act==='back'){o.step=Math.max(0,o.step-1);o.error='';}
    if(act==='add-leg'&&o.legs.length<6)o.legs.splice(o.legs.length-1,0,'');
    if(act==='next'){
      if(o.step===0&&!o.goal.trim()){o.error='先写下想去的那座岛。';renderOnboarding();main.querySelector('#onboard-goal')?.focus?.();return;}
      if(o.step===1&&!o.legs.some(n=>n.trim())){o.error='至少留一段航程。';renderOnboarding();return;}
      o.step=Math.min(2,o.step+1);o.error='';
    }
    if(act==='launch'){launchFirst();return;}
    renderOnboarding();main.querySelector(act==='add-leg'?`[data-onboard-leg="${o.legs.length-2}"]`:'.onboard-card input')?.focus?.({preventScroll:true});
  }
  function launchFirst(){
    const o=onboard;let p;
    try{p=QibanProjects.create({id:'project-'+uid(),goal:o.goal,scope:'',plan:legsPlan(o.legs,o.first.trim(),''),at:new Date().toISOString()});}catch(e){o.error=e.message;renderOnboarding();return;}
    if(!commitProjects(w=>{if(w.projects.length===1&&untouchedSeed(w.projects[0]))w.projects=[p];else w.projects.push(p);w.selectedId=p.id;}))return;
    firstRun=false;onboard={step:0,goal:'',legs:[...DEFAULT_LEGS],first:'',error:''};QibanHome.visit(state);saveVisit();launching=true;go('now');toast('扬帆了。');
  }
  main.addEventListener('input',e=>{const t=e.target;if(!firstRun||!t)return;if(t.id==='onboard-goal'){onboard.goal=t.value;main.querySelectorAll?.('[data-onboard-example]').forEach(c=>c.classList.toggle('chosen',c.dataset.onboardExample===t.value));}if(t.id==='onboard-first')onboard.first=t.value;if(t.dataset?.onboardLeg!==undefined)onboard.legs[Number(t.dataset.onboardLeg)]=t.value;});
  main.addEventListener('keydown',e=>{if(firstRun&&e.key==='Enter'&&!e.isComposing&&e.target?.matches?.('#onboard-goal,#onboard-first,[data-onboard-leg]')){e.preventDefault();main.querySelector('[data-onboard="next"],[data-onboard="launch"]')?.click();}});
  function projectClick(event){const b=event.target.closest('button');if(!b)return;if(b.dataset.projectOpen){switchProject(b.dataset.projectOpen);return;}const cmd=b.dataset.projectCommand;if(!cmd)return;
    if(cloud&&['new','archive','finish','shelve','reopen','create','plan'].includes(cmd)&&!cloud.requireOnline())return;
    if(cmd==='list')go('projects');if(cmd==='new')openNewProject();if(cmd==='archive')openArchiveProject();if(cmd==='finish')finishProject('completed');if(cmd==='shelve')finishProject('shelved');if(cmd==='reopen')reopenProject();if(cmd==='plan')planProject();if(cmd==='create')createProject();if(cmd==='export-all')exportData(true);
  }
  main.addEventListener('click',projectClick);dialog.addEventListener('click',projectClick);
  dialog.addEventListener('input',event=>{const key={'new-project-goal':'goal','new-project-scope':'scope','new-project-first':'first'}[event.target.id];if(key){newProjectDraft[key]=event.target.value;if(key!=='first'&&newProjectDraft.plan){newProjectDraft.plan=null;dialog.querySelector('.project-plan')?.remove();dialog.querySelector('[data-project-command="create"]').disabled=true;newProjectDraft.error='想去的岛变了，请栖栖重新画一版航线。';dialog.querySelector('.delivery-error').textContent=newProjectDraft.error;}}if(event.target.dataset.newLeg!==undefined){newProjectDraft.legs[Number(event.target.dataset.newLeg)]=event.target.value;}if(event.target.dataset.planName!==undefined&&newProjectDraft.plan)newProjectDraft.plan[Number(event.target.dataset.planName)].name=event.target.value;if(event.target.dataset.planOutcome!==undefined&&newProjectDraft.plan)newProjectDraft.plan[Number(event.target.dataset.planOutcome)].outcome=event.target.value;});

  const clone = value => JSON.parse(JSON.stringify(value));
  const hasDraft = d => Boolean(d && (d.text || d.artifacts?.length || d.link || d.observation || d.contract));
  function contractFor(task) {
    return clone(state.drafts[task.id]?.contract || state.contracts[task.id] || task.contract || {
      kind:'decision', outcome:task.id==='proof'?'留下一件能体现变化的成果或体验':task.title,
      ...(task.id==='proof'?{criteria:[{label:'留下一项具体成果或真实体验',method:'content',clue:'提到成果或感受，但具体内容还不清楚'},{label:'指出前后感受、想法或行动中的一项变化',method:'content',clue:'提到受到触动或有所改善，但具体变化还不清楚'}]}:{criteria:(task.aiCriteria || task.criteria?.map(c=>c[0]) || [task.title]).map(label=>({label,method:'content'}))})
    });
  }
  // 只有“做完这一程”这一条标准时，不必再把它摆出来。
  const plainContract=(c,title)=>Boolean(c)&&c.kind!=='artifact'&&c.outcome===title&&(c.criteria||[]).length<=1&&!(c.criteria||[]).some(k=>k.method==='experience');
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
    return `<section class="submitted-evidence">${plainContract(a.contract,a.taskTitle)?'':contractHTML(a.contract)}${artifactList(a.artifacts)}${link?`<a class="preview-link" href="${escape(link)}" target="_blank" rel="noopener noreferrer">打开预览 ↗<small>引用地址 · AI 未访问</small></a>`:''}${d.observation&&d.observation.trim()!==a.text?.trim()?`<div class="personal-observation"><small>我的试用感受</small><p>${escape(d.observation)}</p></div>`:''}${a.feedback?.scope?`<div class="verification-label">${a.feedback.scope==='mixed'?'AI 内容审阅 · 含本人体验确认':a.feedback.scope==='visual'?'AI 已审阅图片 · 未运行验证':a.feedback.scope==='content'?(a.contract.kind==='artifact'?'AI 已审阅内容 · 未运行验证':'AI 已审阅这次决定'):'尚未确认完成标准'}</div>`:''}</section>`;
  }
  function composerHTML(task){
    const draft=state.drafts[task.id]||{text:''}, contract=contractFor(task), artifacts=draft.artifacts||[], experiential=contract.criteria.some(c=>c.method==='experience');
    return `${plainContract(contract,task.title)?`<details class="more-options contract-more"><summary>想定得更具体一点？</summary>${contractHTML(contract,true)}</details>`:contractHTML(contract,true)}${task.sourceText?`<details class="source-decision"><summary>沿用的方案 · 第 ${task.sourceVersion} 版</summary><p>${escape(task.sourceText)}</p></details>`:''}<label class="composer-label" for="action-text">${escape(experiential?'这一次，我留下…':task.prompt)}</label>${task.choices?.length&&contract.kind==='decision'?`<div class="choice-list">${task.choices.map((c,i)=>`<button class="choice-chip" data-choice="${i}">${escape(c)}</button>`).join('')}</div>`:''}<div class="composer"><textarea id="action-text" maxlength="6000" aria-label="这一程的日志" placeholder="${experiential?'做了什么，实际感觉如何…':contract.kind==='artifact'?'这次做出了什么…':'半句话也好。'}">${escape(draft.text||'')}</textarea>${imageGallery(artifacts,true)}<div class="composer-tools">${serviceAvailable?`<label class="text-button upload-button">${icon('plus')}图片<input id="composer-images" type="file" multiple accept="image/png,image/jpeg,image/webp,image/gif" aria-label="添加图片" ${uploading.has(task.id)?'disabled':''}></label>`:''}${aiAvailable()?`<button class="assist-button" data-modal-command="help" aria-expanded="${helpVisible}">${icon('spark')}栖栖，搭把手</button>`:''}<span class="char-count" id="char-count">${(draft.text||'').length} / 6000</span></div></div><div class="record-confirmations">${experiential?`<div class="experience-checks">${contract.criteria.map((c,i)=>c.method==='experience'?`<label><input type="checkbox" data-experience-check="${i}" ${(draft.confirmed||[]).includes(i)?'checked':''}><span>我已确认：${escape(c.label)}</span></label>`:'').join('')}</div>`:''}</div><div id="assist-slot">${helpVisible?assistHTML(task):''}</div>
      ${serviceAvailable||artifacts.length||draft.link?`<details class="delivery-input" ${contract.kind==='artifact'||artifacts.length||draft.link?'open':''}><summary>附件与链接${artifacts.length?' · '+artifacts.length+' 份文件':''}</summary><div class="delivery-fields"><div class="upload-row"><label class="secondary-button upload-button">${icon('plus')}附上文件<input id="artifact-files" type="file" multiple accept=".html,.htm,.css,.js,.mjs,.jsx,.ts,.tsx,.json,.md,.txt,.py,.vue,.svelte,.svg,.png,.jpg,.jpeg,.webp,.gif" aria-label="附上成果文件" ${uploading.has(task.id)?'disabled':''}></label><span class="small-text">${uploading.has(task.id)?'正在保存…':'最多 4 份 · 每份 4 MB'}</span></div><div id="artifact-list">${artifactList(artifacts.filter(a=>a.kind!=='image'),true)}</div><div id="delivery-error" class="delivery-error" role="status"></div><label class="field-label" for="delivery-link">预览地址 <small>AI 不访问链接</small></label><input class="text-field" id="delivery-link" type="url" maxlength="2000" value="${escape(draft.link||'')}" placeholder="https://…"></div></details>`:''}
      ${draft.retryOf?`<div class="draft-context">接着第 ${versionNumber(getAttempt(draft.retryOf)||records(task.id).at(-1))} 条，改一点</div>`:''}<div class="dialog-actions"><span class="draft-state" id="draft-state">${hasDraft(draft)?(storageFailed?'尚未保存':'草稿已留下'):'写一句也好'}</span><button class="primary-button" id="submit-attempt" data-modal-command="submit" ${canSubmit(draft,task.id)?'':'disabled'}>记进日志${icon('check')}</button></div>`;
  }
  function canSubmit(draft={},taskId=activeTaskId){return !uploading.has(taskId)&&Boolean(draft.text?.trim()||draft.artifacts?.length||draft.link?.trim());}
  function editContract(){
    const c=contractFor(getTask(activeTaskId));modalMode='contract';
    dialog.innerHTML=dialogTop('这一程的落点')+`<div class="dialog-body"><h2 id="dialog-title">做到这里，就可以。</h2><label class="field-label" for="contract-kind">这次留下</label><select class="text-field" id="contract-kind"><option value="decision" ${c.kind==='decision'?'selected':''}>一个决定 / 一段内容</option><option value="artifact" ${c.kind==='artifact'?'selected':''}>可交付的成果</option></select><label class="field-label" for="contract-outcome">预期成果</label><input class="text-field" id="contract-outcome" maxlength="200" value="${escape(c.outcome)}"><label class="field-label">完成标准</label>${[0,1,2].map(i=>`<div class="criterion-editor"><input class="text-field" data-criterion-label="${i}" maxlength="100" aria-label="完成标准 ${i+1}" value="${escape(c.criteria[i]?.label||'')}" placeholder="${i?'可留空':'什么出现了，就算完成'}"><select class="text-field" data-criterion-method="${i}" aria-label="标准 ${i+1} 验证方式"><option value="content">内容审阅</option><option value="experience" ${c.criteria[i]?.method==='experience'?'selected':''}>实际体验 · 本人确认</option></select></div>`).join('')}<div class="dialog-actions"><button class="text-button" data-modal-command="cancel-contract">返回</button><button class="primary-button" data-modal-command="save-contract">就以此为准</button></div></div>`;openModal('contract');focusDialogTitle();
  }
  function saveContract(){
    const outcome=dialog.querySelector('#contract-outcome').value.trim(),kind=dialog.querySelector('#contract-kind').value;
    const criteria=[...dialog.querySelectorAll('[data-criterion-label]')].map(el=>({label:el.value.trim(),method:dialog.querySelector(`[data-criterion-method="${el.dataset.criterionLabel}"]`).value})).filter(c=>c.label);
    if(!outcome||!criteria.length||new Set(criteria.map(c=>c.label)).size!==criteria.length){toast('留下一个预期成果和不重复的完成标准。');return;}
    for(const c of criteria){const old=contractFor(getTask(activeTaskId)).criteria.find(k=>k.label===c.label&&k.method===c.method);if(old?.clue)c.clue=old.clue;}
    updateDraft(state.drafts[activeTaskId]?.text||'',{contract:{kind,outcome,criteria},confirmed:[]});clearForm();assistance.delete(activeTaskId);renderTaskDialog();
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
    try{const a=await api('artifacts/read',{id});const bytes=Uint8Array.from(atob(a.base64),c=>c.charCodeAt(0));await downloadBlob(new Blob([bytes],{type:a.mime||'application/octet-stream'}),a.name);}catch(e){toast(e.message);}
  }
  async function downloadBlob(blob,name){if(globalThis.QibanPlatform)return globalThis.QibanPlatform.saveBlob(blob,name,{share:globalThis.QibanPlatform.native});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
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
  function feedbackHTML(attempt,task){if(attempt.aiStatus&&attempt.aiStatus!=='complete')return waitingFeedbackHTML(attempt,task);const f=attempt.feedback;if(f.ratingVersion==='anchored-v1')return progressHTML(attempt,task);const accepted=state.accepted[task.id]===attempt.id;return `<div class="feedback-header"><div class="grade-seal"><strong>${escape(f.grade)}</strong><small>第 ${versionNumber(attempt)} 条</small></div><div><div class="feedback-title">${escape(f.title)}</div><div class="feedback-meta"><span>${formatDate(attempt.createdAt,true)}</span><span>·</span><span>${escape(attempt.provenance)}</span><span>·</span><span title="${escape(f.meta?.model||'')}">${escape(f.label)}</span></div></div></div><blockquote class="submission-quote">${escape(attempt.text)}</blockquote>${evidenceHTML(attempt)}${f.hint?`<div class="next-improvement">${icon('spark')}<div><small>${f.grade==='—'?'还缺一份依据':f.grade==='A'?'留给下一次':'下一点，可以很轻'}</small><p>${escape(f.hint)}</p></div></div>`:''}${f.checks.length?`<details class="rubric"><summary>本次标尺</summary><ul>${f.checks.map(c=>`<li class="${c.pass?'criteria-pass':''}">${icon(c.pass?'check':'circle')}${escape(c.label)}${c.status?`<small class="check-source">${c.status==='self'?'本人确认':c.status==='visual'?'AI 图像观察':c.status==='content'?'AI 内容审阅':'待验证'}</small>`:''}${c.source&&c.source!=='current'&&c.source!=='observation'?`<small>${escape(attempt.artifacts?.find(a=>a.id===c.source)?.name||'成果文件')}</small>`:''}${c.evidence?`<span class="criterion-evidence">${c.status==='visual'?escape(c.evidence):'「'+escape(c.evidence)+'」'}</span>`:''}</li>`).join('')}</ul><p style="margin-top:10px">${attempt.aiStatus==='complete'?'C · 起点　B · 有用的一程　A · 这次已足够　S · 额外的证据':'C · 留下想法　B · 一个要点　A · 两个要点'}</p></details>`:''}${f.comparison?`<p class="ai-comparison">${escape(f.comparison)}</p>`:''}${task.id==='home-focus'?'<div class="next-action-link"><button class="text-button" data-modal-command="build-decision">拿这版方案，去做出效果 ↗</button></div>':''}${logFooter(attempt,task)}`;}
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
    state.attempts.push(attempt);state.contracts[task.id]=clone(contract);delete state.drafts[task.id];activeAttemptId=attempt.id;helpVisible=false;const fresh=!state.accepted[task.id];if(fresh){state.accepted[task.id]=attempt.id;state.adoptions.push({attemptId:attempt.id,taskId:task.id,at:attempt.createdAt});}QibanHome.resume(state);
    persistNotice(fresh?'记进日志，这一程写进了航线。':'记进日志了。');renderTaskDialog();dialog.scrollTop=0;focusDialogTitle();render();
    if(serviceAvailable&&aiConfig.configured)requestFeedback(attempt.id);
  }
  function adopt(id=activeAttemptId){const attempt=getAttempt(id);if(!attempt)return;state.accepted[attempt.taskId]=id;state.adoptions.push({attemptId:id,taskId:attempt.taskId,at:new Date().toISOString()});persistNotice(`第 ${versionNumber(attempt)} 条，写进了航线。`);if(modalMode==='compare'){renderCompare();render();}else closeModal();}
  function retry(){const old=getAttempt(activeAttemptId);if(!old)return;state.drafts[old.taskId]=QibanRecordInput.unify({text:old.text,contract:clone(old.contract||contractFor(getTask(old.taskId))),artifacts:clone(old.artifacts||[]),link:old.delivery?.link||'',observation:old.delivery?.observation||'',confirmed:[],retryOf:old.id,aiHelped:old.provenance==='AI 协助起草',helped:old.provenance==='借助预设草稿',chosen:old.provenance==='从候选中选择'});save();activeAttemptId=null;helpVisible=false;renderTaskDialog();document.querySelector('#action-text').focus();}
  function renderCompare(){const task=getTask(activeTaskId);const list=records(task.id);if(list.length<2)return;modalMode='compare';dialog.className='compare-dialog';if(compareIds.length!==2||compareIds.some(id=>!list.some(a=>a.id===id)))compareIds=[list[0].id,list.at(-1).id];const pair=compareIds.map(getAttempt);dialog.innerHTML=dialogTop(`${escape(task.title)}<span class="slash">/</span>两条对比`)+`<div class="dialog-body"><h2 id="dialog-title">看看，这一点点变化。</h2><div class="comparison">${pair.map((a,side)=>`<section class="compare-column"><div class="compare-select-row"><select aria-label="${side?'右':'左'}侧那一条" data-compare-side="${side}">${list.map((opt,i)=>`<option value="${escape(opt.id)}" ${opt.id===a.id?'selected':''}>第 ${i+1} 条${state.accepted[task.id]===opt.id?' · 在航线上':''}</option>`).join('')}</select><span class="entry-grade">${escape(a.feedback.grade)}</span></div><p class="compare-content">${escape(a.text)}</p>${evidenceHTML(a)}<div class="compare-facts">${formatDate(a.createdAt,true)}<br>${escape(a.provenance)} · ${escape(a.feedback.label)}${a.feedback.checks.length?'<br>'+a.feedback.checks.filter(c=>c.pass).map(c=>escape(c.label)).join(' · '):''}</div><button class="text-button" data-adopt-version="${escape(a.id)}" ${state.accepted[task.id]===a.id?'disabled':''}>${state.accepted[task.id]===a.id?icon('check')+'在航线上':'用第 '+versionNumber(a)+' 条写进航线'+icon('arrow')}</button></section>`).join('')}</div><div class="compare-summary">${comparisonNote(pair)}</div><div class="dialog-actions"><button class="text-button" data-modal-command="back-to-attempt">${icon('back')}回到这一程</button><button class="secondary-button" data-modal-command="close">先到这里</button></div></div>`;loadImagePreviews();dialog.scrollTop=0;focusDialogTitle();}
  function comparisonNote([left,right]){if((left.aiStatus&&left.aiStatus!=='complete')||(right.aiStatus&&right.aiStatus!=='complete'))return '有一条还没有 AI 反馈，原文仍然可以对照。';if(left.id===right.id)return '这是同一条。';if(JSON.stringify(left.contract)!==JSON.stringify(right.contract))return '两条的完成标准不同，不直接比较评级。';if(JSON.stringify((left.artifacts||[]).map(a=>a.id).sort())!==JSON.stringify((right.artifacts||[]).map(a=>a.id).sort()))return '成果文件发生了变化。请对照文件内容与实际体验，文字评级不代表运行效果。';if(left.contract?.kind==='artifact'&&right.contract?.kind==='artifact'&&JSON.stringify(left.delivery)!==JSON.stringify(right.delivery))return '成果文件未变；两条的本人试用记录、确认或预览地址不同。';if(left.text===right.text&&JSON.stringify(left.delivery)===JSON.stringify(right.delivery))return '文字没有变化。这两次尝试，都独立保留着。';if(left.feedback.ratingVersion!==right.feedback.ratingVersion)return '评价方式已更新，两条评级不直接比较。';if(left.feedback.label!==right.feedback.label)return '两条的评价方式不同，先看原文里的变化。';if(right.parentId===left.id&&right.feedback.comparison)return escape(right.feedback.comparison);if(JSON.stringify(left.feedback.checks.map(c=>c.label))!==JSON.stringify(right.feedback.checks.map(c=>c.label)))return '这两条使用的标尺不同，评级不直接比较。';const added=right.feedback.checks.filter((c,i)=>c.level?['absent','clue','enough'].indexOf(c.level)>['absent','clue','enough'].indexOf(left.feedback.checks[i]?.level):c.pass&&!left.feedback.checks[i]?.pass);if(added.length)return `右侧多留下了一点：${added.map(c=>escape(c.label)).join('、')}。`;const lost=left.feedback.checks.filter((c,i)=>c.pass&&!right.feedback.checks[i]?.pass);if(lost.length)return `右侧暂时没有呈现：${lost.map(c=>escape(c.label)).join('、')}。两条都可以保留。`;return '当前标准下没有新增的达成项；两条原文都保留着。';}
  function openSimple(mode){dialog.className='';activeTaskId=null;activeAttemptId=null;const leg=getBranch(state.branch);const titles={add:'加一程',goal:'把这座岛，说得更准确一点',snapshot:'给这段航行，留一张纪念',reset:'重新开始这份体验？',leg:'改改这段航程','leg-add':'加一段航程'};let content='';
    if(mode==='add')content=`<label class="field-label" for="custom-title">这一程要做的事</label><input class="text-field" id="custom-title" maxlength="50" placeholder="比如：去泳池试游 20 分钟" autofocus><details class="more-options"><summary>更多选项</summary><label class="field-label" for="custom-prompt">日志开头 · 可留空</label><input class="text-field" id="custom-prompt" maxlength="100" placeholder="这一次，我…"><label class="field-label" for="custom-kind">这一程会留下</label><select class="text-field" id="custom-kind"><option value="decision">一个决定 / 一段话</option><option value="artifact">一份可以交出去的成果</option></select></details><div class="dialog-actions"><span class="draft-state">加到「${escape(leg.name)}」</span><button class="primary-button" data-modal-command="save-custom">加进航线${icon('arrow')}</button></div>`;
    if(mode==='goal')content=`<label class="field-label" for="goal-input">想做成的事</label><textarea class="text-field textarea" id="goal-input" maxlength="120" autofocus>${escape(state.goal)}</textarea><label class="field-label" for="scope-input">做到什么程度就算登岛 <small>可选</small></label><input class="text-field" id="scope-input" maxlength="100" value="${escape(state.scope)}"><div class="dialog-actions"><span class="draft-state">之前的日志，会留在原处</span><button class="primary-button" data-modal-command="save-goal">就这样${icon('check')}</button></div>`;
    if(mode==='leg')content=`<label class="field-label" for="leg-name">航程的名字</label><input class="text-field" id="leg-name" maxlength="40" value="${escape(leg.name)}"><label class="field-label" for="leg-outcome">这段航程想抵达 <small>可选</small></label><input class="text-field" id="leg-outcome" maxlength="200" value="${escape(leg.outcome===leg.name?'':leg.outcome)}" placeholder="比如：能在浅水区游完 25 米"><div class="dialog-actions"><span class="draft-state">之前的日志不受影响</span><button class="primary-button" data-modal-command="save-leg">就这样${icon('check')}</button></div>`;
    if(mode==='leg-add')content=`<label class="field-label" for="leg-name">新航程的名字</label><input class="text-field" id="leg-name" maxlength="40" placeholder="比如：熟悉换气" autofocus><label class="field-label" for="leg-outcome">这段航程想抵达 <small>可选</small></label><input class="text-field" id="leg-outcome" maxlength="200"><div class="dialog-actions"><span class="draft-state">会加在航线的最后</span><button class="primary-button" data-modal-command="save-leg-add">加进海图${icon('plus')}</button></div>`;
    if(mode==='snapshot'){content=`<label class="field-label" for="snapshot-title">这张纪念的名字</label><input class="text-field" id="snapshot-title" maxlength="60" value="${state.snapshots.length?'又往前走了一点':'出发后的第一张纪念'}"><label class="field-label" for="snapshot-note">和刚出发时相比，现在的我…</label><textarea class="text-field textarea" id="snapshot-note" maxlength="2000" placeholder="留一句自己能认出的变化。"></textarea><div class="snapshot-preview"><small>此刻的航行</small><p>${state.attempts.length} 条日志 · ${Object.keys(state.accepted).length} 程写进航线</p><p>${escape(getBranch(state.branch).name)}</p></div><div class="dialog-actions"><span class="draft-state">${formatDate(new Date().toISOString())}</span><button class="primary-button" data-modal-command="save-snapshot">留住这一刻${icon('book')}</button></div>`;}
    if(mode==='reset')content='<p class="danger-copy">这份原型里的日志、草稿和纪念将被清空。</p><div class="dialog-actions"><button class="text-button" data-modal-command="export">先导出航海日志</button><div class="action-buttons"><button class="secondary-button" data-modal-command="close">保留</button><button class="primary-button" data-modal-command="confirm-reset">清空并重来</button></div></div>';
    dialog.innerHTML=dialogTop('栖伴')+`<div class="dialog-body"><h2 id="dialog-title">${titles[mode]}</h2>${content}</div>`;openModal(mode);
  }
  function saveSnapshot(){const title=document.querySelector('#snapshot-title').value.trim();if(!title){document.querySelector('#snapshot-title').focus();return;}const snap={id:uid(),title,note:document.querySelector('#snapshot-note').value.trim(),createdAt:new Date().toISOString(),goal:state.goal,scope:state.scope,branchName:getBranch(state.branch).name,evidence:state.attempts.map(a=>({id:a.id,title:a.taskTitle,version:versionNumber(a),text:a.text,grade:a.feedback.grade,provenance:a.provenance,...(a.contract?{contract:clone(a.contract),delivery:clone(a.delivery),artifacts:clone(a.artifacts),feedback:clone(a.feedback)}:{}),adopted:state.accepted[a.taskId]===a.id}))};state.snapshots.push(snap);clearForm();persistNotice('这张纪念，留住了。');closeModal();historyFilter='snapshots';go('history');}
  function openSnapshot(id){const snap=state.snapshots.find(s=>s.id===id);if(!snap)return;dialog.className='';dialog.innerHTML=dialogTop('纪念'+`<span class="slash">/</span>${formatDate(snap.createdAt)}`)+`<div class="dialog-body"><h2 id="dialog-title">${escape(snap.title)}</h2><p class="small-text">${escape(snap.goal)}</p><blockquote class="submission-quote" style="margin-top:20px">${escape(snap.note||'这段时间的每一条日志，都夹在这里。')}</blockquote>${snap.evidence.map(e=>`<article class="history-entry"><div class="entry-top"><h2>${escape(e.title)}</h2><span class="entry-grade">${escape(e.grade)}</span></div><p class="entry-body">${escape(e.text||'走完了这一程，没写日志。')}</p>${evidenceHTML(e)}<div class="entry-info">${e.adopted?'当时写进航线':''}</div></article>`).join('')}<div class="dialog-actions"><span class="draft-state">${escape(snap.branchName)} · 当时的样子</span><button class="primary-button" data-modal-command="close">合上这一页</button></div></div>`;openModal('snapshot-view');}
  async function exportData(all=false,share=false){
    if(cloud?.isLocked?.())return;
    const snapshot=clone(all?workspace:state), sources=all?snapshot.projects:[snapshot], ids=[...new Set(sources.flatMap(snapshot=>[...snapshot.attempts.flatMap(a=>(a.artifacts||[]).map(f=>f.id)),...Object.values(snapshot.drafts).flatMap(d=>(d.artifacts||[]).map(f=>f.id)),...snapshot.snapshots.flatMap(s=>s.evidence.flatMap(e=>(e.artifacts||[]).map(f=>f.id))),...snapshot.stageRounds.flatMap(s=>s.evidence.flatMap(e=>(e.artifacts||[]).map(f=>f.id)))]))];
    try{const files=[];for(const id of ids){files.push(await api('artifacts/read',{id}));if(cloud?.isLocked?.())return;}if(cloud?.isLocked?.())return;const payload={product:'栖伴 · 成果行动原型',exportedAt:new Date().toISOString(),...snapshot,files},blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json;charset=utf-8'}),name=`栖伴-航海日志-${new Date().toISOString().slice(0,10)}.json`;
      if(share){
        dialog.className='';dialog.innerHTML=dialogTop('分享航海日志')+`<div class="dialog-body"><h2 id="dialog-title">文件已准备好。</h2><p class="small-text">航海日志和附件都在这份文件里。请在系统菜单中选择接收应用。</p><div class="dialog-actions"><button class="secondary-button" data-modal-command="close">取消</button><button class="primary-button" id="share-prepared-file">系统分享</button></div></div>`;openModal('export-share');
        dialog.querySelector('#share-prepared-file').onclick=async event=>{if(cloud?.isLocked?.())return;event.currentTarget.disabled=true;try{await globalThis.QibanPlatform.saveBlob(blob,name,{share:true});if(cloud?.isLocked?.())return;closeModal();toast('航海日志已分享。');}catch(e){event.target.disabled=false;toast(e.name==='AbortError'?'已取消分享，记录仍保留。':'分享未完成：'+e.message);}};
        return;
      }
      await downloadBlob(blob,name);toast('航海日志和附件已一同导出。');}
    catch(e){toast('导出未完成：'+e.message);}
  }
  main.addEventListener('click',event=>{const el=event.target.closest('button');if(!el)return;if(el.dataset.onboard||el.dataset.onboardExample){onboardClick(el);return;}if(el.dataset.actionRestore){QibanActions.restore(state,el.dataset.actionRestore);persistNotice('放回航线了。');render();return;}if(el.dataset.branch){QibanHome.resume(state);state.branch=el.dataset.branch;doneOnly=false;save();render();document.querySelector(`[data-branch="${state.branch}"]`)?.focus();}if(el.dataset.openTask)openTask(el.dataset.openTask,null,{compose:el.dataset.compose==='true'});if(el.dataset.openAttempt){const a=getAttempt(el.dataset.openAttempt);openTask(a.taskId,a.id);}if(el.dataset.historyFilter){const f=el.dataset.historyFilter;if(f==='bottles'){go('outings');return;}historyFilter=f;if(view==='outings'){go('history');return;}renderHistory();}if(el.dataset.calendarDay){if(historyFilter!=='all'){historyFilter='all';renderHistory();}const t=main.querySelector(`[data-day="${el.dataset.calendarDay}"]`);t?.scrollIntoView?.({behavior:'smooth',block:'center'});t?.classList.add('flash');setTimeout(()=>t?.classList.remove('flash'),1600);}if(el.dataset.openSnapshot)openSnapshot(el.dataset.openSnapshot);if(el.dataset.stageRound)openStageRound(el.dataset.stageRound);if(el.dataset.command)command(el.dataset.command);});
  // 按住帆绳：帆慢慢升满，船往前走一点，这一程就写进航线。
  const HOLD_MS=900;
  const seaHint=text=>{const el=main.querySelector?.('#sea-hint');if(el)el.textContent=text;};
  const buzz=pattern=>{try{navigator.vibrate?.(pattern);}catch{}};
  function startHold(btn){
    if(hold||!btn?.dataset?.sailTask)return;
    btn.classList.add('holding');main.querySelector?.('.sea-stage')?.classList?.add('hoisting');seaHint('帆在升起来……');buzz(8);
    hold={btn,taskId:btn.dataset.sailTask,projectId:state.id,phase:'holding',start:Date.now(),timer:setTimeout(finishHold,HOLD_MS)};
  }
  function finishHold(){
    const h=hold;if(!h)return;h.phase='settling';h.btn.classList.remove('holding');h.btn.classList.add('hoisted');buzz([12,40,24]);
    seaHint('扬帆了。');h.timer=setTimeout(()=>{if(hold!==h)return;hold=null;h.btn.classList.remove('hoisted');main.querySelector?.('.sea-stage')?.classList?.remove('hoisting');if(h.btn.isConnected&&view==='now'&&state.id===h.projectId&&!isArchived()&&!cloud?.isLocked?.()&&getTask(h.taskId))sailStep(h.taskId);},420);
  }
  function cancelHold(releaseOnly=false){
    const h=hold;if(!h||(releaseOnly&&h.phase==='settling'))return;hold=null;clearTimeout(h.timer);h.btn.classList.remove('holding','hoisted');main.querySelector?.('.sea-stage')?.classList?.remove('hoisting');
    seaHint(Date.now()-h.start<300?'要一直按住，帆才会升满。还没做完，也可以先写几句。':'做完了，就按住帆绳。船会往前走一点。');
  }
  function sailStep(taskId){
    const task=getTask(taskId);if(!task||state.accepted[taskId])return;
    const contract=contractFor(task),draft=state.drafts[taskId],createdAt=new Date().toISOString(),delivery={artifactIds:[],link:'',observation:'',confirmed:[]};
    const attempt={id:uid(),taskId,taskTitle:task.title,branch:task.branch,goal:state.goal,text:'',createdAt,provenance:'扬帆完成',parentId:null,contract,delivery,artifacts:[],aiStatus:'waiting',feedback:pendingFeedback('走完了这一程。'),quick:true,aiContext:makeContext(task,'','扬帆完成',contract,delivery)};
    state.attempts.push(attempt);state.contracts[taskId]=clone(contract);state.accepted[taskId]=attempt.id;state.adoptions.push({attemptId:attempt.id,taskId,at:createdAt});QibanHome.resume(state);
    const ok=save();render();openLogSheet(attempt.id,draft?.text||'');if(!ok)toast('本次未能保存，请先导出航海日志。');
  }
  function openLogSheet(attemptId,text=''){
    const a=getAttempt(attemptId);if(!a)return;const branch=getBranch(a.branch),left=allTasks().filter(t=>t.branch===branch.id&&!state.hiddenActions[t.id]&&!state.accepted[t.id]).length;
    activeTaskId=a.taskId;activeAttemptId=a.id;helpVisible=false;dialog.className='log-dialog';
    dialog.innerHTML=dialogTop(`${escape(branch.name)}<span class="slash">/</span>航海日志`)+`<div class="dialog-body log-sheet"><span class="route-stamp">写进航线</span><h2 id="dialog-title">这一程走完了。</h2><p class="log-task">${escape(a.taskTitle)}</p><label class="field-label" for="log-note">记进日志 <small>可选，一句话也好</small></label><textarea id="log-note" class="text-field textarea" maxlength="6000" placeholder="刚才做了什么？感觉怎么样？">${escape(text)}</textarea><p class="small-text log-next">${left?`这段航程还剩 ${left} 程。`:'这段航程的每一程都走完了，可以过浮标了。'}</p><div class="dialog-actions"><button class="text-button" data-modal-command="log-skip">先不写</button><button class="primary-button" data-modal-command="log-save">记进日志${icon('check')}</button></div></div>`;
    openModal('log');focusDialogTitle();
  }
  function saveLogNote(){
    const a=getAttempt(activeAttemptId),text=String(dialog.querySelector('#log-note')?.value||'').trim();
    if(!a||!text||!a.quick||a.text){closeModal();if(a&&!text)toast('船往前走了一点。');return;}
    const task=getTask(a.taskId);a.text=text;a.provenance='自己写下';if(task)a.aiContext=makeContext(task,text,a.provenance,a.contract,a.delivery);delete state.drafts[a.taskId];
    persistNotice('记进日志了。');closeModal();if(aiAvailable())requestFeedback(a.id);
  }
  main.addEventListener('pointerdown',e=>{const b=e.target?.closest?.('.sail-button');if(!b||e.button>0)return;e.preventDefault();try{b.setPointerCapture?.(e.pointerId);}catch{}startHold(b);});
  for(const type of ['pointerup','lostpointercapture'])main.addEventListener(type,()=>cancelHold(true));
  main.addEventListener('pointercancel',()=>cancelHold());
  main.addEventListener('focusout',e=>{if(e.target===hold?.btn)cancelHold();});
  window.addEventListener('pointerup',()=>cancelHold(true));
  window.addEventListener('blur',()=>cancelHold());
  window.addEventListener('pagehide',()=>cancelHold());
  window.addEventListener('qiban:account-changed',()=>cancelHold());
  window.addEventListener('qiban:lifecycle',e=>{if(!e.detail?.active&&e.detail?.state!=='active')cancelHold();});
  main.addEventListener('contextmenu',e=>{if(e.target?.closest?.('.sail-button'))e.preventDefault();});
  main.addEventListener('keydown',e=>{const b=e.target?.closest?.('.sail-button');if(b&&(e.key===' '||e.key==='Enter')){e.preventDefault();if(!e.repeat)startHold(b);}});
  window.addEventListener('keyup',e=>{if(e.key===' '||e.key==='Enter')cancelHold(true);});
  function syncThemeLabel(){const item=document.querySelector('#theme-menu-item');if(item)item.textContent='白天与夜晚：'+QibanMoon.theme.label();const btn=document.querySelector('#theme-button');btn?.setAttribute?.('aria-label',document.documentElement?.dataset?.theme==='day'?'换到夜晚':'换到白天');}
  document.querySelector('#theme-button')?.addEventListener?.('click',()=>command('theme-toggle'));
  syncThemeLabel();
  function command(cmd){if(cloud&&['new-project','archive-project'].includes(cmd)&&!cloud.requireOnline())return;if(cmd==='projects'){go('projects');return;}if(cmd==='new-project'){openNewProject();return;}if(cmd==='archive-project'){openArchiveProject();return;}if(cmd==='theme'){const pref=QibanMoon.theme.cycle();syncThemeLabel();toast('白天与夜航：'+QibanMoon.theme.label(pref));return;}if(cmd==='theme-toggle'){const mode=QibanMoon.theme.toggle();syncThemeLabel();toast(mode==='day'?'换到白天。':'换到夜航。');return;}if(firstRun&&!['ai-settings','export'].includes(cmd))return;if(isArchived()&&!['history','now','chart','outings','export','share-export','ai-settings'].includes(cmd)){toast('船已经靠岸了。重新起航后可以继续。');return;}if(cmd==='home-recap')home.openRecap();if(cmd==='outings')home.openLibrary();if(cmd==='stage-review')openStage();if(cmd==='ai-settings')openAISettings();if(['history','now','chart'].includes(cmd))go(cmd);if(cmd==='shuffle-step'){stepShift++;renderNow();main.querySelector('#step-title')?.focus?.();}if(cmd==='add-action')openSimple('add');if(cmd==='add-leg'&&branches.length<6)openSimple('leg-add');if(cmd==='rename-leg')openSimple('leg');if(cmd==='snapshot'&&state.attempts.length)openSimple('snapshot');if(cmd==='edit-goal')openSimple('goal');if(cmd==='export')exportData();if(cmd==='share-export')exportData(false,true);}
  if(globalThis.QibanPlatform&&!globalThis.QibanPlatform.native&&typeof File==='function'&&navigator.share&&navigator.canShare?.({files:[new File(['{}'],'栖伴.json',{type:'application/json;charset=utf-8'})]}))document.querySelector('#web-share-export').hidden=false;
  document.querySelectorAll('[data-view]').forEach(btn=>btn.addEventListener('click',()=>go(btn.dataset.view)));
  window.addEventListener('hashchange',()=>{setView(viewFromHash());render();});
  document.querySelector('.brand').addEventListener('click',()=>go('now'));
  document.querySelector('#more-button').addEventListener('click',()=>{const menu=document.querySelector('#more-menu');menu.hidden=!menu.hidden;document.querySelector('#more-button').setAttribute('aria-expanded',String(!menu.hidden));});
  document.querySelector('#more-menu').addEventListener('click',event=>{const btn=event.target.closest('[data-command]');if(!btn)return;document.querySelector('#more-menu').hidden=true;document.querySelector('#more-button').setAttribute('aria-expanded','false');command(btn.dataset.command);});
  document.addEventListener('click',event=>{if(!event.target.closest('.top-actions')){document.querySelector('#more-menu').hidden=true;document.querySelector('#more-button').setAttribute('aria-expanded','false');}});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'){document.querySelector('#more-menu').hidden=true;document.querySelector('#more-button').setAttribute('aria-expanded','false');}});
  dialog.addEventListener('input',rememberForm);dialog.addEventListener('change',rememberForm);
  window.addEventListener('qiban:back',()=>{if(dialog.open)closeModal();else if(!document.querySelector('#more-menu').hidden){document.querySelector('#more-menu').hidden=true;}else if(view!=='now')go('now');});
  dialog.addEventListener('cancel',event=>{event.preventDefault();closeModal();});
  dialog.addEventListener('click',event=>{
    const btn=event.target.closest('button');if(!btn)return;
    if(btn.dataset.downloadArtifact){downloadArtifact(btn.dataset.downloadArtifact);return;}
    if(btn.dataset.removeArtifact){const d=state.drafts[activeTaskId];if(d){d.artifacts=d.artifacts.filter(a=>a.id!==btn.dataset.removeArtifact);save();renderTaskDialog();}return;}
    if(btn.dataset.actionRestore){QibanActions.restore(state,btn.dataset.actionRestore);persistNotice('放回航线了。');render();renderTaskDialog();return;}
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
    if(cmd==='log-save')saveLogNote();
    if(cmd==='log-skip'){closeModal();toast('船往前走了一点。');}
    if(cmd==='log-add')openLogSheet(activeAttemptId);
    if(cmd==='save-leg'){const name=document.querySelector('#leg-name').value.trim();if(!name){document.querySelector('#leg-name').focus();return;}const b=getBranch(state.branch),outcome=document.querySelector('#leg-outcome').value.trim()||name;b.name=name;b.short=name;b.outcome=outcome;const w=stageWork(b.id);if(!w.closedId)w.outcome=outcome;clearForm();persistNotice('航程改好了。');closeModal();}
    if(cmd==='save-leg-add'){if(branches.length>=6)return;const name=document.querySelector('#leg-name').value.trim();if(!name){document.querySelector('#leg-name').focus();return;}const outcome=document.querySelector('#leg-outcome').value.trim()||name;branches.push({id:'leg-'+uid(),num:String(branches.length+1).padStart(2,'0'),name,short:name,outcome});clearForm();persistNotice('海图上多了一段航程。');closeModal();}
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
    if(cmd==='save-custom'){const title=document.querySelector('#custom-title').value.trim();if(!title){document.querySelector('#custom-title').focus();return;}const task={id:'custom-'+uid(),title,branch:state.branch,kind:'自己的一步',prompt:document.querySelector('#custom-prompt').value.trim()||'这一次，我留下…',custom:true,choices:[]};if(document.querySelector('#custom-kind').value==='artifact'){task.kind='一份成果';task.contract={kind:'artifact',outcome:title,criteria:[{label:'成果内容实现了本次约定',method:'content'},{label:'实际体验符合预期',method:'experience'}]};}state.customTasks.push(task);clearForm();persistNotice('加进航线了。');closeModal();}
    if(cmd==='save-goal'){const title=document.querySelector('#goal-input').value.trim();if(!title){document.querySelector('#goal-input').focus();return;}state.goal=title;QibanHome.resume(state);state.scope=document.querySelector('#scope-input').value.trim();clearForm();persistNotice('这座岛改好了，之前的日志都还在。');closeModal();}
    if(cmd==='save-snapshot')saveSnapshot();
    if(cmd==='export')exportData();

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
    if(cloud&&globalThis.QibanPlatform){
      if(!cloud.requireOnline())throw Error('这项操作需要联网。当前草稿已保留。');
      try{const response=await globalThis.QibanPlatform.request('/api/ai/'+path,{method:payload?'POST':'GET',...(payload?{body:payload}:{})});if(response.status!==200)throw Error(response.data.message||'暂时无法完成请求。');return response.data;}
      catch(error){if(error.name==='TimeoutError'||error.name==='AbortError')throw Error('这次等待有点久，原文已保留，可以稍后重试。');throw error;}
    }
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
    status.hidden=!STATIC_PREVIEW&&!(serviceAvailable&&aiConfig.configured);
    status.querySelector('span').textContent=STATIC_PREVIEW?'界面预览':aiConfig.lastTest?.ok?'AI 已连接':aiConfig.configured?'AI 待验证':'连接 AI';
    status.setAttribute('aria-label',STATIC_PREVIEW?'关于在线预览':'AI 连接设置');
    if(typeof window.dispatchEvent==='function'&&typeof CustomEvent==='function')window.dispatchEvent(new CustomEvent('qiban:ai-config-changed'));

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
  function logFooter(attempt,task){const accepted=state.accepted[task.id]===attempt.id,artifact=attempt.contract?.kind==='artifact';return `<div class="dialog-actions feedback-footer"><span class="${accepted?'accepted-note':'draft-state'}">${accepted?icon('check')+'写进了航线':'第 '+versionNumber(attempt)+' 条，单独留着'}</span><div class="action-buttons">${isArchived()?'':`<button class="secondary-button" data-modal-command="retry">${artifact?'再交一次':'再改一点'}</button>`}<button class="primary-button" data-modal-command="${accepted||isArchived()?'close':'adopt'}">${accepted||isArchived()?'继续航行':'用这一条写进航线'}${icon(accepted?'arrow':'check')}</button></div></div>`;}
  function waitingFeedbackHTML(attempt,task){
    const pending=attempt.aiStatus==='pending',message=pending?'栖栖正在读这一条…':attempt.aiError||attempt.feedback.strength;
    const canAddNote=attempt.quick&&!attempt.text&&!isArchived();
    return `<div class="log-entry-head">${state.accepted[task.id]===attempt.id?'<span class="route-stamp">写进航线</span>':''}<div class="feedback-meta">${formatDate(attempt.createdAt,true)} · 第 ${versionNumber(attempt)} 条${attempt.provenance&&!['扬帆完成','自己写下'].includes(attempt.provenance)?' · '+escape(attempt.provenance):''}</div></div><blockquote class="submission-quote${attempt.text?'':' quiet'}">${attempt.text?escape(attempt.text):'走完了这一程，没写日志。'}</blockquote>${canAddNote?`<button class="text-button log-add" data-modal-command="log-add">${icon('pen')}补一句日志</button>`:''}${evidenceHTML(attempt)}${aiAvailable()&&attempt.text?`<div class="ai-feedback-state" role="status"><div class="${pending?'ai-working':''}">${icon('spark')}<span>${escape(message)}</span></div>${!pending?`<button class="text-button" data-modal-command="retry-feedback">请栖栖读一读${icon('arrow')}</button>`:''}</div>`:''}${logFooter(attempt,task)}`;
  }
  let settingsReturn=null;
  function openAISettings(){
    if(STATIC_PREVIEW){dialog.innerHTML=dialogTop('栖伴 · 在线预览')+'<div class="dialog-body"><h2 id="dialog-title">先看看栖伴。</h2><p class="outing-speech">日志和漂流瓶会留在当前浏览器。AI 反馈和图片上传，可以在本机版里使用。</p><div class="dialog-actions"><a class="text-button" href="https://github.com/ciki-9876/qiban#本机运行" target="_blank" rel="noopener noreferrer">获取本机版 ↗</a><button class="primary-button" data-modal-command="close">继续看看</button></div></div>';openModal('static-preview');return;}
    if(modalMode!=='ai-settings')settingsReturn=activeTaskId?{taskId:activeTaskId,attemptId:activeAttemptId,helpVisible}:null;
    dialog.className='';
    dialog.innerHTML=dialogTop('栖伴 · AI 连接')+`<div class="dialog-body"><h2 id="dialog-title">让栖栖，读懂这一程。</h2><div class="connection-state" id="connection-state" role="status">${serviceAvailable?(aiConfig.lastTest?.ok?'已连接 · '+escape(aiConfig.model):'尚未验证连接'):'本地 AI 服务未连接'}</div><form id="ai-settings-form"><label class="field-label" for="ai-base-url">API 地址</label><input class="text-field" id="ai-base-url" type="url" value="${escape(aiConfig.baseUrl)}" maxlength="600" required autocomplete="off"><label class="field-label" for="ai-model">模型</label><input class="text-field" id="ai-model" value="${escape(aiConfig.model)}" maxlength="200" required autocomplete="off"><label class="field-label" for="ai-key">API Key <small>${aiConfig.keySaved?(cloud?'已保存在自己的账号中':'已保存在本机服务端'):(cloud?'仅用于自己的账号':'仅保存在本机服务端')}</small></label><input class="text-field" id="ai-key" type="password" maxlength="4096" autocomplete="off" placeholder="${aiConfig.keySaved?'已保存，留空沿用':'输入服务商提供的密钥'}"><details class="ai-options"><summary>兼容选项</summary><label class="field-label" for="ai-format">输出格式</label><select class="text-field" id="ai-format">${[['json_object','JSON 模式'],['json_schema','严格 JSON Schema'],['prompt','提示词兼容']].map(([id,label])=>`<option value="${id}" ${aiConfig.format===id?'selected':''}>${label}</option>`).join('')}</select><label class="field-label" for="ai-token-field">长度参数</label><select class="text-field" id="ai-token-field"><option value="max_tokens" ${aiConfig.tokenField==='max_tokens'?'selected':''}>max_tokens</option><option value="max_completion_tokens" ${aiConfig.tokenField==='max_completion_tokens'?'selected':''}>max_completion_tokens</option></select></details><div class="dialog-actions"><button class="text-button" type="button" data-modal-command="ai-settings-back">${icon('back')}${settingsReturn?'回到这一程':'先到这里'}</button><button class="primary-button" id="save-ai-button" type="submit" ${!serviceAvailable?'disabled':''}>保存并测试${icon('spark')}</button></div></form></div>`;
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
  function actionOptions(task){return state.hiddenActions[task.id]?`<div class="task-options"><span class="small-text">这一程先放下了</span><button class="text-button" data-action-restore="${escape(task.id)}">放回航线</button></div>`:state.accepted[task.id]?'':`<div class="task-options">${aiAvailable()?`<button class="text-button" data-modal-command="replace-action">${icon('spark')}让栖栖换一程</button>`:''}<button class="text-button" data-modal-command="skip-action">这一程先不走</button></div>`;}
  function hiddenActionsHTML(branch){const list=allTasks().filter(t=>t.branch===branch&&state.hiddenActions[t.id]);return list.length?`<details class="hidden-actions"><summary>先放下的 · ${list.length}</summary>${list.map(t=>`<div><span>${escape(t.title)}</span><button class="text-button" data-action-restore="${escape(t.id)}">${state.hiddenActions[t.id].replacementId?'撤销替换':'放回'}</button></div>`).join('')}</details>`:'';}
  function skipAction(){const task=getTask(activeTaskId);if(!task)return;QibanActions.hide(state,task);persistNotice('先放下了，可以在海图里放回来。');closeModal();}
  function openReplacement(){const task=getTask(activeTaskId);if(!task)return;state.replacements[task.id] ||= {reason:'',declined:[]};renderReplacement();}
  function renderReplacement(){
    const task=getTask(activeTaskId),w=state.replacements[task.id],busy=w.status==='pending',p=w.proposal;
    dialog.className='';modalMode='replacement';
    dialog.innerHTML=dialogTop('换一条适合自己的路')+`<div class="dialog-body"><h2 id="dialog-title">换一个，试试看。</h2><p class="small-text">${escape(task.title)}</p><div class="replacement-reasons">${['再小一点','换种做法','换个方向'].map(r=>`<button class="choice-chip ${w.reason===r?'chosen':''}" data-replace-reason="${r}" aria-pressed="${w.reason===r}" ${busy?'disabled':''}>${r}</button>`).join('')}</div><input id="replacement-reason" class="text-field" maxlength="300" aria-label="换一程的偏好" placeholder="也可以说说偏好 · 可留空" value="${escape(w.reason||'')}" ${busy?'disabled':''}>${busy?'<p class="stage-working" role="status">栖栖在找另一条小路…</p>':w.error?`<p class="delivery-error" role="status">${escape(w.error)}</p>`:''}${p&&!busy?`<article class="replacement-preview"><h3>${escape(p.title)}</h3><p>${escape(p.why)}</p>${contractHTML(p.contract)}</article>`:''}<div class="dialog-actions"><button class="text-button" data-modal-command="cancel-replacement">先保留原来这一程</button><div class="action-buttons"><button class="${p?'secondary-button':'primary-button'}" data-modal-command="generate-replacement" ${busy?'disabled':''}>${busy?'正在想…':p?'再换一个':'请栖栖换一个'}</button>${p&&!busy?'<button class="primary-button" data-modal-command="use-replacement">就做这个</button>':''}${w.status==='error'||w.status==='interrupted'?'<button class="text-button" data-modal-command="retry-replacement">重试</button>':''}</div></div></div>`;focusDialogTitle();
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
  function applyReplacement(){const old=getTask(activeTaskId),w=state.replacements[old.id];if(!w.proposal||w.status!=='complete')return;const task=QibanActions.replace(state,old,w.proposal,{id:'custom-'+uid(),reason:w.context?.reason||w.reason});if(!task)return;delete state.replacements[old.id];persistNotice('换好了，之前的日志还在。');activeTaskId=task.id;activeAttemptId=null;helpVisible=false;render();renderTaskDialog();}
  function progressHTML(a,task){
    const f=a.feedback,accepted=state.accepted[task.id]===a.id,list=records(a.taskId),prev=list[list.findIndex(x=>x.id===a.id)-1],comparable=prev?.feedback.ratingVersion===f.ratingVersion&&JSON.stringify(prev.contract)===JSON.stringify(a.contract);
    return `<div class="progress-feedback-header"><div><div class="feedback-title">${escape(f.change.summary)}</div><div class="feedback-meta">${formatDate(a.createdAt,true)} · 第 ${versionNumber(a)} 条 · ${escape(f.label)}</div>${f.change.adviceStatus==='applied'?'<span class="advice-followed">'+icon('check')+'上次建议，已回应</span>':''}</div><div class="progress-grade" aria-label="本次评级 ${escape(f.grade)}"><strong>${escape(f.grade)}</strong><small>${f.grade==='A'?'本次已足够':f.grade==='S'?'额外的证据':f.grade==='B'?'有用的一步':f.grade==='C'?'相关的起点':'待确认'}</small></div></div><div class="progress-checks">${f.checks.map((c,i)=>{const from=comparable?prev.feedback.checks[i]?.level:null;return `<details class="progress-check"><summary><span>${escape(c.label)}</span><span class="criterion-level ${c.level}"><i class="level-dots" aria-hidden="true">${[0,1,2].map(n=>`<b class="${n<=['absent','clue','enough'].indexOf(c.level)?'filled':''}"></b>`).join('')}</i>${from&&from!==c.level?escape(levelName[from])+' → ':''}${levelName[c.level]}</span></summary>${c.evidence?`<p>${c.status==='visual'?escape(c.evidence):'「'+escape(c.evidence)+'」'}</p>`:'<p>这次记录里还未找到对应依据。</p>'}${c.source?`<small>${c.status==='self'?'本人确认':c.status==='reported'?'本人描述 · 尚未确认':c.status==='visual'?'AI 图像观察':c.source==='current'?'本次原文':'成果内容'}</small>`:''}</details>`;}).join('')}</div><blockquote class="submission-quote">${escape(a.text)}</blockquote>${evidenceHTML(a)}${f.hint?`<div class="next-improvement">${icon('spark')}<div><small>还差这一点</small><p>${escape(f.hint)}</p></div></div>`:''}${f.comparison&&prev&&/(不直接比较|暂未取得分析|尚未对比文件内容|未访问该地址|未变，不将)/.test(f.comparison)?`<p class="ai-comparison">${escape(f.comparison)}</p>`:''}${task.id==='home-focus'?'<div class="next-action-link"><button class="text-button" data-modal-command="build-decision">拿这版方案，去做出效果 ↗</button></div>':''}${logFooter(a,task)}`;
  }

  let activeStageId=null;
  const stageWork=id=>QibanStages.current(state,getBranch(id));
  const stageKey=id=>JSON.stringify({goal:state.goal,declined:QibanActions.declined(state,id),outcome:stageWork(id).outcome,records:state.attempts.filter(a=>a.branch===id).map(a=>[a.id,a.aiStatus,a.feedback]),adopted:[...new Set(state.attempts.filter(a=>a.branch===id).map(a=>a.taskId))].map(id=>[id,state.accepted[id]||null])});
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
    return `<div class="stage-verdict"><span class="stage-grade">${escape(r.grade)}</span><div><small>栖栖建议</small><h3>${r.recommendation==='advance'?'可以驶向下一段了':'先补一处，再往前走'}</h3><p>${escape(r.reason)}</p></div></div><details class="stage-evidence"><summary>判断依据</summary>${r.findings.map(f=>`<div class="stage-finding"><span class="stage-finding-status">${{met:'已有依据',gap:'仍有缺口',unknown:'待确认'}[f.status]}</span><strong>${escape(f.label)}</strong><p>${escape(f.detail)}</p><div>${f.sources.map(id=>id==='user'?'<span class="small-text">本人的讨论记录</span>':`<button class="text-button" data-stage-evidence="${escape(id)}">${escape(review.context.records.find(a=>a.id===id)?.title||'日志')} ↗</button>`).join('')}</div></div>`).join('')}</details>${!archived&&r.suggestions.length?`<div class="stage-suggestions">${r.suggestions.map((s,i)=>`<article><small>${s.kind==='gap'?'建议先做':'以后也可以'}</small><h3>${escape(s.title)}</h3><p>${escape(s.why)}</p><button class="text-button" data-stage-suggestion="${i}" data-review-id="${escape(review.id)}" ${stageWork(activeStageId).addedSuggestions[review.id+':'+i]?'disabled':''}>${stageWork(activeStageId).addedSuggestions[review.id+':'+i]?'已加进航线':'加这一程'}${icon('plus')}</button></article>`).join('')}</div>`:''}${r.question&&!archived?`<p class="stage-question">${escape(r.question)}</p>`:''}`;
  }
  function renderStage(){
    const id=activeStageId,w=stageWork(id),last=w.reviews.at(-1),busy=last?.status==='pending',current=last?.status==='complete'&&last.key===stageKey(id),b=getBranch(id),i=branches.indexOf(b);
    const ts=allTasks().filter(t=>t.branch===id&&!state.hiddenActions[t.id]),done=ts.filter(t=>state.accepted[t.id]).length,logs=state.attempts.filter(a=>a.branch===id).length,ai=aiAvailable();
    dialog.className='stage-dialog';dialog.innerHTML=dialogTop(`第 ${i+1} 段航程 · ${escape(b.name)}`)+`<div class="dialog-body"><div class="stage-buoy">${QibanVoyage.buoy({size:44,current:true})}</div><h2 id="dialog-title">这段航程，走到哪里了？</h2><p class="stage-summary">记下 ${logs} 条日志，${done} / ${ts.length} 程写进了航线。</p>${w.round>1?`<p class="small-text">这是这段航程的第 ${w.round} 轮。</p>`:''}<details class="stage-outcome"><summary>这段航程想抵达的地方</summary><textarea id="stage-outcome" class="text-field" maxlength="400" aria-label="这段航程想抵达的地方" ${busy?'disabled':''}>${escape(w.outcome)}</textarea><button class="text-button" data-stage-command="outcome" ${busy?'disabled':''}>改好了</button></details>${ai||w.reviews.length?`${current?stageReviewHTML(last):busy?'<p class="stage-working" role="status">栖栖正在回看这段航程…</p>':ai?`<p class="stage-working" role="status">${escape(last?.error|| (last?.status==='complete'?'日志或目标有变化，可以请栖栖重新看看。':'想听听栖栖的看法，可以请它回看这段航程。'))}</p>`:''}
      ${w.reviews.length?`<details class="stage-discussion"><summary>之前的讨论 · ${w.reviews.length}</summary>${w.reviews.map(r=>`<article>${r.message?`<p><small>我</small>${escape(r.message)}</p>`:''}${r.result?`<p><small>栖栖 · ${r.result.grade}</small>${escape(r.result.reason)}</p>`:`<p class="small-text">${r.status==='pending'?'正在回顾':escape(r.error||'这次讨论还没有返回')}</p>`}</article>`).join('')}</details>`:''}
      ${ai?`<div class="stage-reply"><textarea id="stage-message" class="text-field" maxlength="1500" aria-label="和栖栖聊聊这段航程" placeholder="我觉得…" ${busy?'disabled':''}>${escape(w.message||'')}</textarea><button class="secondary-button" data-stage-command="discuss" ${busy?'disabled':''}>${busy?'正在回看…':current?'继续聊聊':'请栖栖看看'}${icon('spark')}</button>${last&&['error','interrupted'].includes(last.status)?'<button class="text-button" data-stage-command="retry">重试上次讨论</button>':''}</div>`:''}`:''}${ai?'':'<p class="small-text stage-plain">觉得这段可以了，就过这个浮标。之后想回来，随时可以再走一轮。</p>'}<div class="dialog-actions"><button class="text-button" data-modal-command="close">先到这里</button><button class="primary-button" data-stage-command="finish" ${busy?'disabled':''}>过这个浮标${icon('check')}</button></div></div>`;
    modalMode='stage';restoreForm('stage');focusDialogTitle();
  }
  async function requestStage(retry=false){
    const id=activeStageId,w=stageWork(id);if(w.closedId||w.reviews.some(r=>r.status==='pending'))return;
    if(!serviceAvailable||!aiConfig.configured){toast('先连接 AI，也可以直接过浮标。');return;}
    const owner=state;let review=retry?w.reviews.at(-1):null;
    if(!review){const message=w.message||'';review={id:'stage-'+uid(),key:stageKey(id),message,context:stageContext(id,message),createdAt:new Date().toISOString()};w.reviews.push(review);w.message='';}
    review.status='pending';delete review.error;save();renderStage();
    try{const out=await api('stage',{requestId:review.id,context:review.context});if(state!==owner||state.stageWork[id]!==w)return;review.status='complete';review.result=out.result;review.meta=out.meta;}
    catch(e){if(state!==owner||state.stageWork[id]!==w)return;review.status='error';review.error=e.message;}
    finally{if(state===owner&&state.stageWork[id]===w){save();if(dialog.open&&modalMode==='stage'&&activeStageId===id)renderStage();}}
  }
  function finishStage(){
    const id=activeStageId,w=stageWork(id),last=w.reviews.at(-1);const review=last?.status==='complete'&&last.key===stageKey(id)?last:null;
    const round=QibanStages.close(state,getBranch(id),{id:'round-'+uid(),at:new Date().toISOString(),review,revisionKey:stageKey(id)});clearForm();persistNotice('过了这个浮标。');render();openStageRound(round.id,{celebrate:true});
  }
  function stageGradeBadge(branch){
    const round=state.stageRounds.filter(r=>r.branchId===branch.id).at(-1);if(!round||!round.grade||round.grade==='—')return '';
    return `<span class="branch-grade" aria-label="栖栖的评价 ${escape(round.grade)}" title="栖栖的评价"><strong>${escape(round.grade)}</strong></span>`;
  }
  function completionHTML(r,recap){
    return `<section class="stage-completion" aria-label="过浮标纪念"><div class="completion-portrait" aria-hidden="true"><span class="completion-orbit"></span>${QibanVoyage.buoy({passed:true,size:92})}<span class="completion-star star-one">✧</span><span class="completion-star star-two">✦</span><span class="completion-star star-three">✧</span></div><div class="completion-kicker">${escape(r.branchName)}${r.round>1?` · 第 ${r.round} 轮`:''}</div><h2 id="dialog-title">过了这个浮标。</h2><p class="completion-companion">${recap.total?'这段航程的每一条日志，都在这里。':'这个浮标，也记进了日志。'}</p>${r.grade&&r.grade!=='—'?`<div class="completion-seal" aria-label="栖栖的评价 ${escape(r.grade)}"><strong>${escape(r.grade)}</strong><span>栖栖的评价</span></div>`:''}<div class="completion-tally">${recap.total?`<span><b>${recap.newCount}</b> 条${recap.previous?'新':''}日志</span><i></i><span><b>${recap.adopted.length}</b> 程写进航线</span>`:'<span>这段航程的讨论已经记下</span>'}</div>${recap.highlights.length?`<div class="completion-keepsakes">${recap.highlights.map(a=>`<button class="completion-keepsake" data-stage-evidence="${escape(a.id)}">${icon('check')}${escape(a.taskTitle)}</button>`).join('')}</div>`:''}<div class="completion-date">${formatDate(r.closedAt)} · 已记进日志</div></section>`;
  }
  function openStageRound(id,{celebrate=false}={}){
    const r=state.stageRounds.find(r=>r.id===id);if(!r)return;activeStageId=r.branchId;activeTaskId=null;activeAttemptId=null;
    const next=branches[branches.findIndex(b=>b.id===r.branchId)+1],recap=QibanStages.recap(state,r);dialog.className='stage-dialog completion-dialog'+(celebrate?' celebrating':'');
    dialog.innerHTML=dialogTop('栖栖 · 过浮标')+`<div class="dialog-body">${completionHTML(r,recap)}<div class="completion-actions">${!isArchived()&&QibanProjects.stats(state).ready?`<button class="primary-button" data-project-command="archive">准备靠岸${icon('arrow')}</button>`:!isArchived()&&next?`<button class="primary-button" data-stage-go="${next.id}">驶向下一段：${escape(next.name)}${icon('arrow')}</button>`:''}<button class="secondary-button" data-modal-command="close">今天先到这里</button></div><details class="completion-details"><summary>回看这段航程</summary><p class="stage-closed-goal">${escape(r.outcome)}</p>${recap.comparison?`<div class="completion-comparison"><div><small>最初记下</small><p>${escape(recap.comparison.first.text)}</p></div><div><small>写进航线的</small><p>${escape(recap.comparison.last.text)}</p></div></div>`:''}${r.review?stageReviewHTML(r.review,true):'<p class="small-text">这个浮标由你确认通过。</p>'}<details class="stage-evidence"><summary>当时的日志 · ${r.evidence.length} 条</summary>${r.evidence.map(a=>`<article><button class="text-button" data-stage-evidence="${escape(a.id)}">${escape(a.taskTitle)}${a.adopted?' · 写进航线':''} ↗</button><p>${escape(a.text||'走完了这一程，没写日志。')}</p></article>`).join('')}</details><details class="stage-discussion"><summary>这段航程的讨论</summary>${r.discussion.map(d=>`<article>${d.message?`<p>${escape(d.message)}</p>`:''}<p>${escape(d.result?.reason||d.error||'未取得反馈')}</p></article>`).join('')}</details></details><div class="completion-extra"><button class="text-button" data-stage-replay="${escape(r.id)}">再看这一刻${icon('spark')}</button><details ${isArchived()?'hidden':''}><summary>换条航线</summary><button class="text-button" data-stage-command="reopen">这段航程再走一轮</button>${branches.filter(b=>b.id!==r.branchId&&b.id!==next?.id).map(b=>`<button class="text-button" data-stage-go="${b.id}">第 ${branches.indexOf(b)+1} 段 · ${escape(b.name)}</button>`).join('')}</details></div></div>`;
    openModal('stage-round');focusDialogTitle();
  }
  function renderStageRounds(){return [...state.stageRounds].reverse().map(r=>`<article class="snapshot-card buoy-card"><span class="snapshot-number">${QibanVoyage.buoy({passed:true,size:16})}过浮标 · ${escape(r.branchName)}${r.round>1?' · 第 '+r.round+' 轮':''}${r.grade&&r.grade!=='—'?' · '+escape(r.grade):''}</span><h2>${escape(r.review?.result.summary||'这段航程，走完了')}</h2><div class="entry-info">${formatDate(r.closedAt,true)}</div><blockquote>${escape(r.outcome)}</blockquote><button class="text-button" data-stage-round="${escape(r.id)}">${isArchived()?'回看':'回看与继续'}${icon('arrow')}</button></article>`).join('');}
  dialog.addEventListener('input',e=>{if(e.target.id==='stage-message'){stageWork(activeStageId).message=e.target.value;save();}});
  dialog.addEventListener('click',e=>{
    const b=e.target.closest('button');if(!b)return;
    if(b.dataset.stageReplay){openStageRound(b.dataset.stageReplay,{celebrate:true});return;}
    if(b.dataset.stageEvidence){const a=getAttempt(b.dataset.stageEvidence);if(a)openTask(a.taskId,a.id);return;}
    if(b.dataset.stageGo){QibanHome.resume(state);state.branch=b.dataset.stageGo;doneOnly=false;save();closeModal();go('now');return;}
    if(b.dataset.stageSuggestion!==undefined){const w=stageWork(activeStageId),r=w.reviews.find(r=>r.id===b.dataset.reviewId),i=Number(b.dataset.stageSuggestion),s=r?.result.suggestions[i],key=r?.id+':'+i;if(!s||w.closedId||w.addedSuggestions[key])return;const existing=allTasks().find(t=>t.branch===activeStageId&&t.title===s.title&&!state.hiddenActions[t.id]);const id=existing?.id||'custom-'+uid();if(!existing)state.customTasks.push({id,title:s.title,branch:activeStageId,kind:s.contract?.kind==='artifact'?'一份成果':'自己的一步',prompt:s.prompt,custom:true,choices:[],...(s.contract?{contract:clone(s.contract)}:{}),fromStageReview:r.id});w.addedSuggestions[key]=id;persistNotice('这一程，加进航线了。');render();openTask(id);return;}
    const cmd=b.dataset.stageCommand;if(cmd==='discuss')requestStage();if(cmd==='retry')requestStage(true);if(cmd==='finish')finishStage();
    if(cmd==='outcome'){const el=dialog.querySelector('#stage-outcome'),v=el.value.trim();if(!v){el.focus();return;}stageWork(activeStageId).outcome=v;save();clearForm();renderStage();}
    if(cmd==='reopen'){QibanStages.reopen(state,getBranch(activeStageId));save();render();openStage(activeStageId);}
  });

  const onlineResearch=globalThis.QibanOnlineResearch?.create({state:()=>state,main,dialog,escape,save,render,readOnly:isArchived,enabled:()=>!STATIC_PREVIEW&&(Boolean(cloud)||serviceAvailable),request:research=>api('assist',{research}),openAISettings});
  home=QibanHomeUI.create({
    research:onlineResearch,state:()=>state,tasks:allTasks,get branches(){return branches;},readOnly:isArchived,projectKey:()=>state.id,escape,icon,main,dialog,dialogTop,save,render,closeModal,openLibrary:()=>go('outings'),showNow:()=>go('now'),
    openModal:mode=>{activeTaskId=null;activeAttemptId=null;dialog.className='';openModal(mode);},
    openAttempt:id=>{const a=getAttempt(id);if(a)openTask(a.taskId,a.id);},
    openTask:id=>openTask(id),openRound:id=>openStageRound(id),
    addReturnTrial:tripId=>{
      const task={id:'custom-'+uid(),branch:state.branch,title:'选一下：这次回来，感觉怎么样',kind:'一个选择',prompt:'这次回来，我觉得…',custom:true,choices:['知道上次做到哪了','看懂了，但还不想继续','还是不知道下一步做什么'],prefix:'这次回来，我觉得：',sourceTripId:tripId,contract:{kind:'decision',outcome:'留下一句这次回来的真实感受',criteria:[{label:'说出这次回来的真实感受，选一句也可以',method:'content'}]}};
      state.customTasks.push(task);return task;
    }
  });
  if(!storageFailed&&!isArchived()){QibanHome.visit(state);saveVisit();}
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')cancelHold();if(document.visibilityState==='visible')QibanMoon.theme.apply();if(document.visibilityState==='hidden'&&!storageFailed&&!isArchived()){QibanHome.touch(state);saveVisit();}});
  window.addEventListener('pagehide',()=>{if(!storageFailed&&!isArchived()){QibanHome.touch(state);saveVisit();}});
  for(const w of Object.values(state.replacements))if(w.status==='pending'){w.status='interrupted';w.error='上次的候选还没取回，可以重试。';}
  for(const w of Object.values(state.stageWork))for(const r of w.reviews)if(r.status==='pending'){r.status='interrupted';r.error='上次讨论尚未取回，可以重试。';}
  for(const attempt of state.attempts){if(attempt.aiStatus==='pending'){attempt.aiStatus='interrupted';attempt.feedback=pendingFeedback('上次的反馈还没取回，原文已经保留。');}}
  render();
  globalThis.QibanUpdates?.ready?.();
  refreshAIConfig();
  if(storageFailed){document.querySelector('#saved-state').innerHTML='<i></i>本机记录读取异常';toast('本机记录未能读取。原记录尚未改动。');}
})();
