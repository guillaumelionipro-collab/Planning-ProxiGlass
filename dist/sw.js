const CACHE_NAME="proxiglass-v1";
const ASSETS=["/","/index.html","/manifest.webmanifest","/icons/icon-192.png","/icons/icon-512.png","/icons/icon-512-maskable.png"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(ASSETS)));self.skipWaiting();});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)))));self.clients.claim();});
self.addEventListener("fetch",e=>{const r=e.request;if(r.headers.get("accept")?.includes("text/html")){e.respondWith(fetch(r).then(res=>{const cp=res.clone();caches.open(CACHE_NAME).then(c=>c.put(r,cp));return res;}).catch(()=>caches.match(r).then(m=>m||caches.match("/"))));}else{e.respondWith(caches.match(r).then(m=>m||fetch(r).then(res=>{const cp=res.clone();caches.open(CACHE_NAME).then(c=>c.put(r,cp));return res;})));}});
