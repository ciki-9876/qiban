/* Cache only a public shell and immutable frontend assets, never private responses. */
const VERSION='qiban-static-0.9.0-beta.1-r3';
const ASSETS=['/app-shell.html','/platform.js','/cloud-storage.js','/app.js','/style.css','/project.css','/research-cards.css','/attachment-input.js','/stage-state.js','/record-input.js','/action-state.js','/home-state.js','/expedition-data.js','/research-cards.js','/home-ui.js','/project-state.js','/assets/qixi-editorial.png','/icons/icon-192.png','/icons/icon-512.png','/icons/icon-maskable-512.png'];
const allowed=new Set(ASSETS);
self.addEventListener('install',event=>event.waitUntil(caches.open(VERSION).then(cache=>cache.addAll(ASSETS))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('qiban-static-')&&key!==VERSION).map(key=>caches.delete(key))))));
self.addEventListener('fetch',event=>{
  const req=event.request,url=new URL(req.url);
  if(req.method!=='GET'||url.origin!==self.location.origin||url.search||url.pathname.startsWith('/api/'))return;
  if(req.mode==='navigate'&&['/','/index.html','/app-shell.html'].includes(url.pathname)){
    event.respondWith(fetch(req).catch(()=>caches.open(VERSION).then(cache=>cache.match('/app-shell.html'))));return;
  }
  if(allowed.has(url.pathname))event.respondWith(caches.open(VERSION).then(async cache=>(await cache.match(url.pathname))||fetch(req)));
});
