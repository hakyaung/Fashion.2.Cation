import React, { useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next'; // 💡 [추가됨] 다국어 번역 훅
import { useAuth } from '../context/Authcontext';

// 레이아웃 및 뷰
import TopNav from '../components/layout/Topnav';
import LeftSidebar from '../components/layout/Leftsidebar';
import RightSidebar from '../components/layout/Rightsidebar';
import MobileNav from '../components/layout/Mobilenav';
import FeedView from '../components/feed/Feedview';
import ProfileView from '../components/profile/Profileview';
import MessageListView from '../components/chat/MessageListView';
import FashionEvalView from '../components/fashion/FashionEvalView'; // 💡 패션 평가 뷰

// 모달
import AuthModal from '../components/modals/Authmodal';
import PostModal from '../components/modals/PostModal';
import CommentModal from '../components/modals/Commentmodal';
import EditModal from '../components/modals/Editmodal';
import ChatRoomModal from '../components/modals/ChatRoomModal'; 

export default function CommunityPage() {
  const { t } = useTranslation(); // 💡 [추가됨] 다국어 번역 함수 가져오기
  const { isLoggedIn, openAuthModal, currentUserId } = useAuth(); 

  // ==========================================
  // 뷰 상태
  // ==========================================
  const [activeView, setActiveView] = useState('home'); 
  const [viewUserId, setViewUserId] = useState(null); 

  const [sort, setSort] = useState('latest');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [userGeo, setUserGeo] = useState({ lat: null, lng: null });

  // ==========================================
  // 💬 채팅 모달 상태 (전역 관리)
  // ==========================================
  const [chatModal, setChatModal] = useState({ isOpen: false, targetUser: null });

  const handleOpenChat = useCallback((user) => {
    if (!isLoggedIn) {
      alert(t('community.needLoginChat')); // 💡 [수정됨] 다국어 적용
      openAuthModal('login');
      return;
    }
    setChatModal({ isOpen: true, targetUser: user });
  }, [isLoggedIn, openAuthModal, t]);

  // ==========================================
  // 모달 상태
  // ==========================================
  const [postModalOpen, setPostModalOpen] = useState(false);
  const [commentModal, setCommentModal] = useState({
    open: false,
    postId: null,
    postOwnerId: null, // 💡 댓글 권한 관리용
    onAdded: null,
    onRemoved: null,   // 💡 댓글 삭제 업데이트용
  });
  const [editModal, setEditModal] = useState({ open: false, post: null });

  const [feedKey, setFeedKey] = useState(0);

  // 검색 디바운스
  const searchTimerRef = useRef(null);
  const [debouncedKeyword, setDebouncedKeyword] = useState('');

  const handleSearchChange = useCallback((value) => {
    setSearchKeyword(value);
    clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setDebouncedKeyword(value);
    }, 400);
  }, []);

  const handleNavigate = useCallback(
    (view, targetUserId = null) => {
      if (view === 'profile' || view === 'messages') {
        if (!isLoggedIn && !targetUserId) {
          alert(t('community.needLoginFeature')); // 💡 [수정됨] 다국어 적용
          openAuthModal('login');
          return;
        }
        setViewUserId(targetUserId); 
      } else {
        setViewUserId(null); 
      }
      setActiveView(view);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [isLoggedIn, openAuthModal, t]
  );

  // 💡 피드에서 프로필 사진이나 이름 클릭 시 호출될 함수 (기존 기능 유지)
  const handleProfileClick = useCallback((userId) => {
    if (!userId) return;
    handleNavigate('profile', userId);
  }, [handleNavigate]);

  const handleSort = useCallback((newSort) => {
    setSort(newSort);
    setActiveView('home');
    setFeedKey((k) => k + 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleTagSearch = useCallback((tag) => {
    const keyword = tag.replace('#', '').trim();
    setSearchKeyword(keyword);
    setDebouncedKeyword(keyword);
    setSort('latest');
    setActiveView('home');
    setFeedKey((k) => k + 1);
  }, []);

  const handleNearby = useCallback(() => {
    if (!('geolocation' in navigator)) {
      alert(t('community.geoUnsupported')); // 💡 [수정됨] 다국어 적용
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
        alert(t('community.geoDenied')); // 💡 [수정됨] 다국어 적용
      }
    );
  }, [t]);

  const handleOpenPostModal = useCallback(() => {
    if (!isLoggedIn) {
      openAuthModal('login');
      return;
    }
    setPostModalOpen(true);
  }, [isLoggedIn, openAuthModal]);

  const handlePosted = useCallback(() => {
    setActiveView('home');
    setSort('latest');
    setSearchKeyword('');
    setDebouncedKeyword('');
    setFeedKey((k) => k + 1);
  }, []);

  // 💡 매개변수가 확장된 댓글 오픈 핸들러 (유지)
  const handleCommentOpen = useCallback((postId, postOwnerId, onAdded, onRemoved) => {
    setCommentModal({ open: true, postId, postOwnerId, onAdded, onRemoved });
  }, []);

  const handleEditOpen = useCallback((post) => {
    setEditModal({ open: true, post });
  }, []);

  const handleEdited = useCallback(() => {
    setFeedKey((k) => k + 1);
  }, []);

  return (
    <>
      <TopNav
        searchKeyword={searchKeyword}
        onSearchChange={handleSearchChange}
        onUserSelect={(userId) => handleNavigate('profile', userId)} 
      />

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
          {activeView === 'home' && (
            <FeedView
              key={`feed-${feedKey}-${sort}-${debouncedKeyword}`}
              sort={sort}
              searchKeyword={debouncedKeyword}
              userGeo={userGeo}
              onTagSearch={handleTagSearch}
              onCommentOpen={handleCommentOpen}
              onEditOpen={handleEditOpen}
              onProfileClick={handleProfileClick} 
              onFeedSort={handleSort} // 💡 [추가됨] FeedView 내부 정렬 변경용
              isActive={activeView === 'home'}
            />
          )}

          {activeView === 'profile' && (
            <ProfileView 
              targetUserId={viewUserId} 
              onOpenChat={handleOpenChat} 
            />
          )}

          {activeView === 'messages' && (
            <MessageListView 
              currentUserId={currentUserId} 
              onRoomClick={(targetUser) => {
                handleOpenChat(targetUser);
              }} 
            />
          )}

          {/* 💡 패션 평가 뷰 라우팅 유지 */}
          {activeView === 'fashion-eval' && <FashionEvalView />}
        </main>

        <RightSidebar onOpenPostModal={handleOpenPostModal} />
      </div>

      <MobileNav
        onNavigate={handleNavigate}
        onSort={handleSort}
        onNearby={handleNearby}
        onOpenPost={handleOpenPostModal}
      />

      {/* ===== 공통 모달 레이어 ===== */}
      <AuthModal />

      <PostModal
        isOpen={postModalOpen}
        onClose={() => setPostModalOpen(false)}
        onPosted={handlePosted}
      />

      {/* 💡 추가된 props를 모두 받는 CommentModal 유지 */}
      <CommentModal
        isOpen={commentModal.open}
        postId={commentModal.postId}
        postOwnerId={commentModal.postOwnerId}
        onClose={() =>
          setCommentModal({
            open: false,
            postId: null,
            postOwnerId: null,
            onAdded: null,
            onRemoved: null,
          })
        }
        onCommentAdded={commentModal.onAdded}
        onCommentRemoved={commentModal.onRemoved}
      />

      <EditModal
        post={editModal.open ? editModal.post : null}
        onClose={() => setEditModal({ open: false, post: null })}
        onEdited={handleEdited}
      />

      {chatModal.isOpen && (
        <ChatRoomModal 
          isOpen={chatModal.isOpen} 
          onClose={() => setChatModal({ isOpen: false, targetUser: null })} 
          currentUserId={currentUserId} 
          targetUser={chatModal.targetUser} 
        />
      )}
    </>
  );
}