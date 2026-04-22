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

// 스냅(숏폼) 관련 컴포넌트
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
  // 뷰 및 검색 상태
  // ==========================================
  const [activeView, setActiveView] = useState('home'); 
  const [viewUserId, setViewUserId] = useState(null); 
  
  // 💡 [핵심 수정] 기본 피드 상태를 'random'으로 설정
  const [sort, setSort] = useState('random'); 
  
  const [searchKeyword, setSearchKeyword] = useState('');
  const [userGeo, setUserGeo] = useState({ lat: null, lng: null });
  const [feedKey, setFeedKey] = useState(0);
  const [debouncedKeyword, setDebouncedKeyword] = useState('');
  const searchTimerRef = useRef(null);

  // ==========================================
  // 💬 채팅 및 모달 상태
  // ==========================================
  const [chatModal, setChatModal] = useState({ isOpen: false, targetUser: null });
  const [postModalOpen, setPostModalOpen] = useState(false);
  
  // 💡 commentModal 상태: type 뿐만 아니라 실시간 카운트 함수(onAdded, onRemoved)를 담습니다.
  const [commentModal, setCommentModal] = useState({
    open: false,
    postId: null,
    postOwnerId: null, 
    type: 'post',
    onAdded: null,
    onRemoved: null,  
  });
  
  const [editModal, setEditModal] = useState({ open: false, post: null, type: 'post' });

  // ==========================================
  // 핸들러 함수들
  // ==========================================

  const handleSearchChange = useCallback((value) => {
    setSearchKeyword(value);
    clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setDebouncedKeyword(value);
    }, 400);
  }, []);

  const handleNavigate = useCallback((view, targetUserId = null) => {
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
  }, [isLoggedIn, openAuthModal, t]);

  const handleOpenChat = useCallback((user) => {
    if (!isLoggedIn) {
      alert(t('community.needLoginChat')); 
      openAuthModal('login');
      return;
    }
    setChatModal({ isOpen: true, targetUser: user });
  }, [isLoggedIn, openAuthModal, t]);

  const handleProfileClick = useCallback((userId) => {
    if (!userId) return;
    handleNavigate('profile', userId);
  }, [handleNavigate]);

  // 💡 [핵심 수정] 같은 필터를 다시 누르면 'random'으로 해제되도록 변경
  const handleSort = useCallback((newSort) => {
    setSort((prevSort) => {
      if (prevSort === newSort && newSort !== 'random') {
        return 'random';
      }
      return newSort;
    });
    setActiveView('home');
    setFeedKey((k) => k + 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleTagSearch = useCallback((tag) => {
    const keyword = tag.replace('#', '').trim();
    setSearchKeyword(keyword);
    setDebouncedKeyword(keyword);
    setSort('random'); // 💡 태그 검색 시에도 기본을 랜덤 피드로 설정
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
        
        // 💡 [핵심 수정] 주변 지역(nearby) 역시 한번 더 누르면 랜덤(random)으로 해제
        setSort((prevSort) => (prevSort === 'nearby' ? 'random' : 'nearby'));
        
        setActiveView('home');
        setFeedKey((k) => k + 1);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      },
      () => alert(t('community.geoDenied'))
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
    setSort('latest'); // 새 글 작성 직후엔 자신이 쓴 글을 확인하도록 최신순 유지
    setSearchKeyword('');
    setDebouncedKeyword('');
    setFeedKey((k) => k + 1);
  }, []);

  // 💡 [핵심 유지] 댓글 모달 오픈 핸들러
  const handleCommentOpen = useCallback((postId, postOwnerId, type = 'post', onAdded, onRemoved) => {
    setCommentModal({ open: true, postId, postOwnerId, type, onAdded, onRemoved });
  }, []);

  const handleEditOpen = useCallback((post, type = 'post') => {
    setEditModal({ open: true, post, type });
  }, []);

  const handleEdited = useCallback(() => {
    setFeedKey((k) => k + 1);
  }, []);

  // 💡 [기능 유지] IP 자동 감지 로직이 포함된 스냅 삭제 핸들러
  const handleDeleteSnap = useCallback(async (snapId) => {
    const token = localStorage.getItem('stylescape_token');
    if (!token) return;

    try {
      const currentProtocol = window.location.protocol;
      const currentHost = window.location.hostname;
      const API_BASE = currentProtocol === 'https:' ? `https://${currentHost}` : `http://${currentHost}:8000`;

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
            <ProfileView targetUserId={viewUserId} onOpenChat={handleOpenChat} />
          )}

          {activeView === 'messages' && (
            <MessageListView currentUserId={currentUserId} onRoomClick={handleOpenChat} />
          )}

          {activeView === 'fashion-eval' && <FashionEvalView />}

          {activeView === 'snap' && (
            <SnapFeed 
              key={`snap-${feedKey}`}
              onProfileClick={handleProfileClick}
              // 💡 [수정 포인트] SnapFeed에서 전달하는 onAdded, onRemoved 인자를 handleCommentOpen으로 토스합니다.
              onCommentOpen={(id, ownerId, type, onAdded, onRemoved) => 
                handleCommentOpen(id, ownerId, type, onAdded, onRemoved)
              }
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
      <PostModal isOpen={postModalOpen} onClose={() => setPostModalOpen(false)} onPosted={handlePosted} />

      <CommentModal
        isOpen={commentModal.open}
        postId={commentModal.postId}
        postOwnerId={commentModal.postOwnerId}
        type={commentModal.type} 
        onClose={() => setCommentModal({ open: false, postId: null, postOwnerId: null, type: 'post', onAdded: null, onRemoved: null })}
        // 💡 상태에 저장된 카운트 업데이트 함수를 모달에 전달
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