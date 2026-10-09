(() => {
  'use strict';
  const P=globalThis.QibanPlatform,KEY='qiban.growth.prototype.v1',VISIT='qiban.growth.visits.v1',values=new Map();
  let account,revision=0,pending=null,running=false,timer,conflict=false,connected=true,error='',localError='',persisting=Promise.resolve(),forms={},exported=false,locked=false;
  const $=s=>document.querySelector(s),online=()=>!locked&&navigator.onLine!==false&&connected;
  const sessionError=()=>Object.assign(Error('账号会话已变化，请重新登录原账号恢复草稿。'),{code:'ACCOUNT_CHANGED'});
  function lockSession(message='账号会话已变化，请重新登录原账号恢复草稿。'){
    if(locked)return;
    const id=account?.accountId,copy=id&&(values.has(KEY)||Object.keys(forms).length)?JSON.parse(JSON.stringify(snapshot())):null;
    locked=true;clearTimeout(timer);connected=false;conflict=true;
    // Hide every old-account entry point before waiting for storage or navigation.
    const section=document.createElement('section');section.id='cloud-session-locked';section.setAttribute('role','alert');
    const title=document.createElement('h2');title.textContent='请重新登录自己的账号。';
    const text=document.createElement('p');text.textContent=message+' 原账号已保存的本机草稿会在重新登录后恢复。';
    const login=document.createElement('button');login.textContent='回到登录';login.onclick=P.goLogin;section.append(title,text,login);document.body.replaceChildren(section);
    if(copy)persisting=persisting.then(()=>P.cache.write(id,copy)).catch(()=>false);
    values.clear();forms={};pending=null;
    // Never erase or relabel the previous account cache on session expiry/change.
    persisting.then(()=>P.goLogin(),()=>P.goLogin());
  }
  function sessionFailure(value){return value?.status===401||value?.code==='ACCOUNT_CHANGED'||value?.data?.code==='ACCOUNT_CHANGED';}
  function guardWorkspace(response){
    if(sessionFailure(response)||response?.status===200&&response.data?.accountId!==account?.accountId){lockSession();return false;}
    return !locked;
  }
  function renderStatus(){if(locked)return;const el=$('#saved-state');if(!el)return;el.textContent=localError?'本机保存异常':conflict?'尚未同步':pending||running?online()?'正在同步':'已保存到本机':Object.keys(forms).length?'已保存到本机':'已同步到账号';el.title=localError||error||(pending?'联网后同步到自己的账号':'记录保存在自己的账号中');}
  function snapshot(){return {revision,workspace:values.has(KEY)?JSON.parse(values.get(KEY)):null,values:values.has(VISIT)?{[VISIT]:values.get(VISIT)}:{},dirty:Boolean(pending),forms,updatedAt:Date.now()};}
  function persist(){
    if(locked||!account)return Promise.resolve(false);
    const id=account.accountId,copy=JSON.parse(JSON.stringify(snapshot()));
    persisting=persisting.then(()=>P.cache.write(id,copy)).then(()=>{if(locked)return false;localError='';renderStatus();return true;}).catch(()=>{if(locked)return false;localError='本机存储无法写入，当前文字还在本页面，请先导出再关闭。';notice(localError);return false;});
    return persisting;
  }
  async function backup(){
    if(locked)throw sessionError();
    if(!values.has(KEY))return;
    await P.saveBlob(new Blob([JSON.stringify({workspace:JSON.parse(values.get(KEY)),forms},null,2)],{type:'application/json'}),'栖伴-未同步记录.json',{share:false});if(!locked)exported=true;
  }
  function notice(message){
    if(locked)return;
    error=message;let el=$('#cloud-notice');if(!el){el=document.createElement('div');el.id='cloud-notice';el.setAttribute('role','status');document.body.append(el);}
    el.replaceChildren();const text=document.createElement('span');text.textContent=message;el.append(text);
    if(values.has(KEY)){const button=document.createElement('button');button.textContent='导出未同步记录';button.onclick=()=>backup().catch(()=>notice('导出尚未完成，当前草稿仍保留。'));el.append(button);}
    if(conflict){const reload=document.createElement('button');reload.textContent='先导出，再载入云端版本';reload.onclick=async()=>{
      if(locked)return;if(!exported){notice('请先完成草稿导出，再载入云端版本。');return;}
      try{const r=await P.request('/api/workspace');if(!guardWorkspace(r))return;if(r.status!==200)throw Error(r.data.message);revision=r.data.revision;values.clear();forms={};if(r.data.workspace)values.set(KEY,JSON.stringify(r.data.workspace));pending=null;conflict=false;await persist();if(!locked)location.reload();}catch(e){notice(e.message||'云端版本暂时无法读取。');}
    };el.append(reload);}
    if(conflict&&/登录|页面已更新/.test(message)){const login=document.createElement('button');login.textContent='重新登录，恢复草稿';login.onclick=P.goLogin;el.append(login);}
    renderStatus();
  }
  function startupFailure(cause){
    const main=$('#main')||document.body,section=document.createElement('section');section.id='cloud-startup-error';section.setAttribute('role','alert');
    const title=document.createElement('h2');title.textContent='栖伴暂时还没准备好。';
    const message=document.createElement('p');message.textContent=cause.message||'登录初始化暂时无法完成，请重试。';
    const retry=document.createElement('button');retry.textContent='重试初始化';retry.onclick=()=>location.reload();
    const login=document.createElement('button');login.textContent='回到登录';login.onclick=P.goLogin;
    section.append(title,message,retry,login);main.replaceChildren(section);$('#cloud-notice')?.remove();
  }
  function restore(record){
    if(!record)return;
    revision=record.revision||0;forms=record.forms||{};
    if(record.workspace)values.set(KEY,JSON.stringify(record.workspace));
    if(record.values?.[VISIT])values.set(VISIT,record.values[VISIT]);
    pending=record.dirty?values.get(KEY)||null:null;
  }
  async function reconnect(){
    if(locked||!account||navigator.onLine===false)return;
    try{
      const r=await P.request('/api/account',{timeout:15000});
      if(locked)return;if(sessionFailure(r)){lockSession();return;}
      if(r.status!==200)throw Error();
      if(r.data.accountId!==account.accountId){lockSession();return;}
      account=r.data;P.setAccount(account);connected=true;
      if(!conflict){error='';$('#cloud-notice')?.remove();await flush();}
    }catch(e){if(locked)return;if(sessionFailure(e)){lockSession();return;}connected=false;notice('连接暂时中断，草稿会保存在本机。');}
  }
  async function flush(){
    clearTimeout(timer);if(locked||running||!pending||conflict||navigator.onLine===false)return;
    running=true;renderStatus();const raw=pending;
    try{
      await persisting;if(locked)return;
      const r=await P.request('/api/workspace',{method:'POST',body:{revision,workspace:JSON.parse(raw)},timeout:15000});
      if(!guardWorkspace(r))return;
      if(r.status!==200){if([403,409,413].includes(r.status))conflict=true;throw Error(r.data.message||'同步失败。');}
      connected=true;revision=r.data.revision;if(pending===raw)pending=null;error='';exported=false;$('#cloud-notice')?.remove();await persist();
    }catch(e){if(locked)return;if(sessionFailure(e)){lockSession();return;}if(!conflict)connected=false;await persist();notice(conflict?(e.message+' 当前改动已留在本机，请先导出。'):'连接暂时中断，草稿会保存在本机，正在重试。');}
    finally{running=false;renderStatus();if(!locked&&pending&&!conflict)timer=setTimeout(flush,error?5000:0);}
  }
  const storage={getItem:k=>locked?null:values.get(k)??null,setItem(k,value){
    if(locked)return;
    if(![KEY,VISIT].includes(k))return;
    if(k===KEY)JSON.parse(value);values.set(k,String(value));exported=false;
    if(k===KEY){pending=String(value);clearTimeout(timer);timer=setTimeout(flush,400);}
    persist();renderStatus();
  }};
  function menu(){
    const target=$('#more-menu');if(!target)return;
    const label=document.createElement('div');label.className='cloud-account';label.textContent='账号：'+account.username;target.prepend(label);
    const logout=document.createElement('button');logout.textContent='退出账号';logout.addEventListener('click',async()=>{
      await flush();await persisting;if(locked)return;if(running||localError||((pending||conflict||Object.keys(forms).length)&&!exported)){notice('还有记录未同步，请先导出或等待同步完成，再退出。');return;}
      try{await P.logout();if(locked)return;if(!P.native){await P.cache.delete(account.accountId);await P.cache.forget();}values.clear();P.goLogin();}catch(e){if(sessionFailure(e)){lockSession();return;}notice('暂时无法退出，请稍后再试。');}
    });target.append(logout);
    if(!P.native){const install=document.createElement('button');install.textContent='安装到桌面';install.onclick=async()=>{
      if(globalThis.QibanInstallPrompt){await globalThis.QibanInstallPrompt.prompt();globalThis.QibanInstallPrompt=null;}
      else notice('iPhone：在 Safari 分享菜单选择“添加到主屏幕”。安卓或电脑：在浏览器菜单中选择“安装应用”或“添加到桌面”。');
    };target.append(install);}
  }
  const ready=(async()=>{
    if(document.readyState==='loading')await new Promise(resolve=>document.addEventListener('DOMContentLoaded',resolve,{once:true}));
    try{
      let r;
      try{r=await P.request('/api/account',{timeout:15000});}catch(e){if(sessionFailure(e)||P.native&&String(e.code||'').startsWith('NATIVE_'))throw e;connected=false;}
      if(sessionFailure(r)){lockSession();throw sessionError();}
      if(r&&r.status!==200)throw Error(r.data.message||'账号暂时无法读取。');
      if(r){
        account=r.data;if(!await P.claimAccount(account.accountId))throw Error('此账号已在另一个窗口编辑，请关闭那个窗口后重开；请使用支持本机存储的主流浏览器。');P.setAccount(account);let cached=null;
        try{cached=await P.cache.read(account.accountId);}catch(e){if(P.native)throw e;localError='本机草稿存储不可用，请先导出再关闭。';}
        const current=await P.request('/api/workspace',{timeout:15000}).catch(e=>{if(sessionFailure(e))throw e;return null;});
        if(!guardWorkspace(current))throw sessionError();
        if(current?.status===200){
          await P.cache.remember(account);if(locked)throw sessionError();
          if(cached?.dirty){restore(cached);if(revision!==current.data.revision){conflict=true;notice('另一个设备已保存新内容。当前草稿已恢复，请先导出再选择云端版本。');}}
          else {revision=current.data.revision;if(current.data.workspace)values.set(KEY,JSON.stringify(current.data.workspace));forms=cached?.forms||{};if(cached?.values?.[VISIT])values.set(VISIT,cached.values[VISIT]);}
        }else if(cached?.workspace){restore(cached);connected=false;notice('暂时无法连接，已恢复本机内容。当前文字修改会留在本机。');}
        else throw Error('记录暂时无法读取，连接恢复后请重试。');
      }else{
        const last=await P.cache.last();
        if(!last||last.expires<=Date.now()){lockSession('登录已过期，需要联网重新登录。');throw sessionError();}
        if(!await P.claimAccount(last.accountId))throw Error('此账号已在另一个窗口编辑，请关闭那个窗口后重开。');const cached=await P.cache.read(last.accountId);if(!cached?.workspace)throw Error('还没有可恢复的本机内容，请联网后重试。');
        account=last;P.setAccount(account);restore(cached);notice('正在离线查看。当前文字修改会留在本机，联网后同步。');
      }
      if(locked)throw sessionError();menu();await persist();if(locked)throw sessionError();renderStatus();if(pending&&!conflict&&online())timer=setTimeout(flush,0);
    }catch(e){if(locked)throw e;if(sessionFailure(e)){lockSession();throw e;}if(!values.has(KEY))startupFailure(e);else notice(e.message||'暂时无法打开栖伴，请联网后重试。');throw e;}
  })();
  globalThis.QibanCloud={ready,storage,renderStatus,flush,persisted:()=>persisting,online,isLocked:()=>locked,requireOnline(){if(locked)return false;if(conflict){notice('账号同步已暂停，请先导出当前草稿，再选择云端版本。');return false;}if(online())return true;notice('这项操作需要联网。当前文字草稿已保存在本机。');return false;},
    getForm:key=>locked?null:forms[key]||null,setForm(key,value){if(locked)return;forms[key]=value;exported=false;persist();},clearForm(key){if(locked)return;delete forms[key];persist();},backup,
    getAccount:()=>locked?null:account};
  window.addEventListener('beforeunload',event=>{if(!locked&&(pending||running||localError)){event.preventDefault();event.returnValue='';}});
  window.addEventListener('qiban:account-changed',()=>lockSession());
  window.addEventListener('offline',()=>{if(locked)return;connected=false;notice('已断开连接，当前文字草稿会保存在本机。');});
  window.addEventListener('online',()=>reconnect());
  window.addEventListener('qiban:lifecycle',event=>{if(event.detail?.active||event.detail?.state==='active')reconnect();else persist();});
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')reconnect();else persist();});
  window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();globalThis.QibanInstallPrompt=event;});
})();
