import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next'; // 💡 다국어 훅 추가
import { fetchPosts } from '../../api/api';
import PostCard from './PostCard';
import useInfiniteScroll from '../../hooks/Useinfinitescroll';

const LIMIT = 5;

// 💡 1. 원래 코드에 있던 onProfileClick을 유지하고, 새롭게 추가된 userGeo, onFeedSort도 받습니다.
export default function FeedView({
  sort,
  searchKeyword,
  userGeo,
  onTagSearch,
  onCommentOpen,
  onEditOpen,
  isActive,
  onProfileClick,
  onFeedSort,
}) {
  const { t, i18n } = useTranslation(); // 💡 번역 함수 및 언어 객체 가져오기
  const [posts, setPosts] = useState([]);
  const [skip, setSkip] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMsg, setLoadingMsg] = useState('');

  // sort나 keyword가 바뀌면 피드 초기화
  const prevSortRef = useRef(sort);
  const prevKeywordRef = useRef(searchKeyword);

  useEffect(() => {
    if (prevSortRef.current !== sort || prevKeywordRef.current !== searchKeyword) {
      prevSortRef.current = sort;
      prevKeywordRef.current = searchKeyword;
      resetAndLoad();
    }
  });

  // 최초 마운트 시 로드
  useEffect(() => {
    resetAndLoad();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function resetAndLoad() {
    setPosts([]);
    setSkip(0);
    setHasMore(true);
    setLoadingMsg('');
    loadFeed(0, true);
  }

  const loadFeed = useCallback(
    async (currentSkip, reset = false) => {
      if (isLoading) return;
      setIsLoading(true);

      try {
        const newPosts = await fetchPosts({
          skip: currentSkip,
          limit: LIMIT,
          sort: prevSortRef.current,
          q: prevKeywordRef.current,
          lat: userGeo?.lat ?? null, // 💡 주변 지역 검색을 위한 좌표 추가
          lng: userGeo?.lng ?? null,
        });

        if (newPosts.length < LIMIT) {
          setHasMore(false);
          setLoadingMsg(
            newPosts.length === 0 && currentSkip === 0 
              ? t('feed.emptySearch') // 💡 다국어 적용
              : t('feed.endOfFeed')
          );
        } else {
          setLoadingMsg('');
        }

        setPosts((prev) => (reset ? newPosts : [...prev, ...newPosts]));
        setSkip(currentSkip + LIMIT);
      } catch (err) {
        setLoadingMsg(t('feed.loadError')); // 💡 다국어 적용
      } finally {
        setIsLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isLoading, t, userGeo]
  );

  const handleLoadMore = useCallback(() => {
    if (!isLoading && hasMore) {
      loadFeed(skip);
    }
  }, [isLoading, hasMore, loadFeed, skip]);

  useInfiniteScroll(handleLoadMore, isActive && hasMore);

  // ==========================================
  // 좋아요 토글 (로컬 상태 즉시 업데이트)
  // ==========================================
  const handleLikeToggle = useCallback((postId, status) => {
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id !== postId) return p;
        const liked = status === 'liked';
        return {
          ...p,
          is_liked: liked,
          like_count: liked ? p.like_count + 1 : Math.max(0, p.like_count - 1),
        };
      })
    );
  }, []);

  // ==========================================
  // 댓글 수 업데이트 (증가/감소 모두 포함)
  // ==========================================
  const handleCommentCountIncrease = useCallback((postId) => {
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId ? { ...p, comment_count: p.comment_count + 1 } : p
      )
    );
  }, []);

  // 💡 댓글이 삭제되었을 때 피드에서 댓글 수를 실시간으로 줄여줍니다.
  const handleCommentCountDecrease = useCallback((postId) => {
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId ? { ...p, comment_count: Math.max(0, p.comment_count - 1) } : p
      )
    );
  }, []);

  // ==========================================
  // 삭제 후 피드에서 제거
  // ==========================================
  const handleDeleted = useCallback((postId) => {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
  }, []);

  // 💡 언어 설정 (중국어 분기 처리 포함)
  const locale = i18n.language?.startsWith('zh') ? 'zh-CN' : i18n.language;

  return (
    <div id="view-home">
      <div className="feed-header">
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, color: 'var(--warm-black)' }}>
          {t('feed.title')}
        </h1>
        <div className="feed-filters">
          <button 
            type="button" 
            className={sort === 'latest' ? 'active' : ''} 
            onClick={() => onFeedSort && onFeedSort('latest')}
          >
            {t('feed.sortLatest')}
          </button>
          <button 
            type="button" 
            className={sort === 'popular' ? 'active' : ''} 
            onClick={() => onFeedSort && onFeedSort('popular')}
          >
            {t('feed.sortPopular')}
          </button>
        </div>
      </div>

      <div id="feed-container">
        {posts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            onTagSearch={onTagSearch}
            // 💡 댓글 추가/삭제 함수와 게시물 주인 ID를 함께 넘겨줍니다.
            onCommentOpen={(postId, postUserId) =>
              onCommentOpen(postId, postUserId, handleCommentCountIncrease, handleCommentCountDecrease)
            }
            onEditOpen={onEditOpen}
            onDeleted={handleDeleted}
            onLikeToggle={handleLikeToggle}
            // 💡 2. 원래 코드에 있던 프로필 클릭 기능을 잃어버리지 않고 넘겨줍니다!
            onProfileClick={onProfileClick}
            dateLocale={locale} // 💡 날짜 표시용 언어값 전달
          />
        ))}
      </div>

      <div id="loading-indicator" className="loading-indicator" style={{ display: isLoading || loadingMsg ? 'block' : 'none' }}>
        {isLoading ? <span>{t('feed.loadingMore')}</span> : loadingMsg}
      </div>
    </div>
  );
}