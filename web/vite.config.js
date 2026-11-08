import { defineConfig } from 'vite';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
export default defineConfig({
  base: './',
  build: { target: 'safari16', sourcemap: false, rollupOptions: { input: { fitcraft: resolve('index.html'), runner: resolve('runner/index.html') } } },
  plugins: [{
    name: 'fitcraft-offline',
    generateBundle(_options, bundle) {
      const files = ['./', './index.html', './manifest.webmanifest', './runner/', './runner/index.html', './runner.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png', ...Object.keys(bundle).filter(name => name.startsWith('assets/')).map(name => `./${name}`)];
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
    const runnerPath = new URL('runner/', self.registration.scope).pathname;
    const pageKey = url.pathname === runnerPath || url.pathname === runnerPath + 'index.html' ? './runner/index.html' : './index.html';
    event.respondWith(fetch(event.request).then(response => {
      if (response.ok) { const copy = response.clone(); event.waitUntil(caches.open(CACHE).then(cache => cache.put(pageKey, copy))); }
      return response;
    }).catch(() => caches.match(pageKey)));
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
