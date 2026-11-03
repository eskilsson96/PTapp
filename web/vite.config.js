import { defineConfig } from 'vite';
import { createHash } from 'node:crypto';
export default defineConfig({
  base: './',
  build: { target: 'safari16', sourcemap: false },
  plugins: [{
    name: 'fitcraft-offline',
    generateBundle(_options, bundle) {
      const files = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png', ...Object.keys(bundle).filter(name => name.startsWith('assets/')).map(name => `./${name}`)];
      const version = createHash('sha256').update(JSON.stringify(files)).digest('hex').slice(0, 12);
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: `
const CACHE = 'fitcraft-${version}';
const FILES = ${JSON.stringify(files)};
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)).then(() => self.skipWaiting())));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('fitcraft-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).then(response => {
      if (response.ok) { const copy = response.clone(); event.waitUntil(caches.open(CACHE).then(cache => cache.put('./index.html', copy))); }
      return response;
    }).catch(() => caches.match('./index.html')));
  } else if (url.pathname.startsWith(new URL(self.registration.scope).pathname)) {
    event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
      if (response.ok) { const copy = response.clone(); event.waitUntil(caches.open(CACHE).then(cache => cache.put(event.request, copy))); }
      return response;
    })));
  }
});
` });
    }
  }]
});
