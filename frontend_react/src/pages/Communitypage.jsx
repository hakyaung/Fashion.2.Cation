import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next'; 
import { useAuth } from '../context/Authcontext';

import TopNav from '../components/layout/Topnav';
import LeftSidebar from '../components/layout/Leftsidebar';
import RightSidebar from '../components/layout/Rightsidebar';
import MobileNav from '../components/layout/Mobilenav';
import FeedView from '../components/feed/Feedview';
import ProfileView from '../components/profile/Profileview';
import MessageListView from '../components/chat/MessageListView';
import FashionEvalView from '../components/fashion/FashionEvalView'; 

import SnapFeed from '../components/snaps/SnapFeed';
import SnapUpload from '../components/snaps/SnapUpload';

import AuthModal from '../components/modals/Authmodal';
import PostModal from '../components/modals/PostModal';
import CommentModal from '../components/modals/Commentmodal';
import EditModal from '../components/modals/Editmodal';
import ChatRoomModal from '../components/modals/ChatRoomModal'; 
import PreferenceOnboarding from '../components/modals/PreferenceOnboarding'; 

export default function CommunityPage() {
  const { t } = useTranslation(); 
  const { isLoggedIn, openAuthModal, currentUserId } = useAuth(); 

  const [activeView, setActiveView] = useState('home'); 
  const [viewUserId, setViewUserId] = useState(null); 
  const [sort, setSort] = useState('random'); 
  const [searchKeyword, setSearchKeyword] = useState('');
  const [userGeo, setUserGeo] = useState({ lat: null, lng: null });
  const [feedKey, setFeedKey] = useState(0);
  const [debouncedKeyword, setDebouncedKeyword] = useState('');
  const searchTimerRef = useRef(null);

  const [chatModal, setChatModal] = useState({ isOpen: false, targetUser: null });
  const [postModalOpen, setPostModalOpen] = useState(false);
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
  const [cachedSnaps, setCachedSnaps] = useState(null);

  // 스냅 프리패칭
  useEffect(() => {
    const preloadSnaps = async () => {
      try {
        const currentProtocol = window.location.protocol;
        const currentHost = window.location.hostname;
        const API_BASE_URL = currentProtocol === 'https:' ? `https://${currentHost}` : `http://${currentHost}:8000`;
        
        const token = localStorage.getItem('stylescape_token');
        const headers = token ? { 'Authorization': `Bearer ${token}` } : {};

        const response = await fetch(`${API_BASE_URL}/api/v1/posts/snaps`, { headers });
        if (response.ok) {
          const data = await response.json();
          setCachedSnaps(data); 
        }
        console.log("스냅 가져오기", token);
      } catch (error) {
        console.error("스냅 프리패칭 실패", error);
      }
    };
    preloadSnaps(); 
  }, []);

  // ✅ 신규 유저 온보딩 트리거 — 추가된 부분은 이 useEffect 하나뿐
  useEffect(() => {
    if (!isLoggedIn) return;
    if (localStorage.getItem('stylescape_onboarding_done') === 'true') return;

    const checkPreferences = async () => {
      try {
        const token = localStorage.getItem('stylescape_token');
        const currentProtocol = window.location.protocol;
        const currentHost = window.location.hostname;
        const API_BASE = currentProtocol === 'https:'
          ? `https://${currentHost}`
          : `http://${currentHost}:8000`;

        const res = await fetch(`${API_BASE}/api/v1/users/me`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        // ✅ 404 = DB에 유저 없음 = 완전 신규 유저 → 온보딩 오픈
        if (res.status === 404) {
          setOnboardingOpen(true);
          return;
        }

        if (!res.ok) return; // 500 등 다른 에러는 그냥 종료

        const user = await res.json();

        // preferred_styles 비어있으면 온보딩 오픈
        if (!user.preferred_styles || user.preferred_styles.length === 0) {
          setOnboardingOpen(true);
        }
      } catch (err) {
        console.error('유저 취향 확인 실패:', err);
      }
    };

    checkPreferences();
  }, [isLoggedIn]);

  const handleOnboardingComplete = useCallback(() => {
    localStorage.setItem('stylescape_onboarding_done', 'true');
    setOnboardingOpen(false);
    setSort('recommend');
    setActiveView('home');
    setFeedKey(k => k + 1); 
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

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

  const handleSmartPostClick = useCallback(() => {
    if (!isLoggedIn) {
      openAuthModal('login');
      return;
    }
    if (activeView === 'snap') {
      handleNavigate('snap-upload');
    } else {
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
              onCommentOpen={(postId, postUserId, type, onAdded, onRemoved) => // ✅ type 추가
                handleCommentOpen(postId, postUserId, type, onAdded, onRemoved)
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
              prefetchedSnaps={cachedSnaps}
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
          onOpenPostModal={handleSmartPostClick}
          onOpenSnapUpload={() => handleNavigate('snap-upload')} 
        />
      </div>

      <MobileNav
        onNavigate={handleNavigate}
        onSort={handleSort}
        onNearby={handleNearby}
        onOpenPost={handleSmartPostClick}
        currentSort={sort} 
      />

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