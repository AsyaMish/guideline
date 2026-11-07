/* Service Worker: при наличии интернета всегда берём свежую версию файлов,
   а из кэша работаем только офлайн. Так обновления доходят до приложения сами. */
const CACHE_NAME = 'guideline-cache-v2';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './js/icons.js',
  './js/utils.js',
  './js/data.js',
  './js/store.js',
  './js/merge.js',
  './js/exportimport.js',
  './js/components.js',
  './js/views-home.js',
  './js/views-toc.js',
  './js/views-colors.js',
  './js/views-typography.js',
  './js/views-buttons.js',
  './js/views-inputs.js',
  './js/views-radius.js',
  './js/views-shadows.js',
  './js/views-spacing.js',
  './js/views-export.js',
  './js/views-settings.js',
  './js/app.js'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* Сеть → кэш: онлайн всегда свежая версия, офлайн — сохранённая копия */
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  event.respondWith(
    fetch(req).then(res => {
      if (res && res.ok && res.type === 'basic') {
        const copy = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
      }
      return res;
    }).catch(() =>
      caches.match(req, { ignoreSearch: true }).then(cached => {
        if (cached) return cached;
        if (req.mode === 'navigate') return caches.match('./index.html');
        return Response.error();
      })
    )
  );
});
