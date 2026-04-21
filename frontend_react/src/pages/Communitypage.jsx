// frontend_react/src/pages/CommunityPage.jsx
import React, { useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next'; 
import { useAuth } from '../context/Authcontext';

// 레이아웃 및 뷰
import TopNav from '../components/layout/Topnav';
import LeftSidebar from '../components/layout/Leftsidebar';
import RightSidebar from '../components/layout/Rightsidebar';
import MobileNav from '../components/layout/Mobilenav';
import FeedView from '../components/feed/Feedview';
import ProfileView from '../components/profile/Profileview';
import MessageListView from '../components/chat/MessageListView';
import FashionEvalView from '../components/fashion/FashionEvalView'; 

// 💡 스냅(숏폼) 관련 컴포넌트
import SnapFeed from '../components/snaps/SnapFeed';
import SnapUpload from '../components/snaps/SnapUpload';

// 모달
import AuthModal from '../components/modals/Authmodal';
import PostModal from '../components/modals/PostModal';
import CommentModal from '../components/modals/Commentmodal';
import EditModal from '../components/modals/Editmodal';
import ChatRoomModal from '../components/modals/ChatRoomModal'; 

export default function CommunityPage() {
  const { t } = useTranslation(); 
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
  // 💬 채팅 모달 상태
  // ==========================================
  const [chatModal, setChatModal] = useState({ isOpen: false, targetUser: null });

  const handleOpenChat = useCallback((user) => {
    if (!isLoggedIn) {
      alert(t('community.needLoginChat')); 
      openAuthModal('login');
      return;
    }
    setChatModal({ isOpen: true, targetUser: user });
  }, [isLoggedIn, openAuthModal, t]);

  // ==========================================
  // 모달 및 피드 리프레시 상태
  // ==========================================
  const [postModalOpen, setPostModalOpen] = useState(false);
  
  // 💡 commentModal 상태에 type(post/snap) 추가
  const [commentModal, setCommentModal] = useState({
    open: false,
    postId: null,
    postOwnerId: null, 
    type: 'post', // 기본값은 post
    onAdded: null,
    onRemoved: null,  
  });
  
  // 💡 [수정됨] EditModal 상태에도 type을 추가합니다!
  const [editModal, setEditModal] = useState({ open: false, post: null, type: 'post' });

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
      if (view === 'profile' || view === 'messages' || view === 'snap-upload') {
        if (!isLoggedIn && !targetUserId) {
          alert(t('community.needLoginFeature')); 
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
      alert(t('community.geoUnsupported')); 
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
        alert(t('community.geoDenied')); 
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

  // 💡 handleCommentOpen이 type을 인자로 받도록 수정
  const handleCommentOpen = useCallback((postId, postOwnerId, type = 'post', onAdded, onRemoved) => {
    setCommentModal({ open: true, postId, postOwnerId, type, onAdded, onRemoved });
  }, []);

  // 💡 [수정됨] handleEditOpen이 type을 인자로 받도록 수정
  const handleEditOpen = useCallback((post, type = 'post') => {
    setEditModal({ open: true, post, type });
  }, []);

  const handleEdited = useCallback(() => {
    setFeedKey((k) => k + 1);
  }, []);

  const handleDeleteSnap = useCallback(async (snapId) => {
    const token = localStorage.getItem('stylescape_token');
    if (!token) return;

    try {
      const response = await fetch(`http://localhost:8000/api/v1/posts/snaps/${snapId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        setFeedKey(k => k + 1); 
      } else {
        alert("삭제에 실패했습니다.");
      }
    } catch (error) {
      console.error("삭제 에러:", error);
    }
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
              onFeedSort={handleSort} 
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

          {activeView === 'fashion-eval' && <FashionEvalView />}

          {/* ========================================== */}
          {/* 🎬 스냅(숏폼) 뷰 */}
          {/* ========================================== */}
          {activeView === 'snap' && (
            <SnapFeed 
              key={`snap-${feedKey}`}
              onProfileClick={handleProfileClick}
              onCommentOpen={(id, ownerId) => handleCommentOpen(id, ownerId, 'snap')} 
              // 💡 [수정됨] 스냅을 수정할 때 'snap' 꼬리표를 확실하게 달아줍니다!
              onEditOpen={(snap) => handleEditOpen(snap, 'snap')}
              onDeleteSnap={handleDeleteSnap}
            />
          )}
          
          {activeView === 'snap-upload' && (
            <SnapUpload 
              onUploadComplete={() => {
                setFeedKey(k => k + 1);
                setActiveView('snap'); 
              }} 
            />
          )}
        </main>

        <RightSidebar 
          activeView={activeView}
          onOpenPostModal={handleOpenPostModal}
          onOpenSnapUpload={() => handleNavigate('snap-upload')} 
        />
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

      {/* 💡 type 프롭을 CommentModal에 전달 */}
      <CommentModal
        isOpen={commentModal.open}
        postId={commentModal.postId}
        postOwnerId={commentModal.postOwnerId}
        type={commentModal.type} 
        onClose={() =>
          setCommentModal({
            open: false,
            postId: null,
            postOwnerId: null,
            type: 'post',
            onAdded: null,
            onRemoved: null,
          })
        }
        onCommentAdded={commentModal.onAdded}
        onCommentRemoved={commentModal.onRemoved}
      />

      {/* 💡 [수정됨] type 프롭을 EditModal에 전달하여 API 주소를 구분하게 합니다. */}
      <EditModal
        post={editModal.open ? editModal.post : null}
        type={editModal.type} 
        onClose={() => setEditModal({ open: false, post: null, type: 'post' })}
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