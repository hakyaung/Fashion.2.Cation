// frontend_react/src/utils/videoPreloader.js
// 🚀 틱톡/릴스 방식: 다음 영상을 Blob으로 메모리에 미리 통째로 받아두는 글로벌 캐시

const blobCache = new Map();   // originalUrl -> blobUrl (string)
const pendingFetch = new Map(); // originalUrl -> Promise (중복 요청 방지)

const MAX_CACHE = 8; // 최대 8개 Blob 보관 (메모리 관리)

// 오래된 캐시 정리 (LRU 방식)
function pruneCache() {
  if (blobCache.size <= MAX_CACHE) return;
  const oldest = [...blobCache.keys()][0];
  URL.revokeObjectURL(blobCache.get(oldest)); // 메모리 해제
  blobCache.delete(oldest);
}

/**
 * 영상을 백그라운드에서 Blob으로 다운로드해 캐시에 저장
 * 이미 캐시됐거나 다운로드 중이면 아무것도 안 함
 */
export function preloadVideo(url) {
  if (!url || blobCache.has(url) || pendingFetch.has(url)) return;

  const promise = fetch(url)
    .then(res => {
      if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
      return res.blob();
    })
    .then(blob => {
      const blobUrl = URL.createObjectURL(blob);
      blobCache.set(url, blobUrl);
      pruneCache();
    })
    .catch(() => {
      // 실패해도 원본 URL로 폴백되므로 조용히 무시
    })
    .finally(() => {
      pendingFetch.delete(url);
    });

  pendingFetch.set(url, promise);
}

/**
 * 캐시된 Blob URL 반환. 캐시 미스면 null 반환 (원본 URL로 폴백)
 */
export function getCachedUrl(url) {
  return blobCache.get(url) ?? null;
}

export function isCached(url) {
  return blobCache.has(url);
}