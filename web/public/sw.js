/* 아주 단순한 오프라인 앱 셸 캐시.
   - 같은 출처의 GET 요청만 런타임 캐시.
   - 네트워크 우선, 실패하면 캐시로 폴백 (오프라인에서 마지막 화면 표시).
   - Supabase 등 외부 API 요청은 건드리지 않는다. */
const CACHE = "wed-invite-v1";

self.addEventListener("install", () => self.skipWaiting());
// 페이지가 새 버전 활성화를 요청하면 즉시 대기 해제
self.addEventListener("message", (e) => { if (e.data === "skipWaiting") self.skipWaiting(); });
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // 외부(API) 요청 무시
  e.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(req).then((c) => c || caches.match("index.html")))
  );
});
