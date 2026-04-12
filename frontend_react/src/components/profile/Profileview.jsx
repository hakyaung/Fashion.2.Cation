import React, { useEffect, useState, useCallback } from 'react';
import { fetchMyPosts, fetchUserProfile, API_URL } from '../../api/api';
import { useAuth } from '../../context/Authcontext'; 
import ProfileEditModal from '../modals/ProfileEditModal'; 

export default function ProfileView() {
  const { currentUserId } = useAuth(); 
  const [posts, setPosts] = useState([]);
  const [profile, setProfile] = useState(null); 
  const [loading, setLoading] = useState(true);
  const [editModalOpen, setEditModalOpen] = useState(false); 

  const getFullImageUrl = (url) => {
    if (!url) return "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&q=80";
    return url.startsWith('http') ? url : `${API_URL}${url}`;
  };

  const loadData = useCallback(async () => {
    if (!currentUserId) return;
    setLoading(true);
    try {
      const [postsData, profileData] = await Promise.all([
        fetchMyPosts(),
        fetchUserProfile(currentUserId)
      ]);
      setPosts(postsData);
      setProfile(profileData);
    } catch (err) {
      console.error('프로필 로드 실패', err);
    } finally {
      setLoading(false);
    }
  }, [currentUserId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

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
            {/* 💡 posts.length 대신 profile?.posts_count를 사용하여 연동 */}
            <li>게시물 <strong>{profile?.posts_count || 0}</strong></li>
            <li>팔로워 <strong>{profile?.followers_count || 0}</strong></li>
            <li>팔로잉 <strong>{profile?.following_count || 0}</strong></li>
          </ul>
          <div className="profile-bio">
            {profile?.bio || "🔗 blog.Fashion2Cation.com/creator"}
          </div>
          <div className="profile-actions">
            <button className="btn-profile-action" onClick={() => setEditModalOpen(true)}>
              프로필 편집
            </button>
            <button className="btn-profile-action">보관된 스토리 보기</button>
          </div>
        </div>
      </div>

      {/* 하이라이트 (기능 유지) */}
      <div className="profile-highlights">
        <div className="highlight-item">
          <div className="highlight-circle"></div>
          <span>OOTD</span>
        </div>
        <div className="highlight-item">
          <div className="highlight-circle"></div>
          <span>Cafe</span>
        </div>
        <div className="highlight-item">
          <div
            className="highlight-circle"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, color: 'var(--rust)' }}
          >
            +
          </div>
          <span>신규</span>
        </div>
      </div>

      {/* 탭 (기능 유지) */}
      <div className="profile-tabs">
        <div className="tab active"><span>▤</span> 게시물</div>
        <div className="tab"><span>⚑</span> 저장됨</div>
        <div className="tab"><span>☺</span> 태그됨</div>
      </div>

      {/* 그리드 (기능 유지) */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'rgba(26,22,18,0.4)' }}>불러오는 중...</div>
      ) : (
        <div className="profile-grid" id="profile-grid-container">
          {imagePosts.map((post) => (
            <div key={post.id} className="grid-item">
              <img src={getFullImageUrl(post.image_url)} alt="Post" />
              <div className="grid-overlay">
                <span style={post.is_liked ? { color: 'var(--rust)', fontWeight: 'bold' } : {}}>
                  {post.is_liked ? '♥' : '♡'} {post.like_count}
                </span>
                <span>💬 {post.comment_count}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 프로필 편집 모달 */}
      <ProfileEditModal 
        isOpen={editModalOpen} 
        user={profile} 
        onClose={() => setEditModalOpen(false)} 
        onUpdated={loadData} 
      />
    </div>
  );
}