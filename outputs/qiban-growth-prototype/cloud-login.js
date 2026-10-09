(() => {
  let register=false;
  const $=s=>document.querySelector(s);
  $('#switch').addEventListener('click',()=>{register=!register;$('#title').textContent=register?'从一个自己的目标开始。':'回来，继续自己的目标。';$('#submit').textContent=register?'创建账号':'登录';$('#switch').textContent=register?'已经有账号？去登录':'第一次来？创建账号';$('#password').autocomplete=register?'new-password':'current-password';$('#error').textContent='';});
  $('#auth').addEventListener('submit',async event=>{event.preventDefault();$('#submit').disabled=true;$('#error').textContent='';try{
    const P=globalThis.QibanPlatform;const result=await P.auth(register?'register':'login',{username:$('#username').value,password:$('#password').value});$('#password').value='';P.setAccount(result);try{await P.cache.remember(result);}catch{}P.goApp();
  }catch(e){$('#error').textContent=e.name==='TimeoutError'?'连接超时，请稍后重试。':e instanceof TypeError?'服务暂时无法连接。':e.message;}finally{$('#submit').disabled=false;}});
})();
