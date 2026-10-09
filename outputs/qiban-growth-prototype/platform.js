/* Shared client services. Native credentials stay behind the platform bridge. */
(() => {
  'use strict';
  const native=globalThis.QibanNative||null;
  let account=null,dbPromise=null;
  const accountId=id=>{if(!/^[a-f0-9]{32}$/.test(id||''))throw Error('账号标识无法读取。');return id;};
  function database(){
    if(dbPromise)return dbPromise;
    dbPromise=new Promise((resolve,reject)=>{
      if(!globalThis.indexedDB){reject(Error('本机草稿存储不可用，请先导出记录。'));return;}
      const request=indexedDB.open('qiban.cloud.drafts.v1',1);
      request.onupgradeneeded=()=>request.result.createObjectStore('records');
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>reject(Error('本机草稿无法保存，请检查浏览器存储空间。'));
    });
    return dbPromise;
  }
  async function record(key,operation,value){
    const db=await database();
    return await new Promise((resolve,reject)=>{
      const tx=db.transaction('records',operation==='get'?'readonly':'readwrite'),store=tx.objectStore('records');
      const request=operation==='get'?store.get(key):operation==='delete'?store.delete(key):store.put(value,key);
      let result;request.onsuccess=()=>{result=request.result;};
      tx.oncomplete=()=>resolve(result??null);
      tx.onerror=tx.onabort=()=>reject(Error('本机草稿无法保存，请先导出记录。'));
    });
  }
  const cache={
    read:id=>native?native.cacheRead({accountId:accountId(id)}):record('account:'+accountId(id),'get'),
    write:(id,value)=>native?native.cacheWrite({accountId:accountId(id),record:value}):record('account:'+accountId(id),'put',value),
    delete:id=>native?native.cacheDelete({accountId:accountId(id)}):record('account:'+accountId(id),'delete'),
    last:()=>native?native.cacheLast():record('last','get'),
    remember:value=>{accountId(value.accountId);const meta={accountId:value.accountId,username:value.username,expires:value.expires||Date.now()+7*86400000};return native?native.cacheRemember(meta):record('last','put',meta);},
    forget:()=>native?native.cacheForget():record('last','delete')
  };
  async function claimAccount(id){
    accountId(id);if(native)return true;
    if(!navigator.locks)return false;
    return await new Promise((resolve,reject)=>{navigator.locks.request('qiban-workspace:'+id,{ifAvailable:true},lock=>{resolve(Boolean(lock));return lock?new Promise(()=>{}):undefined;}).catch(reject);});
  }
  async function request(path,{method='GET',body,timeout=65000}={}){
    if(native)return native.request({path,method,...(body!==undefined?{body}:{})});
    const headers=method==='POST'?{'Content-Type':'application/json'}:{};
    const csrf=account?.csrf||document.querySelector('meta[name="qiban-session"]')?.content;
    if(method==='POST'&&csrf)headers['X-Qiban-Token']=csrf;
    const response=await fetch(path,{method,credentials:'same-origin',headers,...(body!==undefined?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(timeout)});
    let data;try{data=await response.json();}catch{throw Error('服务响应暂时无法读取。');}
    return {status:response.status,data};
  }
  async function auth(kind,input){
    if(native)return native.auth({kind,...input});
    const response=await request('/api/auth/'+kind,{method:'POST',body:input,timeout:15000});
    if(response.status!==200)throw Error(response.data.message||'暂时无法登录。');
    const current=await request('/api/account');
    if(current.status!==200)throw Error(current.data.message||'账号暂时无法读取。');
    return current.data;
  }
  async function logout(){
    if(native)return native.logout();
    const response=await request('/api/auth/logout',{method:'POST',body:{},timeout:15000});
    if(response.status!==200)throw Error(response.data.message||'暂时无法退出。');
  }
  function goLogin(){location.replace(native?'login.html':'/login');}
  function goApp(){location.replace(native?'index.html':'/');}
  async function saveBlob(blob,name,{share=false}={}){
    if(native){
      const bytes=new Uint8Array(await blob.arrayBuffer());let binary='';
      for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode(...bytes.subarray(i,i+32768));
      const result=await native.saveFile({name,base64:btoa(binary),mime:blob.type||'application/octet-stream',share});
      if(result?.ok!==true||result?.canceled===true)throw Error('已取消保存，记录仍保留。');return result;
    }
    if(share&&typeof File==='function'&&navigator.canShare?.({files:[new File([blob],name,{type:blob.type})]})){
      await navigator.share({files:[new File([blob],name,{type:blob.type})]});return {ok:true};
    }
    const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);return {ok:true};
  }
  function start(){
    if(native){
      document.documentElement.classList.add('native-app');
      document.addEventListener('click',event=>{
        const a=event.target.closest?.('a[href]');if(!a)return;
        const url=new URL(a.href,location.href);if(!/^https?:$/.test(url.protocol)||url.origin===location.origin)return;
        event.preventDefault();native.openExternal({url:url.href}).catch(()=>{});
      });
    }else if('serviceWorker' in navigator&&document.querySelector('meta[name="qiban-cloud"]')){
      navigator.serviceWorker.register('/service-worker.js').catch(()=>{});
    }
  }
  globalThis.QibanPlatform={native:Boolean(native),claimAccount,request,auth,logout,cache,saveBlob,goLogin,goApp,setAccount:value=>{account=value;},getAccount:()=>account};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
