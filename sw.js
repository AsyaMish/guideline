const CACHE_NAME = 'guideline-cache-v1';
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
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(res => res || fetch(event.request))
  );
});