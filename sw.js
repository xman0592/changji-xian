/* 长季鲜 · 离线缓存 */
const VERSION = '1.3.0';
const CACHE = 'changji-xian-v' + VERSION;
const ASSETS = [
  './',
  './index.html',
  './menu.html',
  './invite.html',
  './styles.css?v=' + VERSION,
  './qrcode.min.js?v=' + VERSION,
  './data.js?v=' + VERSION,
  './sync.js?v=' + VERSION,
  './app.js?v=' + VERSION,
  './demo.js?v=' + VERSION,
  './manifest.webmanifest',
  './version.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  // 逐个预缓存：单个文件失败不影响整体安装（例如离线时 demo.js 没拉到）
  e.waitUntil(caches.open(CACHE).then((c) => Promise.all(
    ASSETS.map((u) => c.add(new Request(u, { cache: 'reload' })).catch(() => { }))
  )));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => { });
        return res;
      }).catch(() => caches.match(req).then((r) => r || caches.match('./index.html')))
    );
    return;
  }
  e.respondWith(
    caches.match(req).then((hit) => {
      const network = fetch(req).then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => { });
        }
        return res;
      }).catch(() => hit);
      return hit || network;
    })
  );
});
