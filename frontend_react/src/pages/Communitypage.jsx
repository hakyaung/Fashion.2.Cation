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
  
  // 💡 commentModal 상태 (type으로 post/snap 구분)
  const [commentModal, setCommentModal] = useState({
    open: false,
    postId: null,
    postOwnerId: null, 
    type: 'post',
    onAdded: null,
    onRemoved: null,  
  });
  
  // 💡 EditModal 상태 (type으로 post/snap 구분)
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

  const handleCommentOpen = useCallback((postId, postOwnerId, type = 'post', onAdded, onRemoved) => {
    setCommentModal({ open: true, postId, postOwnerId, type, onAdded, onRemoved });
  }, []);

  const handleEditOpen = useCallback((post, type = 'post') => {
    setEditModal({ open: true, post, type });
  }, []);

  const handleEdited = useCallback(() => {
    setFeedKey((k) => k + 1);
  }, []);

  // 💡 [수정됨] 스냅 삭제 시 AWS/로컬 환경 자동 감지 로직 적용
  const handleDeleteSnap = useCallback(async (snapId) => {
    const token = localStorage.getItem('stylescape_token');
    if (!token) return;

    try {
      const currentProtocol = window.location.protocol;
      const currentHost = window.location.hostname;
      
      // HTTPS(AWS)면 443 포트, HTTP(로컬)면 8000 포트
      const API_BASE = currentProtocol === 'https:'
        ? `https://${currentHost}`
        : `http://${currentHost}:8000`;

      const response = await fetch(`${API_BASE}/api/v1/posts/snaps/${snapId}`, {
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
              // 일반 피드이므로 type='post'를 명시적으로 전달
              onCommentOpen={(postId, postUserId, onAdded, onRemoved) =>
                handleCommentOpen(postId, postUserId, 'post', onAdded, onRemoved)
              }
              onEditOpen={(post) => handleEditOpen(post, 'post')}
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