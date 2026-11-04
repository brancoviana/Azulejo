/* Azulejo — service worker: guarda os arquivos do jogo para funcionar offline. */
'use strict';

// Mude a versão ao adicionar ou remover arquivos da lista.
const CACHE = 'azulejo-v1';
const FILES = [
  './',
  'index.html',
  'logic.js',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png',
  'fonts/BagelFatOne-latin.woff2',
  'fonts/BagelFatOne-latin-ext.woff2',
  'fonts/Figtree-latin.woff2',
  'fonts/Figtree-latin-ext.woff2',
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('azulejo-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Rede primeiro (o jogador sempre recebe a versão nova quando está online);
// sem internet, usa a cópia guardada.
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    fetch(req)
      .then(res => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req.mode === 'navigate' ? 'index.html' : req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req.mode === 'navigate' ? 'index.html' : req, { ignoreSearch: true }))
  );
});
