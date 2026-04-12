import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useAuth } from '../context/Authcontext';

// 💡 하경님의 실제 파일명(대문자 U)에 완벽하게 맞춘 경로
import useCursor from '../hooks/Usecursor';
import useInfiniteScroll from '../hooks/Useinfinitescroll';

// 💡 레이아웃 및 뷰 (소문자 파일명 반영)
import TopNav from '../components/layout/Topnav';
import LeftSidebar from '../components/layout/Leftsidebar';
import RightSidebar from '../components/layout/Rightsidebar';
import MobileNav from '../components/layout/Mobilenav';
import FeedView from '../components/feed/Feedview';
import ProfileView from '../components/profile/Profileview';

// 💡 모달 (PostModal만 대문자 M인 부분까지 정확히 반영)
import AuthModal from '../components/modals/Authmodal';
import PostModal from '../components/modals/PostModal';
import CommentModal from '../components/modals/Commentmodal';
import EditModal from '../components/modals/Editmodal';

export default function CommunityPage() {
  const { isLoggedIn, openAuthModal } = useAuth();
  const { cursorRef, followerRef } = useCursor();

  // ==========================================
  // 뷰 상태
  // ==========================================
  const [activeView, setActiveView] = useState('home'); // 'home' | 'profile'
  const [sort, setSort] = useState('latest');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [userGeo, setUserGeo] = useState({ lat: null, lng: null });

  // ==========================================
  // 모달 상태
  // ==========================================
  const [postModalOpen, setPostModalOpen] = useState(false);
  const [commentModal, setCommentModal] = useState({ open: false, postId: null, onAdded: null });
  const [editModal, setEditModal] = useState({ open: false, post: null });

  // 피드를 강제 새로고침하기 위한 key
  const [feedKey, setFeedKey] = useState(0);

  // ==========================================
  // 검색 디바운스
  // ==========================================
  const searchTimerRef = useRef(null);
  const [debouncedKeyword, setDebouncedKeyword] = useState('');

  const handleSearchChange = useCallback((value) => {
    setSearchKeyword(value);
    clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setDebouncedKeyword(value);
    }, 400);
  }, []);

  // ==========================================
  // 뷰 전환
  // ==========================================
  const handleNavigate = useCallback(
    (view) => {
      if (view === 'profile') {
        if (!isLoggedIn) {
          alert('프로필을 보려면 로그인이 필요합니다.');
          openAuthModal('login');
          return;
        }
      }
      setActiveView(view);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [isLoggedIn, openAuthModal]
  );

  // ==========================================
  // 정렬 변경
  // ==========================================
  const handleSort = useCallback((newSort) => {
    setSort(newSort);
    setActiveView('home');
    setFeedKey((k) => k + 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // ==========================================
  // 태그 검색
  // ==========================================
  const handleTagSearch = useCallback((tag) => {
    const keyword = tag.replace('#', '').trim();
    setSearchKeyword(keyword);
    setDebouncedKeyword(keyword);
    setSort('latest');
    setActiveView('home');
    setFeedKey((k) => k + 1);
  }, []);

  // ==========================================
  // 내 주변 (Geolocation)
  // ==========================================
  const handleNearby = useCallback(() => {
    if (!('geolocation' in navigator)) {
      alert('이 브라우저는 위치 정보를 지원하지 않습니다.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserGeo({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setSort('nearby');
        setActiveView('home');
        setFeedKey((k) => k + 1);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      },
      () => {
        alert('위치 정보 권한이 거부되었습니다.');
      }
    );
  }, []);

  // ==========================================
  // 글쓰기 모달 열기
  // ==========================================
  const handleOpenPostModal = useCallback(() => {
    if (!isLoggedIn) {
      alert('글을 작성하려면 로그인이 필요합니다.');
      openAuthModal('login');
      return;
    }
    setPostModalOpen(true);
  }, [isLoggedIn, openAuthModal]);

  // ==========================================
  // 게시 완료 후 피드 새로고침
  // ==========================================
  const handlePosted = useCallback(() => {
    setActiveView('home');
    setSort('latest');
    setSearchKeyword('');
    setDebouncedKeyword('');
    setFeedKey((k) => k + 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // ==========================================
  // 댓글 모달
  // ==========================================
  const handleCommentOpen = useCallback((postId, onAdded) => {
    setCommentModal({ open: true, postId, onAdded });
  }, []);

  // ==========================================
  // 수정 모달
  // ==========================================
  const handleEditOpen = useCallback((post) => {
    setEditModal({ open: true, post });
  }, []);

  const handleEdited = useCallback(() => {
    setFeedKey((k) => k + 1);
  }, []);

  return (
    <>
      {/* 커스텀 커서 */}
      <div className="cursor" ref={cursorRef} />
      <div className="cursor-follower" ref={followerRef} />

      {/* 상단 내비게이션 */}
      <TopNav
        searchKeyword={searchKeyword}
        onSearchChange={handleSearchChange}
      />

      {/* 메인 레이아웃 */}
      <div className="community-layout" id="communityLayout">
        <LeftSidebar
          activeView={activeView}
          activeSort={sort}
          onNavigate={handleNavigate}
          onSort={handleSort}
          onNearby={handleNearby}
          onTagSearch={handleTagSearch}
        />

        <main className="center-feed">
          {/* 홈 피드 */}
          {activeView === 'home' && (
            <FeedView
              key={`feed-${feedKey}-${sort}-${debouncedKeyword}`}
              sort={sort}
              searchKeyword={debouncedKeyword}
              userGeo={userGeo}
              onTagSearch={handleTagSearch}
              onCommentOpen={handleCommentOpen}
              onEditOpen={handleEditOpen}
              isActive={activeView === 'home'}
            />
          )}

          {/* 프로필 뷰 */}
          {activeView === 'profile' && <ProfileView />}
        </main>

        <RightSidebar onOpenPostModal={handleOpenPostModal} />
      </div>

      {/* 모바일 하단 내비게이션 */}
      <MobileNav
        onNavigate={handleNavigate}
        onSort={handleSort}
        onNearby={handleNearby}
        onOpenPost={handleOpenPostModal}
      />

      {/* ===== 모달들 ===== */}
      <AuthModal />

      <PostModal
        isOpen={postModalOpen}
        onClose={() => setPostModalOpen(false)}
        onPosted={handlePosted}
      />

      <CommentModal
        isOpen={commentModal.open}
        postId={commentModal.postId}
        onClose={() => setCommentModal({ open: false, postId: null, onAdded: null })}
        onCommentAdded={commentModal.onAdded}
      />

      <EditModal
        post={editModal.open ? editModal.post : null}
        onClose={() => setEditModal({ open: false, post: null })}
        onEdited={handleEdited}
      />
    </>
  );
}