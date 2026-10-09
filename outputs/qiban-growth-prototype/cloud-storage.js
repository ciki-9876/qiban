(() => {
  'use strict';
  const P=globalThis.QibanPlatform,KEY='qiban.growth.prototype.v1',VISIT='qiban.growth.visits.v1',values=new Map();
  let account,revision=0,pending=null,running=false,timer,conflict=false,connected=true,error='',localError='',persisting=Promise.resolve(),forms={},exported=false;
  const $=s=>document.querySelector(s),online=()=>navigator.onLine!==false&&connected;
  function renderStatus(){const el=$('#saved-state');if(!el)return;el.textContent=localError?'本机保存异常':conflict?'尚未同步':pending||running?online()?'正在同步':'已保存到本机':Object.keys(forms).length?'已保存到本机':'已同步到账号';el.title=localError||error||(pending?'联网后同步到自己的账号':'记录保存在自己的账号中');}
  function snapshot(){return {revision,workspace:values.has(KEY)?JSON.parse(values.get(KEY)):null,values:values.has(VISIT)?{[VISIT]:values.get(VISIT)}:{},dirty:Boolean(pending),forms,updatedAt:Date.now()};}
  function persist(){
    if(!account)return Promise.resolve(false);
    const copy=JSON.parse(JSON.stringify(snapshot()));
    persisting=persisting.then(()=>P.cache.write(account.accountId,copy)).then(()=>{localError='';renderStatus();return true;}).catch(()=>{localError='本机存储无法写入，当前文字还在本页面，请先导出再关闭。';notice(localError);return false;});
    return persisting;
  }
  async function backup(){
    if(!values.has(KEY))return;
    await P.saveBlob(new Blob([JSON.stringify({workspace:JSON.parse(values.get(KEY)),forms},null,2)],{type:'application/json'}),'栖伴-未同步记录.json',{share:false});exported=true;
  }
  function notice(message){
    error=message;let el=$('#cloud-notice');if(!el){el=document.createElement('div');el.id='cloud-notice';el.setAttribute('role','status');document.body.append(el);}
    el.replaceChildren();const text=document.createElement('span');text.textContent=message;el.append(text);
    const button=document.createElement('button');button.textContent='导出未同步记录';button.onclick=()=>backup().catch(()=>notice('导出尚未完成，当前草稿仍保留。'));el.append(button);
    if(conflict){const reload=document.createElement('button');reload.textContent='先导出，再载入云端版本';reload.onclick=async()=>{
      if(!exported){notice('请先完成草稿导出，再载入云端版本。');return;}
      try{const r=await P.request('/api/workspace');if(r.status!==200)throw Error(r.data.message);revision=r.data.revision;values.clear();forms={};if(r.data.workspace)values.set(KEY,JSON.stringify(r.data.workspace));pending=null;conflict=false;await persist();location.reload();}catch(e){notice(e.message||'云端版本暂时无法读取。');}
    };el.append(reload);}
    if(conflict&&/登录|页面已更新/.test(message)){const login=document.createElement('button');login.textContent='重新登录，恢复草稿';login.onclick=P.goLogin;el.append(login);}
    renderStatus();
  }
  function restore(record){
    if(!record)return;
    revision=record.revision||0;forms=record.forms||{};
    if(record.workspace)values.set(KEY,JSON.stringify(record.workspace));
    if(record.values?.[VISIT])values.set(VISIT,record.values[VISIT]);
    pending=record.dirty?values.get(KEY)||null:null;
  }
  async function reconnect(){
    if(!account||navigator.onLine===false)return;
    try{
      const r=await P.request('/api/account',{timeout:15000});
      if(r.status===401){conflict=true;notice('请重新登录自己的账号。未同步草稿已保留。');return;}
      if(r.status!==200)throw Error();
      if(r.data.accountId!==account.accountId){conflict=true;notice('当前账号已变化，请重新登录原账号恢复草稿。');return;}
      account=r.data;P.setAccount(account);connected=true;
      if(!conflict){error='';$('#cloud-notice')?.remove();await flush();}
    }catch{connected=false;notice('连接暂时中断，草稿会保存在本机。');}
  }
  async function flush(){
    clearTimeout(timer);if(running||!pending||conflict||navigator.onLine===false)return;
    running=true;renderStatus();const raw=pending;
    try{
      await persisting;
      const r=await P.request('/api/workspace',{method:'POST',body:{revision,workspace:JSON.parse(raw)},timeout:15000});
      if(r.status!==200){if([401,403,409,413].includes(r.status))conflict=true;throw Error(r.data.message||'同步失败。');}
      connected=true;revision=r.data.revision;if(pending===raw)pending=null;error='';exported=false;$('#cloud-notice')?.remove();await persist();
    }catch(e){if(!conflict)connected=false;await persist();notice(conflict?(e.message+' 当前改动已留在本机，请先导出。'):'连接暂时中断，草稿会保存在本机，正在重试。');}
    finally{running=false;renderStatus();if(pending&&!conflict)timer=setTimeout(flush,error?5000:0);}
  }
  const storage={getItem:k=>values.get(k)??null,setItem(k,value){
    if(![KEY,VISIT].includes(k))return;
    if(k===KEY)JSON.parse(value);values.set(k,String(value));exported=false;
    if(k===KEY){pending=String(value);clearTimeout(timer);timer=setTimeout(flush,400);}
    persist();renderStatus();
  }};
  function menu(){
    const target=$('#more-menu');if(!target)return;
    const label=document.createElement('div');label.className='cloud-account';label.textContent='账号：'+account.username;target.prepend(label);
    const logout=document.createElement('button');logout.textContent='退出账号';logout.addEventListener('click',async()=>{
      await flush();await persisting;if(running||localError||((pending||conflict||Object.keys(forms).length)&&!exported)){notice('还有记录未同步，请先导出或等待同步完成，再退出。');return;}
      try{await P.logout();if(!P.native){await P.cache.delete(account.accountId);await P.cache.forget();}values.clear();P.goLogin();}catch{notice('暂时无法退出，请稍后再试。');}
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
      try{r=await P.request('/api/account',{timeout:15000});}catch{connected=false;}
      if(r?.status===401){P.goLogin();throw Error('请先登录栖伴，未同步草稿仍保留在本机。');}
      if(r&&r.status!==200)throw Error(r.data.message||'账号暂时无法读取。');
      if(r){
        account=r.data;if(!await P.claimAccount(account.accountId))throw Error('此账号已在另一个窗口编辑，请关闭那个窗口后重开；请使用支持本机存储的主流浏览器。');P.setAccount(account);let cached=null;
        try{cached=await P.cache.read(account.accountId);await P.cache.remember(account);}catch{localError='本机草稿存储不可用，请先导出再关闭。';}
        const current=await P.request('/api/workspace',{timeout:15000}).catch(()=>null);
        if(current?.status===401){P.goLogin();throw Error('请先重新登录。');}
        if(current?.status===200){
          if(cached?.dirty){restore(cached);if(revision!==current.data.revision){conflict=true;notice('另一个设备已保存新内容。当前草稿已恢复，请先导出再选择云端版本。');}}
          else {revision=current.data.revision;if(current.data.workspace)values.set(KEY,JSON.stringify(current.data.workspace));forms=cached?.forms||{};if(cached?.values?.[VISIT])values.set(VISIT,cached.values[VISIT]);}
        }else if(cached?.workspace){restore(cached);connected=false;notice('暂时无法连接，已恢复本机内容。当前文字修改会留在本机。');}
        else throw Error('记录暂时无法读取，连接恢复后请重试。');
      }else{
        const last=await P.cache.last();
        if(!last||last.expires<=Date.now()){P.goLogin();throw Error('需要联网登录自己的账号，草稿仍保留。');}
        if(!await P.claimAccount(last.accountId))throw Error('此账号已在另一个窗口编辑，请关闭那个窗口后重开。');const cached=await P.cache.read(last.accountId);if(!cached?.workspace)throw Error('还没有可恢复的本机内容，请联网后重试。');
        account=last;P.setAccount(account);restore(cached);notice('正在离线查看。当前文字修改会留在本机，联网后同步。');
      }
      menu();await persist();renderStatus();if(pending&&!conflict&&online())timer=setTimeout(flush,0);
    }catch(e){notice(e.message||'暂时无法打开栖伴，请联网后重试。');throw e;}
  })();
  globalThis.QibanCloud={ready,storage,renderStatus,flush,persisted:()=>persisting,online,requireOnline(){if(conflict){notice('账号同步已暂停，请先导出当前草稿，再选择云端版本。');return false;}if(online())return true;notice('这项操作需要联网。当前文字草稿已保存在本机。');return false;},
    getForm:key=>forms[key]||null,setForm(key,value){forms[key]=value;exported=false;persist();},clearForm(key){delete forms[key];persist();},backup,
    getAccount:()=>account};
  window.addEventListener('beforeunload',event=>{if(pending||running||localError){event.preventDefault();event.returnValue='';}});
  window.addEventListener('offline',()=>{connected=false;notice('已断开连接，当前文字草稿会保存在本机。');});
  window.addEventListener('online',()=>reconnect());
  window.addEventListener('qiban:lifecycle',event=>{if(event.detail?.active||event.detail?.state==='active')reconnect();else persist();});
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')reconnect();else persist();});
  window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();globalThis.QibanInstallPrompt=event;});
})();
