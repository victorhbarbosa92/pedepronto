// PedePronto Service Worker v5 — Network-first AGRESSIVO para HTML
// Garante que toda abertura do app puxe a versão mais nova do servidor.
// Cache só é usado como FALLBACK quando offline.

const VERSION = 'v28-' + Date.now(); // muda toda vez que o SW é re-registrado pelo client
const STATIC_CACHE = 'pp-static-' + VERSION;
const ASSETS_CACHE = 'pp-assets-v5'; // assets quase nunca mudam

const STATIC_ASSETS = [
  '/favicon.png',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/manifest.json'
];

// Install — pre-cache só assets imutáveis. NÃO cacheia HTML aqui!
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(ASSETS_CACHE)
      .then(cache => cache.addAll(STATIC_ASSETS).catch(err => console.warn('[SW] addAll partial:', err)))
      .then(() => self.skipWaiting()) // ativa imediatamente
  );
});

// Activate — limpa TODOS os caches velhos e assume controle das abas existentes
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(names => Promise.all(
        names
          .filter(n => n !== STATIC_CACHE && n !== ASSETS_CACHE)
          .map(n => caches.delete(n))
      ))
      .then(() => self.clients.claim())
      .then(() => {
        // Notifica todas as abas que há SW novo ativo
        return self.clients.matchAll().then(clients => {
          clients.forEach(c => c.postMessage({ type: 'SW_UPDATED', version: VERSION }));
        });
      })
  );
});

// Fetch — Estratégia diferenciada por tipo de recurso
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Só GET é cacheado
  if (e.request.method !== 'GET') return;

  // Cross-origin (Firebase, APIs, fontes) → deixa o navegador lidar
  if (url.origin !== self.location.origin) return;

  // Service worker próprio nunca cacheia
  if (url.pathname === '/sw.js') return;

  // ── HTML / Navegação → NETWORK-FIRST AGRESSIVO ──
  // Sempre tenta o servidor primeiro. Cache só se 100% offline.
  if (e.request.mode === 'navigate' ||
      url.pathname === '/' ||
      url.pathname.endsWith('.html') ||
      url.pathname === '/index.html') {

    e.respondWith(
      fetch(e.request, { cache: 'no-store' }) // ignora cache HTTP do browser também
        .then(res => {
          // Só armazena se vier OK do servidor — para usar como fallback offline
          if (res && res.ok) {
            const clone = res.clone();
            caches.open(STATIC_CACHE).then(c => c.put('/index.html', clone));
          }
          return res;
        })
        .catch(() => {
          // Sem rede → serve último HTML conhecido (offline mode)
          return caches.match('/index.html').then(cached => {
            if (cached) return cached;
            // Último recurso: tela genérica
            return new Response(
              '<!DOCTYPE html><html><body style="font:16px sans-serif;padding:40px;text-align:center;background:#0e0e12;color:#eee"><h2>⚠️ Sem conexão</h2><p>Verifique sua internet e <a href="/" style="color:#D97757">tente novamente</a>.</p></body></html>',
              { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
            );
          });
        })
    );
    return;
  }

  // ── Manifest → também network-first (pode mudar) ──
  if (url.pathname === '/manifest.json') {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          if (res && res.ok) {
            const clone = res.clone();
            caches.open(ASSETS_CACHE).then(c => c.put(e.request, clone));
          }
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // ── Assets estáticos (ícones, favicon) → CACHE-FIRST ──
  // Esses raramente mudam. Versão nova chega via SW.
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res && res.ok) {
          const clone = res.clone();
          caches.open(ASSETS_CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => cached);
    })
  );
});

// Mensagens do app
self.addEventListener('message', e => {
  if (!e.data) return;
  if (e.data.type === 'SKIP_WAITING') self.skipWaiting();
  if (e.data.type === 'CLEAR_CACHE') {
    caches.keys().then(names => Promise.all(names.map(n => caches.delete(n))))
      .then(() => {
        if (e.source) e.source.postMessage({ type: 'CACHE_CLEARED' });
      });
  }
  if (e.data.type === 'GET_VERSION') {
    if (e.source) e.source.postMessage({ type: 'VERSION', version: VERSION });
  }
});
