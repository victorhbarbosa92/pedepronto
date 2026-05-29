// PedePronto Service Worker v2 — PWA offline 100%
const CACHE_NAME = 'pedepronto-v2';
const STATIC_CACHE = 'pedepronto-static-v2';
const RUNTIME_CACHE = 'pedepronto-runtime-v2';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.png',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

// Install — pre-cache core assets
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(STATIC_ASSETS).catch(err => console.warn('[SW] Cache addAll partial fail:', err)))
      .then(() => self.skipWaiting())
  );
});

// Activate — clean old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(names =>
      Promise.all(names.filter(n => ![STATIC_CACHE, RUNTIME_CACHE].includes(n)).map(n => caches.delete(n)))
    ).then(() => self.clients.claim())
  );
});

// Fetch — Stale-while-revalidate for HTML, cache-first for assets
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  if (e.request.method !== 'GET') return;

  // Cross-origin (APIs, Firebase, etc.) — sempre rede direta (sem cache)
  if (url.origin !== self.location.origin) return;

  // HTML — Stale-while-revalidate (serve cache imediatamente, atualiza em segundo plano)
  if (e.request.mode === 'navigate' || url.pathname === '/' || url.pathname.endsWith('.html')) {
    e.respondWith(
      caches.open(STATIC_CACHE).then(cache =>
        cache.match(e.request).then(cached => {
          const fetchPromise = fetch(e.request)
            .then(res => {
              if (res && res.ok) cache.put(e.request, res.clone());
              return res;
            })
            .catch(() => cached || cache.match('/index.html'));
          return cached || fetchPromise;
        })
      )
    );
    return;
  }

  // Service worker próprio — sempre rede (não cache)
  if (url.pathname === '/sw.js') return;

  // Manifest e ícones — cache-first com fallback de rede
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res && res.ok) {
          const clone = res.clone();
          caches.open(RUNTIME_CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => cached);
    })
  );
});

// Mensagens do app — força atualização do SW
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
  if (e.data && e.data.type === 'CLEAR_CACHE') {
    caches.keys().then(names => Promise.all(names.map(n => caches.delete(n))));
  }
});

// Background sync (quando voltar online) — placeholder para queue de ações offline
self.addEventListener('sync', e => {
  if (e.tag === 'sync-pedidos') {
    // Disparado quando online novamente — o app já tem Firestore offline persistence
    console.log('[SW] Background sync triggered');
  }
});
