/* Pure state transitions shared by the browser and regression tests. */
(function(root){
  const copy=v=>JSON.parse(JSON.stringify(v));
  function ensure(state){state.stageWork ||= {};state.stageRounds ||= [];return state;}
  function current(state,branch){ensure(state);return state.stageWork[branch.id] ||= {round:state.stageRounds.filter(r=>r.branchId===branch.id).length+1,outcome:branch.outcome,startedAt:new Date().toISOString(),reviews:[],message:'',addedSuggestions:{},closedId:null};}
  function evidence(state,branchId){return state.attempts.filter(a=>a.branch===branchId).map(a=>({...copy(a),adopted:state.accepted[a.taskId]===a.id}));}
  function close(state,branch,{id,at,review,revisionKey}){
    const w=current(state,branch);if(w.closedId)return state.stageRounds.find(r=>r.id===w.closedId);
    if(w.reviews.some(r=>r.status==='pending'))throw Error('阶段讨论还在进行。');
    const round={id,branchId:branch.id,branchName:branch.name,round:w.round,goal:state.goal,outcome:w.outcome,startedAt:w.startedAt,closedAt:at,grade:review?.result.grade||'—',recommendation:review?.result.recommendation||null,review:review?copy(review):null,discussion:copy(w.reviews),evidence:evidence(state,branch.id),revisionKey,closedBy:'user'};
    state.stageRounds.push(round);w.closedId=id;return round;
  }
  function reopen(state,branch){const w=current(state,branch);if(!w.closedId)return w;const next={round:w.round+1,outcome:w.outcome,startedAt:new Date().toISOString(),reviews:[],message:'',addedSuggestions:{},closedId:null};state.stageWork[branch.id]=next;return next;}
  function recap(state,round){
    const before=state.stageRounds.slice(0,state.stageRounds.findIndex(r=>r.id===round.id));
    const previous=before.filter(r=>r.branchId===round.branchId).at(-1)||null;
    const priorIds=new Set((previous?.evidence||[]).map(a=>a.id));
    const adopted=round.evidence.filter(a=>a.adopted);
    const highlights=adopted.slice(-3);
    let comparison=null;
    for(const last of adopted){const first=round.evidence.find(a=>a.taskId===last.taskId);if(first&&first.id!==last.id&&first.text!==last.text){comparison={first,last};break;}}
    return {previous,total:round.evidence.length,newCount:round.evidence.filter(a=>!priorIds.has(a.id)).length,adopted,highlights,comparison};
  }
  root.QibanStages={ensure,current,evidence,close,reopen,recap};
})(globalThis);
