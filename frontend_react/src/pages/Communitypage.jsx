import React, { useState, useCallback, useRef } from 'react'; 
import { useAuth } from '../context/Authcontext';

// 레이아웃 및 뷰
import TopNav from '../components/layout/Topnav';
import LeftSidebar from '../components/layout/Leftsidebar';
import RightSidebar from '../components/layout/Rightsidebar';
import MobileNav from '../components/layout/Mobilenav';
import FeedView from '../components/feed/Feedview';
import ProfileView from '../components/profile/Profileview';
import MessageListView from '../components/chat/MessageListView';
import FashionEvalView from '../components/fashion/FashionEvalView'; // 💡 [추가됨] 패션 평가 뷰

// 모달
import AuthModal from '../components/modals/Authmodal';
import PostModal from '../components/modals/PostModal';
import CommentModal from '../components/modals/Commentmodal';
import EditModal from '../components/modals/Editmodal';
import ChatRoomModal from '../components/modals/ChatRoomModal'; 

export default function CommunityPage() {
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
      alert('채팅을 이용하려면 로그인이 필요합니다.');
      openAuthModal('login');
      return;
    }
    setChatModal({ isOpen: true, targetUser: user });
  }, [isLoggedIn, openAuthModal]);

  // ==========================================
  // 모달 상태
  // ==========================================
  const [postModalOpen, setPostModalOpen] = useState(false);
  const [commentModal, setCommentModal] = useState({
    open: false,
    postId: null,
    postOwnerId: null, // 💡 [추가됨] 댓글 권한 관리용
    onAdded: null,
    onRemoved: null,   // 💡 [추가됨] 댓글 삭제 업데이트용
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
          alert('이 기능을 이용하려면 로그인이 필요합니다.');
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
    [isLoggedIn, openAuthModal]
  );

  // 💡 [유지됨] 피드에서 프로필 사진이나 이름 클릭 시 호출될 함수 (기존 기능)
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

  // 💡 [수정됨] 매개변수가 확장된 댓글 오픈 핸들러
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
              onProfileClick={handleProfileClick} // 💡 [유지됨] FeedView로 함수 전달
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

          {/* 💡 [추가됨] 패션 평가 뷰 라우팅 */}
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

      {/* 💡 [수정됨] 추가된 props를 모두 받는 CommentModal */}
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