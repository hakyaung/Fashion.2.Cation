import React, { useState, useEffect, useCallback, useRef } from 'react';
import { fetchPosts } from '../../api/api';
import PostCard from './PostCard';
import useInfiniteScroll from '../../hooks/Useinfinitescroll';

const LIMIT = 5;

// 💡 1. 여기서 부모가 넘겨준 onProfileClick을 받아옵니다.
export default function FeedView({ sort, searchKeyword, onTagSearch, onCommentOpen, onEditOpen, isActive, onProfileClick }) {
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
        });

        if (newPosts.length < LIMIT) {
          setHasMore(false);
          setLoadingMsg(
            newPosts.length === 0 && currentSkip === 0
              ? '찾으시는 스타일이 아직 없네요! 🌿'
              : '마지막 스타일입니다. ✦'
          );
        } else {
          setLoadingMsg('');
        }

        setPosts((prev) => (reset ? newPosts : [...prev, ...newPosts]));
        setSkip(currentSkip + LIMIT);
      } catch (err) {
        setLoadingMsg('데이터 로드 실패');
      } finally {
        setIsLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isLoading]
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
  // 댓글 수 업데이트
  // ==========================================
  const handleCommentCountIncrease = useCallback((postId) => {
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId ? { ...p, comment_count: p.comment_count + 1 } : p
      )
    );
  }, []);

  // ==========================================
  // 삭제 후 피드에서 제거
  // ==========================================
  const handleDeleted = useCallback((postId) => {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
  }, []);

  return (
    <div id="view-home">
      <div className="feed-header">
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, color: 'var(--warm-black)' }}>
          Live Community
        </h1>
        <div className="feed-filters">
          <button
            className={sort === 'latest' ? 'active' : ''}
            onClick={() => onTagSearch && prevSortRef.current !== 'latest' && resetAndLoad()}
          >
            최신순
          </button>
          <button
            className={sort === 'popular' ? 'active' : ''}
          >
            인기순
          </button>
        </div>
      </div>

      <div id="feed-container">
        {posts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            onTagSearch={onTagSearch}
            onCommentOpen={(id) => onCommentOpen(id, handleCommentCountIncrease)}
            onEditOpen={onEditOpen}
            onDeleted={handleDeleted}
            onLikeToggle={handleLikeToggle}
            // 💡 2. PostCard로 onProfileClick을 넘겨줍니다!
            onProfileClick={onProfileClick} 
          />
        ))}
      </div>

      <div id="loading-indicator" className="loading-indicator" style={{ display: isLoading || loadingMsg ? 'block' : 'none' }}>
        {isLoading ? <span>✦ Loading more styles...</span> : loadingMsg}
      </div>
    </div>
  );
}