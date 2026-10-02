/* Progressive Web App: app shell only. No API, authentication or personal data is ever cached. */
const VERSION='tm-next-shell-v2';
const SHELL=['./','./index.html','./src/app.js','./src/config.js','./src/data.js','./src/domain.js','./src/styles.css','./assets/favicon.svg'];
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(VERSION).then(cache=>cache.addAll(SHELL)).catch(()=>{}));
  self.skipWaiting();
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('tm-next-shell-')&&k!==VERSION).map(k=>caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch',event=>{
  const {request}=event;
  if(request.method!=='GET'||new URL(request.url).origin!==self.location.origin) return;
  if(request.mode==='navigate'){
    event.respondWith(fetch(request).catch(()=>caches.match('./index.html')));
    return;
  }
  event.respondWith(fetch(request).then(response=>{
    if(response.ok&&['script','style','image','manifest'].includes(request.destination)){
      const clone=response.clone();event.waitUntil(caches.open(VERSION).then(cache=>cache.put(request,clone)));
    }
    return response;
  }).catch(()=>caches.match(request)));
});
