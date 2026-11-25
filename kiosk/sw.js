/* 오프라인 대비: 인터넷이 잠깐 끊겨도 마지막으로 받은 화면을 보여줍니다. */
const CACHE = 'idf-kiosk-v7';
self.addEventListener('install', (e) => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(
  caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
));
// 항상 네트워크 먼저 → 실패하면 캐시 (배포하면 바로 반영되도록)
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).then((res) => {
      if (res.ok && (new URL(e.request.url).origin === location.origin || e.request.url.includes('pretendard'))) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
      }
      return res;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
