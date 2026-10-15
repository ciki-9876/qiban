/* Public update status only. No credentials, workspace or account data is cached here. */
(() => {
  const adapter=globalThis.QibanUpdateAdapter || (globalThis.QibanNative?.updateCheck ? {check:()=>QibanNative.updateCheck(),ready:()=>QibanNative.updateReady()} : null);
  let initializePromise,busy=false,worker=null,ready=false,lastCheck=0;
  function label(text){const node=document.querySelector('#qiban-update-status');if(node)node.textContent=text;}
  async function check(){
    if(busy)return;busy=true;const button=document.querySelector('#qiban-check-update');if(button)button.disabled=true;
    label('正在检查更新…');
    try{
      if(adapter){const result=await adapter.check();label(result.status==='ready'?'更新已准备好，重新打开应用后生效':result.status==='native-required'?'需要安装新版应用，当前版本仍可使用':result.status==='rolled-back'?'更新已回退，继续使用当前版本':'当前已是最新版本');}
      else {worker=await navigator.serviceWorker.getRegistration('/');await worker?.update();label(worker?.waiting?'新版已准备好，关闭栖伴页面后重新打开即可':'已检查网页更新');}
      lastCheck=Date.now();
    }catch{label('暂时无法更新，当前版本仍可使用');}
    finally{busy=false;if(button)button.disabled=false;}
  }
  function mount(){
    if(document.querySelector('#qiban-check-update'))return;
    const entry=document.createElement('details');entry.id='qiban-updates';entry.style.cssText='margin-top:24px;max-width:100%;box-sizing:border-box;background:var(--panel,var(--paper,#fafaf7));color:var(--ink,#302d32);border:1px solid var(--line,#8885);border-radius:14px;padding:8px 12px;font:14px system-ui';
    const summary=document.createElement('summary');summary.textContent='应用更新';summary.style.minHeight='44px';
    const status=document.createElement('p');status.id='qiban-update-status';status.setAttribute('role','status');status.textContent=adapter?'后台检查，不打断当前编辑':'网页会在下次打开时更新';
    const button=document.createElement('button');button.id='qiban-check-update';button.type='button';button.textContent='检查更新';button.style.cssText='min-height:44px;padding:8px 14px;background:transparent;border:1px solid #8888;border-radius:10px;color:inherit;font:inherit';button.addEventListener('click',check);
    entry.append(summary,status,button);const menu=document.querySelector('#more-menu');if(menu){entry.style.cssText='padding:8px 12px;font:14px system-ui;color:inherit';menu.append(entry);}else (document.querySelector('main')||document.body).append(entry);
  }
  async function initialize(){
    // Only the rendered application/login calls this, so script/render failures cannot acknowledge a broken bundle.
    if(adapter){try{const result=await adapter.ready();mount();if(result?.disabled){label('更新暂时不可用，当前版本仍可使用');return;}ready=true;if(result?.rollback)label('上次更新启动异常，已恢复内置版本');void check();}catch{mount();label('更新保护尚未就绪，已保留当前版本');}}
    else if('serviceWorker' in navigator && document.querySelector('meta[name="qiban-cloud"]')){
      mount();try{worker=await navigator.serviceWorker.getRegistration('/');if(worker)await check();}catch{}
    }
  }
  globalThis.QibanUpdates={ready:()=>initializePromise ||= initialize(),isReady:()=>ready};
  window.addEventListener('qiban:lifecycle',event=>{if(ready&&(event.detail?.active||event.detail?.state==='active')&&Date.now()-lastCheck>900000)check();});
  window.addEventListener('online',()=>{if(ready&&Date.now()-lastCheck>60000)check();});
})();
