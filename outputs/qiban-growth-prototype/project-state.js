/* Goal workspaces: one persisted envelope, independent records per project. */
(function(root){
  const copy=v=>JSON.parse(JSON.stringify(v));
  const valid=s=>s&&s.schema===1&&typeof s.goal==='string'&&Array.isArray(s.attempts)&&Array.isArray(s.snapshots)&&Array.isArray(s.customTasks)&&s.drafts&&s.accepted;
  function normalize(s,seed,id){
    if(!valid(s))throw Error('目标记录格式不完整，请先导出原始记录。');
    const p={...seed,...s,id:s.id||id,status:s.status||'active',branches:copy(s.branches||seed.branches),tasks:copy(s.tasks||seed.tasks),closures:s.closures||[]};
    if(!p.id||!['active','completed','shelved'].includes(p.status)||!p.branches?.length||!Array.isArray(p.tasks))throw Error('目标记录无法读取。');
    return p;
  }
  function load(raw,seed){
    if(raw?.schema===2){
      if(!Array.isArray(raw.projects)||!raw.projects.length)throw Error('目标列表无法读取。');
      const projects=raw.projects.map(p=>normalize(p,seed,p.id));
      if(new Set(projects.map(p=>p.id)).size!==projects.length||!projects.some(p=>p.id===raw.selectedId))throw Error('目标编号有冲突。');
      return {...raw,projects};
    }
    const p=normalize(raw||seed,seed,'project-original');
    return {schema:2,selectedId:p.id,projects:[p]};
  }
  function stats(p){
    const milestones=p.branches.map(b=>({id:b.id,name:b.name,round:p.stageWork[b.id]?.round||1,closedId:p.stageWork[b.id]?.closedId||null,grade:p.stageRounds.find(r=>r.id===p.stageWork[b.id]?.closedId)?.grade||'—'}));
    return {milestones,closed:milestones.filter(b=>b.closedId).length,total:milestones.length,attempts:p.attempts.length,adopted:Object.keys(p.accepted).length,ready:milestones.every(b=>b.closedId)};
  }
  function archive(p,{id,at,note='',status='completed'}){
    if(p.status!=='active')return p.closures.at(-1);
    if(!['completed','shelved'].includes(status))throw Error('请选择完成或暂存。');
    if(Object.values(p.stageWork).some(w=>w.reviews?.some(r=>r.status==='pending')))throw Error('请等这次讨论结束再收尾。');
    const receipt={id,at,note:note.trim(),status,goal:p.goal,stats:copy(stats(p)),attemptIds:p.attempts.map(a=>a.id),stageRoundIds:p.stageRounds.map(r=>r.id)};
    p.closures.push(receipt);p.status=status;p.archivedAt=at;return receipt;
  }
  function reopen(p){p.status='active';delete p.archivedAt;return p;}
  function create({id,goal,scope='',plan,at}){
    if(!id||!goal.trim()||goal.trim().length>120||scope.length>100||!Array.isArray(plan)||!plan.length||plan.length>6)throw Error('请留下一个目标和至少一个阶段。');
    const branches=[],tasks=[];
    plan.forEach((b,i)=>{
      if(!b.name?.trim()||!b.outcome?.trim()||!b.actions?.length)throw Error('每个阶段需要一个落点和一个行动。');
      const branch='stage-'+(i+1);branches.push({id:branch,num:String(i+1).padStart(2,'0'),name:b.name,short:b.name,outcome:b.outcome});
      b.actions.forEach((a,j)=>tasks.push({id:id+'-action-'+i+'-'+j,branch,title:a.title,kind:'自己的一步',prompt:a.prompt||'这一次，我留下…',choices:[],custom:true,contract:copy(a.contract||{kind:'decision',outcome:a.title,criteria:[{label:'留下一次与这一步有关的真实尝试',method:'content'}]})}));
    });
    return {schema:1,id,status:'active',goal:goal.trim(),scope:scope.trim(),branch:branches[0].id,branches,tasks,closures:[],drafts:{},contracts:{},attempts:[],accepted:{},customTasks:[],snapshots:[],adoptions:[],stageWork:{},stageRounds:[],createdAt:at};
  }
  root.QibanProjects={load,stats,archive,reopen,create};
})(globalThis);
