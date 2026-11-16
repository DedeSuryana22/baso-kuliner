// Service worker: app bisa dibuka cepat & tetap tampil saat sinyal hilang.
// Naikkan VERSION setiap kali update file agar HP mengambil versi baru.
const VERSION = 'bk-v1';
const SHELL = ['./', 'index.html', 'css/style.css', 'js/config.js', 'js/core.js', 'js/app.js',
  'vendor/leaflet/leaflet.js', 'vendor/leaflet/leaflet.css', 'assets/qris.svg', 'assets/icon-192.png', 'manifest.json'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL))); self.skipWaiting(); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return; // tile peta & wa.me lewat jaringan biasa
  // network-first: selalu ambil versi terbaru, pakai cache kalau offline
  e.respondWith(fetch(e.request).then((r) => {
    const copy = r.clone(); caches.open(VERSION).then((c) => c.put(e.request, copy)); return r;
  }).catch(() => caches.match(e.request).then((m) => m || caches.match('index.html'))));
});
