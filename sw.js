// Сканворды работают без интернета: страница, база слов и шрифты хранятся на телефоне, свежая версия подтягивается при подключении.
const CACHE = "skan-v4";
const SHELL = ["./", "./index.html", "./style.css", "./app.js", "./engine.js", "./nono-pics.js", "./games.js", "./words.js", "./manifest.json", "./version.json", "./icon-192.png", "./icon-512.png",
  "./fonts/rubik-cyrillic-400-normal.woff2", "./fonts/rubik-cyrillic-500-normal.woff2", "./fonts/rubik-cyrillic-700-normal.woff2", "./fonts/roboto-condensed-cyrillic-500-normal.woff2",
  "./fonts/rubik-latin-400-normal.woff2", "./fonts/rubik-latin-500-normal.woff2", "./fonts/rubik-latin-700-normal.woff2", "./fonts/roboto-condensed-latin-500-normal.woff2"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== CACHE).map(x => caches.delete(x)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin || url.pathname.endsWith(".apk")) return;
  e.respondWith(fetch(e.request, { cache: "no-cache" })
    .then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r; })
    .catch(() => caches.match(e.request, { ignoreSearch: true })));
});
