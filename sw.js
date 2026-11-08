// Offline cache so the game keeps working with no wifi after the first load.
// Stale-while-revalidate: opens instantly from cache, quietly refreshes in the
// background, so after you upload a new version, reload the game TWICE to see it.
const CACHE = 'birthday-game-v2';
const FILES = [
  './', 'index.html', 'config.js', 'levels.js', 'game.js', 'manifest.json',
  'assets/player.png', 'assets/icon-192.png', 'assets/icon-512.png',
  'assets/fonts/fredoka.woff2', 'assets/fonts/pixelify-sans.woff2',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => Promise.all(FILES.map((f) => c.add(f).catch(() => {}))))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(e.request, { ignoreSearch: true });
      const refresh = fetch(e.request)
        .then((res) => { if (res && res.ok) cache.put(e.request, res.clone()); return res; })
        .catch(() => cached);
      return cached || refresh;
    })
  );
});
