(function(root){
  const copy=v=>JSON.parse(JSON.stringify(v));
  function ensure(s){s.hiddenActions ||= {};s.actionChoices ||= [];s.replacements ||= {};return s;}
  function hide(s,task,{at=new Date().toISOString(),reason='',replacementId=null}={}){
    ensure(s);if(s.hiddenActions[task.id])return;
    s.hiddenActions[task.id]={at,reason,replacementId};
    s.actionChoices.push({taskId:task.id,title:task.title,branch:task.branch,at,reason,replacementId,type:replacementId?'replace':'skip'});
  }
  function restore(s,id){
    ensure(s);const old=s.hiddenActions[id];if(!old)return;
    // Undo the candidate selection while retaining all drafts, attempts and snapshots.
    if(old.replacementId){const t=s.customTasks.find(t=>t.id===old.replacementId);if(t)hide(s,t,{reason:'撤销替换'});}
    delete s.hiddenActions[id];s.actionChoices.push({taskId:id,type:'restore',at:new Date().toISOString()});
  }
  function replace(s,old,proposal,{id,at=new Date().toISOString(),reason=''}={}){
    ensure(s);if(s.hiddenActions[old.id]||s.customTasks.some(t=>t.id===id))return null;
    const task={id,branch:old.branch,title:proposal.title,prompt:proposal.prompt,contract:copy(proposal.contract),kind:proposal.contract.kind==='artifact'?'一份成果':'自己的一步',choices:[],custom:true,replaces:old.id};
    s.customTasks.push(task);hide(s,old,{at,reason,replacementId:id});return task;
  }
  function reject(s,branch,proposal,reason){ensure(s);s.actionChoices.push({type:'reject-candidate',branch,title:proposal.title,reason,at:new Date().toISOString()});}
  function declined(s,branch){ensure(s);return s.actionChoices.filter(e=>e.branch===branch&&(e.type==='reject-candidate'||s.hiddenActions[e.taskId])).slice(-20).map(e=>({title:e.title,reason:e.reason||'暂不想做'}));}
  root.QibanActions={ensure,hide,restore,replace,reject,declined};
})(globalThis);
