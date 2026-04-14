import React, { useState } from 'react';
import { API_URL, toggleLikeApi, deletePostApi } from '../../api/api';
import { useAuth } from '../../context/Authcontext';

// 💡 부모 컴포넌트에서 프로필 이동을 처리할 onProfileClick props를 추가했습니다.
export default function PostCard({ post, onTagSearch, onCommentOpen, onEditOpen, onDeleted, onLikeToggle, onProfileClick }) {
  const { isLoggedIn, currentUserId, openAuthModal } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  const isOwner = currentUserId && post.user_id === currentUserId;
  const hasImage = post.image_url && post.image_url.trim() !== '';

  const aiBadge = hasImage
    ? post.ai_status === 'pending' ? '분석 중' : 'AI 분석완료'
    : '텍스트 게시물';

  // 💡 프로필 이미지가 없을 때 기본 이미지를 띄워주고, 전체 경로를 만들어주는 함수
  const getFullImageUrl = (url) => {
    if (!url) return "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=100";
    return url.startsWith('http') ? url : `${API_URL}${url}`;
  };

  // ==========================================
  // 좋아요
  // ==========================================
  const handleLike = async () => {
    if (!isLoggedIn) {
      alert('좋아요를 누르려면 로그인이 필요합니다.');
      openAuthModal('login');
      return;
    }
    try {
      const data = await toggleLikeApi(post.id);
      onLikeToggle(post.id, data.status); // 부모에서 상태 업데이트
    } catch (err) {
      console.error('좋아요 오류', err);
    }
  };

  // ==========================================
  // 삭제
  // ==========================================
  const handleDelete = async () => {
    setMenuOpen(false);
    if (!window.confirm('정말로 이 게시물을 삭제하시겠습니까?\n삭제된 데이터는 복구할 수 없습니다.')) return;
    try {
      await deletePostApi(post.id);
      alert('게시물이 성공적으로 삭제되었습니다. ✦');
      onDeleted(post.id);
    } catch (err) {
      alert(err.message);
    }
  };

  // ==========================================
  // 공유
  // ==========================================
  const handleShare = async () => {
    const shareUrl = `${API_URL}/share/${post.id}`;
    const shortText = post.content.length > 40 ? post.content.substring(0, 40) + '...' : post.content;
    const shareData = {
      title: 'StyleScape Community',
      text: `[Fashion.2.Cation] 당신의 도시가 입는 것\n\n${shortText}`,
      url: shareUrl,
    };

    if (navigator.share && window.isSecureContext) {
      try { await navigator.share(shareData); } catch (e) {}
    } else if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(shareUrl);
        alert('게시물 링크가 클립보드에 복사되었습니다! ✦');
      } catch (e) { alert('링크 복사에 실패했습니다.'); }
    } else {
      const ta = document.createElement('textarea');
      ta.value = shareUrl;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
        alert('게시물 링크가 클립보드에 복사되었습니다! ✦ (우회 복사)');
      } catch (e) {
        window.prompt('아래 링크를 길게 눌러 복사해 주세요:', shareUrl);
      } finally {
        document.body.removeChild(ta);
      }
    }
  };

  return (
    <div className="post-card" onClick={() => setMenuOpen(false)}>
      {/* 헤더 */}
      <div className="post-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        
        {/* 💡 수정된 작성자 프로필 영역 */}
        <div className="post-meta" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          
          {/* 프로필 이미지와 이름을 하나로 묶어 클릭 가능하게 만듦 */}
          <div 
            onClick={(e) => {
              e.stopPropagation(); // 카드 전체 클릭 이벤트 방지
              if (onProfileClick) onProfileClick(post.user?.id || post.user_id);
            }}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px', 
              cursor: 'pointer' 
            }}
            title={`${post.user?.nickname || post.author}님의 프로필 보기`}
          >
            <img 
              src={getFullImageUrl(post.user?.profile_image_url)} 
              alt="profile" 
              style={{ 
                width: '32px', 
                height: '32px', 
                borderRadius: '50%', 
                objectFit: 'cover',
                border: '1px solid #eee'
              }} 
              onError={(e) => { 
                e.target.src = "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=100"; 
              }}
            />
            <span className="post-author" style={{ fontWeight: '600', color: 'var(--warm-black)' }}>
              {post.user?.nickname || post.author}
            </span>
          </div>

          <span style={{ color: '#ccc', margin: '0 2px' }}>•</span>
          <span style={{ color: '#999', fontSize: '11px' }}>
            {new Date(post.created_at).toLocaleDateString('ko-KR')}
          </span>
        </div>

        <div className="post-region-wrapper">
          <div className="post-region">{post.location}</div>

          {isOwner && (
            <>
              <button
                className="post-menu-btn"
                onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }}
              >
                ⋮
              </button>
              <div className={`post-dropdown${menuOpen ? ' active' : ''}`} onClick={(e) => e.stopPropagation()}>
                <button onClick={() => { setMenuOpen(false); onEditOpen(post); }}>수정</button>
                <button className="delete-text" onClick={handleDelete}>삭제</button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* 본문 */}
      <h2 className="post-title" style={{ fontSize: hasImage ? 16 : 20 }}>
        {post.content}
      </h2>

      {/* 이미지 */}
      {hasImage && (
        <div className="post-image-container">
          <img src={`${API_URL}${post.image_url}`} className="post-img" alt="Fashion Post" />
        </div>
      )}

      {/* 태그 */}
      {post.tags && post.tags.length > 0 && (
        <div className="post-tags-container" style={{ margin: '12px 0', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {post.tags.map((tag) => (
            <span
              key={tag}
              className="post-hashtag"
              onClick={() => onTagSearch(tag)}
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* 액션 버튼 */}
      <div className="post-actions" style={{ borderTop: '1px solid rgba(0,0,0,0.05)', paddingTop: 12 }}>
        <button
          className="action-btn btn-like"
          onClick={handleLike}
          style={post.is_liked ? { color: 'var(--rust)', fontWeight: 600 } : {}}
        >
          <span className="icon">{post.is_liked ? '♥' : '♡'}</span> 좋아요{' '}
          <b className="like-cnt">{post.like_count}</b>
        </button>

        <button
          className="action-btn btn-comment"
          onClick={() => onCommentOpen(post.id)}
        >
          <span>💬</span> 댓글 <b className="comment-cnt">{post.comment_count}</b>
        </button>

        <button className="action-btn btn-share" onClick={handleShare}>
          <span>⎋</span> 공유
        </button>

        <button className="action-btn" style={{ cursor: 'default' }}>
          <span>⟡</span> {aiBadge}
        </button>
      </div>
    </div>
  );
}