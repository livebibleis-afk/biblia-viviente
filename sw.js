/* Service worker de Biblia Viviente
 * Cachea el audio de un capítulo la primera vez que se reproduce,
 * para poder oírlo de nuevo sin red. No precarga la Biblia entera.
 */
const AUDIO_CACHE = 'bv-chapter-audio-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== AUDIO_CACHE && k.startsWith('bv-chapter-audio-')).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

function isChapterAudioRequest(request) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return false;
  const url = new URL(request.url);
  if (request.destination === 'audio') return true;
  return /\.(mp3|m4a|ogg|wav)$/i.test(url.pathname) || /\/audio\//.test(url.pathname);
}

self.addEventListener('fetch', (event) => {
  if (!isChapterAudioRequest(event.request)) return;
  event.respondWith((async () => {
    const cache = await caches.open(AUDIO_CACHE);
    const cached = await cache.match(event.request, { ignoreSearch: true, ignoreMethod: true });
    if (cached && event.request.method === 'GET') return cached;
    try {
      const res = await fetch(event.request);
      if (event.request.method === 'GET' && res.ok) {
        cache.put(event.request, res.clone());
      }
      return res;
    } catch (err) {
      if (cached) return cached;
      throw err;
    }
  })());
});
