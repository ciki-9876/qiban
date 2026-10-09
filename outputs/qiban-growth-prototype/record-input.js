/* Preserve old drafts while keeping writing and personal experience in one place. */
(function(root){
  function unify(draft={}){
    if(draft.inputVersion===2)return {...draft};
    const text=draft.text||'', observation=draft.observation||'';
    const combined=observation.trim()&&!text.includes(observation.trim())?[text,observation].filter(Boolean).join('\n\n'):text;
    return {...draft,text:combined,inputVersion:2};
  }
  function observation(draft={}){return draft.confirmed?.length?unify(draft).text.trim():'';}
  root.QibanRecordInput={unify,observation};
})(globalThis);
