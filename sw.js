// Service worker: network-first — sempre tenta a versão mais nova do servidor.
// Se estiver sem internet, usa a cópia guardada (funciona offline no mercado).
const CACHE = 'supermercado-v1';
const ESSENCIAIS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png'
];

self.addEventListener('install', function (ev) {
  self.skipWaiting(); // ativa a versão nova na hora
  ev.waitUntil(
    caches.open(CACHE).then(function (c) {
      return c.addAll(ESSENCIAIS).catch(function () {});
    })
  );
});

self.addEventListener('activate', function (ev) {
  ev.waitUntil(
    caches.keys().then(function (nomes) {
      return Promise.all(
        nomes.map(function (n) { if (n !== CACHE) return caches.delete(n); })
      );
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (ev) {
  const req = ev.request;
  if (req.method !== 'GET') return;

  // só cuida dos arquivos do próprio site
  if (new URL(req.url).origin !== self.location.origin) return;

  ev.respondWith(
    fetch(req)
      .then(function (resp) {
        const copia = resp.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copia); });
        return resp;
      })
      .catch(function () {
        return caches.match(req).then(function (hit) {
          return hit || caches.match('./index.html');
        });
      })
  );
});
