// frontend_react/src/components/feed/Feedview.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next'; // 💡 다국어 훅
import { fetchPosts } from '../../api/api';
import PostCard from './PostCard';
import useInfiniteScroll from '../../hooks/Useinfinitescroll';

const LIMIT = 5;

// =====================================================================
// 💡 [필수 설정] Firebase Storage 버킷 주소 설정
// Firebase 콘솔 -> Storage 상단에 적힌 'gs://' 다음의 주소를 아래에 적어주세요.
// 예시: "fashion2cation-ai.appspot.com"
// =====================================================================
const FIREBASE_BUCKET = "fashion2cation.firebasestorage.app"; 
const FIREBASE_FOLDER = "ai_dataset_large_image"; // Firebase Storage 내부 이미지 폴더 이름

export default function FeedView({
  sort = 'random', // 💡 기본값을 'random'으로 설정
  searchKeyword,
  userGeo,
  onTagSearch,
  onCommentOpen,
  onEditOpen,
  isActive,
  onProfileClick,
  onFeedSort,
}) {
  const { t, i18n } = useTranslation(); 
  const [posts, setPosts] = useState([]);
  const [skip, setSkip] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMsg, setLoadingMsg] = useState('');

  // sort나 keyword가 바뀌면 피드 초기화
  const prevSortRef = useRef(sort);
  const prevKeywordRef = useRef(searchKeyword);

  // 💡 [기능 유지] 현재 접속 환경(HTTP/HTTPS, 도메인/IP)을 감지하여 API 주소 동적 설정
  const currentProtocol = window.location.protocol;
  const currentHost = window.location.hostname;
  const API_BASE = currentProtocol === 'https:' 
    ? `https://${currentHost}` 
    : `http://${currentHost}:8000`;

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
        let newPosts = [];

        // 💡 AI 추천 피드 로직 (사이드바에서 선택 시 작동)
        if (prevSortRef.current === 'recommend') {
          const token = localStorage.getItem('stylescape_token');
          const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
          const page = Math.floor(currentSkip / LIMIT) + 1; // skip을 page 번호로 변환
          
          const res = await fetch(`${API_BASE}/api/v1/posts/recommendations/feed?page=${page}&size=${LIMIT}`, { headers });
          if (res.ok) {
            const products = await res.json();
            
            // 💡 AI 상품 데이터를 PostCard가 읽을 수 있는 형태로 변환
            newPosts = products.map(prod => {
              // 💡 [핵심 수정] 파일명을 이용해 Firebase Storage URL 동적 생성
              // %2F는 URL에서 폴더 경로 슬래시(/)를 의미합니다.
              const firebaseUrl = `https://firebasestorage.googleapis.com/v0/b/${FIREBASE_BUCKET}/o/${FIREBASE_FOLDER}%2F${prod.filename}?alt=media`;

              return {
                id: `prod_${prod.id}`, 
                user_id: "system_ai",
                content: `[${prod.brand || '추천 브랜드'}]\n${prod.product_name}\n\n💸 가격: ${prod.price?.toLocaleString() || 0}원\n⭐ 리뷰: ${prod.review_count || 0}개`,
                
                // 💡 image_url이 DB에 있다면 쓰고, 없으면 방금 만든 Firebase URL 사용
                image_url: prod.image_url || firebaseUrl,
                
                author: "🤖 AI 맞춤 추천",
                author_profile_image: "https://cdn-icons-png.flaticon.com/512/4712/4712027.png", 
                location: "Fashion.2.Cation Pick",
                created_at: prod.created_at || new Date().toISOString(),
                ai_status: "completed",
                is_liked: false,
                like_count: prod.heart_count || 0,
                comment_count: prod.review_count || 0,
                tags: [`#${prod.class_label}`, `#${prod.style}`, `#${prod.color}`].filter(t => t !== '#null' && t !== '#None')
              };
            });
          }
        } 
        // 💡 일반 피드 로직 (random, latest, popular, nearby 등)
        else {
          newPosts = await fetchPosts({
            skip: currentSkip,
            limit: LIMIT,
            sort: prevSortRef.current, // 'random' 상태가 그대로 백엔드 API로 넘어갑니다
            q: prevKeywordRef.current,
            lat: userGeo?.lat ?? null, 
            lng: userGeo?.lng ?? null,
          });
        }

        if (newPosts.length < LIMIT) {
          setHasMore(false);
          setLoadingMsg(
            newPosts.length === 0 && currentSkip === 0 
              ? t('feed.emptySearch', '검색 결과가 없습니다.') 
              : t('feed.endOfFeed', '피드의 끝입니다.')
          );
        } else {
          setLoadingMsg('');
        }

        // 🛡️ [핵심 유지] 무한스크롤 중복 ID 철벽 방어 로직!
        setPosts((prev) => {
          if (reset) return newPosts;
          const combined = [...prev, ...newPosts];
          const uniquePosts = Array.from(new Map(combined.map(post => [post.id, post])).values());
          return uniquePosts;
        });

        setSkip(currentSkip + LIMIT);
      } catch (err) {
        console.error("피드 로드 에러:", err);
        setLoadingMsg(t('feed.loadError', '피드를 불러오는 중 오류가 발생했습니다.')); 
      } finally {
        setIsLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isLoading, t, userGeo, API_BASE]
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

  // 💡 언어 설정
  const locale = i18n.language?.startsWith('zh') ? 'zh-CN' : i18n.language;

  // 💡 제목 동적 렌더링 (추천 피드일 때 제목 변경)
  const feedTitle = sort === 'recommend' ? "🤖 AI 추천 의류" : t('feed.title', 'Live Community');

  return (
    <div id="view-home">
      <div className="feed-header">
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, color: 'var(--warm-black)' }}>
          {feedTitle}
        </h1>
        
        {/* 💡 AI 추천 피드가 아닐 때만 최신순/인기순 필터 표시 */}
        {sort !== 'recommend' && (
          <div className="feed-filters">
            <button 
              type="button" 
              className={sort === 'latest' ? 'active' : ''} 
              onClick={() => onFeedSort && onFeedSort('latest')}
            >
              {t('feed.sortLatest', '최신순')}
            </button>
            <button 
              type="button" 
              className={sort === 'popular' ? 'active' : ''} 
              onClick={() => onFeedSort && onFeedSort('popular')}
            >
              {t('feed.sortPopular', '인기순')}
            </button>
          </div>
        )}
      </div>

      <div id="feed-container">
        {posts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            onTagSearch={onTagSearch}
            onCommentOpen={(postId, postUserId) => {
              if(String(postId).startsWith('prod_')) {
                alert("AI 추천 상품은 상세 페이지에서 리뷰를 확인할 수 있습니다.");
                return;
              }
              onCommentOpen(postId, postUserId, 'post', handleCommentCountIncrease, handleCommentCountDecrease)
            }}
            onEditOpen={onEditOpen}
            onDeleted={handleDeleted}
            onLikeToggle={handleLikeToggle}
            onProfileClick={onProfileClick}
            dateLocale={locale} 
          />
        ))}
      </div>

      <div id="loading-indicator" className="loading-indicator" style={{ display: isLoading || loadingMsg ? 'block' : 'none', textAlign: 'center', padding: '20px 0', color: '#999' }}>
        {isLoading ? <span>{t('feed.loadingMore', '더 불러오는 중...')}</span> : loadingMsg}
      </div>
    </div>
  );
}