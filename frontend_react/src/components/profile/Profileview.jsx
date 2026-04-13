import React, { useEffect, useState, useCallback } from 'react';
import { fetchMyPosts, fetchUserProfile, toggleFollowApi, API_URL } from '../../api/api'; 
import { useAuth } from '../../context/Authcontext'; 
import ProfileEditModal from '../modals/ProfileEditModal'; 

// 💡 ChatRoomModal은 이제 CommunityPage에서 관리하므로 여기서 직접 임포트할 필요가 없습니다.

export default function ProfileView({ targetUserId, onOpenChat }) {
  const { currentUserId } = useAuth(); 
  const [posts, setPosts] = useState([]);
  const [profile, setProfile] = useState(null); 
  const [loading, setLoading] = useState(true);
  const [editModalOpen, setEditModalOpen] = useState(false); 
  // const [isChatOpen, setIsChatOpen] = useState(false); 💡 중앙 관리를 위해 제거
  const [isFollowing, setIsFollowing] = useState(false); 

  const getFullImageUrl = (url) => {
    if (!url) return "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&q=80";
    return url.startsWith('http') ? url : `${API_URL}${url}`;
  };

  const loadData = useCallback(async () => {
    const idToFetch = targetUserId || currentUserId;
    if (!idToFetch) return;

    setLoading(true);
    try {
      const [allPostsData, profileData] = await Promise.all([
        fetchMyPosts(),
        fetchUserProfile(idToFetch)
      ]);

      const userOnlyPosts = allPostsData.filter((post) => {
        const ownerId = post.user?.id || post.user_id;
        return ownerId === idToFetch;
      });

      setPosts(userOnlyPosts);
      setProfile(profileData);
      setIsFollowing(profileData.is_following); 
    } catch (err) {
      console.error('프로필 로드 실패', err);
    } finally {
      setLoading(false);
    }
  }, [currentUserId, targetUserId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleFollowClick = async () => {
    if (!currentUserId) {
      alert("로그인이 필요합니다.");
      return;
    }
    try {
      const res = await toggleFollowApi(profile.id);
      setIsFollowing(res.status === 'followed');
      loadData();
    } catch (err) {
      alert("팔로우 처리 중 오류가 발생했습니다.");
    }
  };

  const imagePosts = posts.filter((p) => p.image_url && p.image_url.trim() !== '');

  return (
    <div id="view-profile">
      {/* 프로필 헤더 */}
      <div className="profile-header">
        <div className="profile-avatar">
          <img
            src={getFullImageUrl(profile?.profile_image_url)}
            alt=""
            onError={(e) => {
              e.target.src = "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=300";
            }}
          />
        </div>
        <div className="profile-info">
          <div className="profile-username">
            <span id="profile-nickname-display">{profile?.nickname || 'Style_Creator'}</span>
            <span className="settings-icon">⚙</span>
          </div>
          <div className="profile-name">패션 디렉터</div>
          <ul className="profile-stats">
            <li>게시물 <strong>{profile?.posts_count || 0}</strong></li>
            <li>팔로워 <strong>{profile?.followers_count || 0}</strong></li>
            <li>팔로잉 <strong>{profile?.following_count || 0}</strong></li>
          </ul>
          <div className="profile-bio">
            {profile?.bio || "🔗 blog.Fashion2Cation.com/creator"}
          </div>
          
          <div className="profile-actions" style={{ display: 'flex', gap: '10px' }}>
            {(!profile || currentUserId === profile.id) ? (
              <>
                <button className="btn-profile-action" onClick={() => setEditModalOpen(true)}>
                  프로필 편집
                </button>
                <button className="btn-profile-action">보관된 스토리 보기</button>
              </>
            ) : (
              <>
                <button 
                  className="btn-profile-action" 
                  onClick={handleFollowClick}
                  style={isFollowing 
                    ? { backgroundColor: '#efefef', color: '#333' } 
                    : { backgroundColor: 'var(--rust)', color: '#fff', border: 'none' }
                  }
                >
                  {isFollowing ? '팔로잉' : '팔로우'}
                </button>
                <button 
                  className="btn-profile-action" 
                  // 💡 부모 컴포넌트(CommunityPage)에서 전달받은 채팅창 열기 함수 실행
                  onClick={() => onOpenChat(profile)} 
                  style={{ color: 'var(--rust)', borderColor: 'var(--rust)', fontWeight: 'bold' }}
                >
                  메시지 보내기 ✦
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 하이라이트 */}
      <div className="profile-highlights">
        <div className="highlight-item"><div className="highlight-circle"></div><span>OOTD</span></div>
        <div className="highlight-item"><div className="highlight-circle"></div><span>Cafe</span></div>
        <div className="highlight-item">
          <div className="highlight-circle" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, color: 'var(--rust)' }}>+</div>
          <span>신규</span>
        </div>
      </div>

      <div className="profile-tabs">
        <div className="tab active"><span>▤</span> 게시물</div>
        <div className="tab"><span>⚑</span> 저장됨</div>
        <div className="tab"><span>☺</span> 태그됨</div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'rgba(26,22,18,0.4)' }}>불러오는 중...</div>
      ) : (
        <div className="profile-grid" id="profile-grid-container">
          {imagePosts.length > 0 ? (
            imagePosts.map((post) => (
              <div key={post.id} className="grid-item">
                <img src={getFullImageUrl(post.image_url)} alt="Post" />
                <div className="grid-overlay">
                  <span style={post.is_liked ? { color: 'var(--rust)', fontWeight: 'bold' } : {}}>
                    {post.is_liked ? '♥' : '♡'} {post.like_count}
                  </span>
                  <span>💬 {post.comment_count}</span>
                </div>
              </div>
            ))
          ) : (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '60px 0', color: '#999' }}>
              아직 게시물이 없습니다.
            </div>
          )}
        </div>
      )}

      <ProfileEditModal 
        isOpen={editModalOpen} 
        user={profile} 
        onClose={() => setEditModalOpen(false)} 
        onUpdated={loadData} 
      />

      {/* 💡 ChatRoomModal은 이제 여기서 직접 렌더링하지 않고 CommunityPage에서 한 번에 관리합니다. */}
    </div>
  );
}