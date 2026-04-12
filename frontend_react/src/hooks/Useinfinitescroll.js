import { useEffect, useCallback } from 'react';

/**
 * 스크롤이 하단 200px 이내로 내려오면 onLoadMore를 호출합니다.
 * @param {function} onLoadMore - 더 불러오는 콜백
 * @param {boolean} enabled - 현재 홈 뷰일 때만 true
 */
export default function useInfiniteScroll(onLoadMore, enabled) {
  const handleScroll = useCallback(() => {
    if (!enabled) return;
    const { scrollTop, scrollHeight, clientHeight } = document.documentElement;
    if (scrollTop + clientHeight >= scrollHeight - 200) {
      onLoadMore();
    }
  }, [onLoadMore, enabled]);

  useEffect(() => {
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);
}