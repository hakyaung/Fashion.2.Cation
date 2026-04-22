// frontend_react/src/pages/CommunityPage.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import PreferenceOnboarding from '../components/modals/PreferenceOnboarding'; 

export default function CommunityPage() {
  const { t } = useTranslation(); 
  const { isLoggedIn, openAuthModal, currentUserId } = useAuth(); 

  // ==========================================
  // 뷰 및 검색 상태
  // ==========================================
  const [activeView, setActiveView] = useState('home'); 
  const [viewUserId, setViewUserId] = useState(null); 
  
  // 기본 피드 상태 'random'
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
  
  // 온보딩 모달 상태 관리
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  
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
  // 로그인 감지 시 온보딩 모달 자동 오픈 로직
  // ==========================================
  useEffect(() => {
    // 로그인 상태이고, 로컬 스토리지에 온보딩 완료 기록이 없다면 띄웁니다.
    if (isLoggedIn && !localStorage.getItem('stylescape_onboarding_done')) {
      setOnboardingOpen(true);
    }
  }, [isLoggedIn]);

  const handleOnboardingComplete = useCallback(() => {
    // 취향 설정 완료 기록을 저장하여 다시 안 뜨게 처리
    localStorage.setItem('stylescape_onboarding_done', 'true');
    setOnboardingOpen(false);
    
    // 취향 설정 후 즉시 '추천 의류(recommend)' 피드로 전환
    setSort('recommend');
    setActiveView('home');
    setFeedKey(k => k + 1); 
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

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
    setSort('random'); 
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
        setSort((prevSort) => (prevSort === 'nearby' ? 'random' : 'nearby'));
        setActiveView('home');
        setFeedKey((k) => k + 1);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      },
      () => alert(t('community.geoDenied'))
    );
  }, [t]);

  // 🚀 [핵심 추가] 현재 화면 상태에 따라 스마트하게 분기하는 POST 핸들러
  const handleSmartPostClick = useCallback(() => {
    if (!isLoggedIn) {
      openAuthModal('login');
      return;
    }
    
    // 현재 스냅 화면을 보고 있다면 스냅 업로드 창으로 즉시 이동
    if (activeView === 'snap') {
      handleNavigate('snap-upload');
    } else {
      // 그 외의 화면(홈 등)에서는 일반 POST 모달 띄우기
      setPostModalOpen(true);
    }
  }, [isLoggedIn, activeView, handleNavigate, openAuthModal]);

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
          onOpenPostModal={handleSmartPostClick} // 💡 스마트 핸들러 적용
          onOpenSnapUpload={() => handleNavigate('snap-upload')} 
        />
      </div>

      {/* 모바일 하단 네비게이션 */}
      <MobileNav
        onNavigate={handleNavigate}
        onSort={handleSort}
        onNearby={handleNearby}
        onOpenPost={handleSmartPostClick} // 💡 스마트 핸들러 적용
        currentSort={sort} 
      />

      {/* ===== 공통 모달 레이어 ===== */}
      <AuthModal />
      <PostModal isOpen={postModalOpen} onClose={() => setPostModalOpen(false)} onPosted={handlePosted} />

      <PreferenceOnboarding 
        isOpen={onboardingOpen} 
        onClose={() => setOnboardingOpen(false)} 
        onSave={handleOnboardingComplete} 
      />

      <CommentModal
        isOpen={commentModal.open}
        postId={commentModal.postId}
        postOwnerId={commentModal.postOwnerId}
        type={commentModal.type} 
        onClose={() => setCommentModal({ open: false, postId: null, postOwnerId: null, type: 'post', onAdded: null, onRemoved: null })}
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