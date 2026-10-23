/* Account-bound research tasks; keys live only in the configuration form until submitted. */
(function(root){
 function create(o){
  const esc=o.escape,cache=new Map();let timer=null,pending=false,disposed=false;
  const key=()=>o.state().id;
  const current=()=>cache.get(key())||{jobs:[],lastRead:0};
  const latest=()=>current().jobs.filter(j=>root.QibanHome.sameGoal(j.goal,o.state().goal)).at(-1);
  const running=()=>['queued','running'].includes(latest()?.status);
  const message=()=>{const c=current(),j=latest();return c.error||(!c.info?'正在读取调研状态…':!c.info.configured?'先在下方连接博查或 Tavily。':!c.info.aiConfigured?'先在“AI 连接”中配置整理资料的模型。':j?.status==='failed'?j.message:j?.status==='complete'?'资料已带回。':j?.phase==='organizing'?'正在核对来源、整理发现…':running()?'栖栖正在找资料，离开页面后也会继续。':`准备好了，今天还可发起 ${c.info.remaining} 次调研。`);};
  function paint(){
   const c=current(),container=document.querySelector('[data-online-research]');if(!container)return;
   const status=container.querySelector('[data-research-status]');if(status)status.textContent=message();
   const start=container.querySelector('[data-research-action="start"]');if(start)start.disabled=!o.enabled()||o.readOnly()||pending||running()||!c.info?.configured||!c.info?.aiConfigured||c.info.remaining<=0;
   const saved=container.querySelector('[data-research-connection]');if(saved)saved.textContent=c.info?.configured?`${c.info.provider==='tavily'?'Tavily':'博查'}已保存；密钥留空可沿用`:'填写检索服务提供的 API 密钥，仅保存在自己的账号服务端。';
   const provider=container.querySelector('[name="research-provider"]');if(provider&&c.info&&!provider.dataset.loaded){provider.value=c.info.provider;provider.dataset.loaded='true';}
  }
  function schedule(){clearTimeout(timer);if(disposed||!o.enabled()||o.readOnly())return;const c=current(),age=Date.now()-c.lastRead;
   if(age>=(running()?3000:30000))timer=setTimeout(()=>refresh(),0);else if(running())timer=setTimeout(()=>refresh(),Math.max(3000-age,100));
  }
  async function refresh(){
   if(pending||disposed||!o.enabled()||o.readOnly()||document.visibilityState==='hidden')return;
   const owner=o.state(),projectId=owner.id,c=cache.get(projectId)||{jobs:[],lastRead:0};c.lastRead=Date.now();cache.set(projectId,c);pending=true;
   try{
    const data=await o.request({action:'list',projectId});if(o.state()!==owner||disposed)return;
    c.info=data;c.jobs=data.jobs;c.error='';let added=false;
    for(const j of c.jobs){if(j.status!=='complete'||!j.trip||!root.QibanHome.sameGoal(j.goal,owner.goal))continue;try{if(root.QibanHome.importTrip(owner,j.trip,root.QibanExpeditions)){added=true;}}catch{c.error='有一份调研暂时无法加入当前目标，结果仍保存在服务端。';}}
    if(added){if(!o.save())c.error='调研已生成，本机保存遇到问题；结果仍保存在服务端，请先导出当前内容。';else if(!document.activeElement?.matches('input,textarea,select'))o.render();}
   }catch(e){if(o.state()===owner)c.error=e.message;}
   finally{pending=false;if(o.state()!==owner&&document.querySelector('[data-online-research]')){timer=setTimeout(()=>refresh(),0);}if(o.state()===owner){paint();if(running()&&document.querySelector('[data-online-research]'))timer=setTimeout(()=>refresh(),3000);}}
  }
  function html(){if(!o.enabled())return '<section class="research-launch"><h2>让栖栖帮我找找</h2><p>联网调研需要登录网页版或启动本机服务。</p></section>';schedule();const s=o.state(),c=current();return `<section class="research-launch" data-online-research aria-label="联网调研"><h2>让栖栖帮我找找</h2><p>围绕当前目标，找一些能帮上忙的公开资料。</p><label class="field-label" for="research-question">这次想了解什么？<small>可选</small></label><textarea class="text-field" id="research-question" maxlength="240" rows="3" placeholder="例如：同类产品如何让用户更容易开始第一步？">${esc(s.outings?.researchQuestion||'')}</textarea><p class="small-text">目标和问题会发给检索服务及 AI，不发送行动记录或附件。每次调用搜索和 AI 各一次，可能消耗额度；每天最多 3 次。</p><button class="primary-button" data-research-action="start" ${!c.info?.configured||!c.info?.aiConfigured||running()||o.readOnly()?'disabled':''}>让栖栖帮我找找</button><p class="outing-status" data-research-status role="status" aria-live="polite">${esc(o.enabled()?message():'联网调研需要登录网页版或启动本机服务。')}</p><details class="research-connection"><summary>检索连接</summary><p class="small-text" data-research-connection>密钥仅保存在自己的账号服务端。</p><form id="research-config-form"><label class="field-label" for="research-provider">检索服务</label><select class="text-field" id="research-provider" name="research-provider"><option value="bocha">博查</option><option value="tavily">Tavily</option></select><label class="field-label" for="research-key">API 密钥</label><input class="text-field" id="research-key" type="password" maxlength="4096" autocomplete="off" placeholder="已保存时可留空沿用"><div class="dialog-actions"><button class="text-button" type="button" data-research-action="disconnect">移除检索连接</button><button class="secondary-button" type="submit">保存检索连接</button></div></form><button class="text-button" data-research-action="ai-settings">设置 AI 连接</button></details></section>`;}
  async function configure(event){if(event.target.id!=='research-config-form')return;event.preventDefault();if(disposed||!o.enabled()||o.readOnly())return;
   const owner=o.state(),form=event.target,button=form.querySelector('[type="submit"]'),provider=form.querySelector('[name="research-provider"]').value,keyInput=form.querySelector('#research-key');let secret=keyInput.value.trim();keyInput.value='';button.disabled=true;
   try{const data=await o.request({action:'configure',provider,apiKey:secret});secret='';if(o.state()!==owner)return;const c=current();c.info=data;c.error='检索连接已保存。发起调研时会验证密钥和额度。';cache.set(key(),c);paint();}
   catch(e){secret='';if(o.state()===owner){const c=current();c.error=e.message;cache.set(key(),c);paint();}}
   finally{if(button.isConnected)button.disabled=false;}
  }
  async function handle(event){const b=event.target.closest?.('[data-research-action]');if(!b)return;const action=b.dataset.researchAction;if(action==='ai-settings'){o.openAISettings();return;}if(disposed||!o.enabled()||o.readOnly()||b.disabled)return;
   const owner=o.state(),projectId=owner.id,c=current();b.disabled=true;
   try{
    if(action==='disconnect'){c.info=await o.request({action:'disconnect'});c.error='检索连接已移除。已带回的资料会保留。';cache.set(projectId,c);paint();return;}
    if(action!=='start')return;
    const question=document.querySelector('#research-question')?.value.trim()||'';
    const data=await o.request({action:'start',projectId,goal:owner.goal,question,requestId:root.crypto.randomUUID()});if(o.state()!==owner)return;
    c.info=data;c.jobs=[...c.jobs.filter(j=>j.id!==data.job.id),data.job];c.error='';c.lastRead=0;cache.set(projectId,c);paint();timer=setTimeout(()=>refresh(),1000);
   }catch(e){if(o.state()===owner){c.error=e.message;cache.set(projectId,c);paint();}}
   finally{if(b.isConnected&&action!=='start')b.disabled=false;}
  }
  function input(event){if(event.target.id!=='research-question'||o.readOnly())return;root.QibanHome.ensure(o.state());o.state().outings.researchQuestion=event.target.value.slice(0,240);o.save();}
  o.main.addEventListener('click',handle);o.dialog.addEventListener('click',handle);o.main.addEventListener('submit',configure);o.dialog.addEventListener('submit',configure);o.main.addEventListener('input',input);o.dialog.addEventListener('input',input);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&document.querySelector('[data-online-research]')){const c=current();c.lastRead=0;refresh();}});
  window.addEventListener('qiban:ai-config-changed',()=>{if(document.querySelector('.brought-page')){const c=current();c.lastRead=0;if(!document.querySelector('[data-online-research]')&&o.enabled())o.render();else refresh();}});
  window.addEventListener('qiban:lifecycle',event=>{if((event.detail?.active||event.detail?.state==='active')&&document.querySelector('[data-online-research]'))refresh();});
  window.addEventListener('online',()=>{if(document.querySelector('[data-online-research]'))refresh();});
  window.addEventListener('qiban:account-changed',()=>{disposed=true;cache.clear();clearTimeout(timer);document.querySelectorAll('#research-key').forEach(input=>{input.value='';});});
  return {html,refresh};
 }
 root.QibanOnlineResearch={create};
})(globalThis);
