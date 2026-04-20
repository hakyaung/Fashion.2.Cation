import React, { useState } from 'react';
import { useTranslation } from 'react-i18next'; // 💡 다국어 훅 추가
// 💡 추가된 기능: resolveMediaUrl 임포트 유지
import { API_URL, resolveMediaUrl, toggleLikeApi, deletePostApi } from '../../api/api';
import { useAuth } from '../../context/Authcontext';
import { formatApiError } from '../../utils/formatApiError'; // 💡 에러 포매터 추가
import TranslatableText from '../common/TranslatableText'; // 💡 본문 번역 컴포넌트 추가

export default function PostCard({ 
  post, 
  onTagSearch, 
  onCommentOpen, 
  onEditOpen, 
  onDeleted, 
  onLikeToggle, 
  onProfileClick,
  dateLocale = 'ko', // 💡 날짜 포맷 로케일 추가
}) {
  const { t } = useTranslation();
  const { isLoggedIn, currentUserId, openAuthModal } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  // ==========================================
  // 💡 데이터 매핑 부분 (기존 유지: 프로필 사진 및 이름 표시용)
  // ==========================================
  const authorImage = post.user?.profile_image_url || post.author_profile_image || post.profile_image_url; 
  const authorName = post.user?.nickname || post.author || t('profile.defaultNickname');
  const authorId = post.user?.id || post.user_id;

  const isOwner = currentUserId && authorId === currentUserId;
  const hasImage = post.image_url && post.image_url.trim() !== '';

  const aiBadge = hasImage
    ? post.ai_status === 'pending' ? t('post.aiPending') : t('post.aiDone')
    : t('post.textOnly');

  // ==========================================
  // 🛠️ 프로필 이미지용 URL 처리 로직 (기존 유지)
  // ==========================================
  const getFullImageUrl = (url) => {
    if (!url) return "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=100";
    if (url.startsWith('http')) return url;
    
    const formattedUrl = url.startsWith('/') ? url : `/${url}`;
    return `${API_URL}${formattedUrl}`;
  };

  // ==========================================
  // 좋아요
  // ==========================================
  const handleLike = async () => {
    if (!isLoggedIn) {
      alert(t('post.likeNeedLogin'));
      openAuthModal('login');
      return;
    }
    try {
      const data = await toggleLikeApi(post.id);
      onLikeToggle(post.id, data.status); 
    } catch (err) {
      alert(formatApiError(t, err)); // 💡 에러 포매터 적용
    }
  };

  // ==========================================
  // 삭제
  // ==========================================
  const handleDelete = async () => {
    setMenuOpen(false);
    if (!window.confirm(t('post.deleteConfirm'))) return;
    try {
      await deletePostApi(post.id);
      alert(t('post.deleteOk'));
      onDeleted(post.id);
    } catch (err) {
      alert(formatApiError(t, err)); // 💡 에러 포매터 적용
    }
  };

  // ==========================================
  // 공유
  // ==========================================
  const handleShare = async () => {
    const shareUrl = `${API_URL}/share/${post.id}`;
    const shortText = post.content.length > 40 ? `${post.content.substring(0, 40)}...` : post.content;
    const shareData = {
      title: t('post.shareTitle'),
      text: `${t('post.shareTitle')}\n\n${shortText}`,
      url: shareUrl,
    };

    if (navigator.share && window.isSecureContext) {
      try { await navigator.share(shareData); } catch (e) {}
    } else if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(shareUrl);
        alert(t('post.copyOk'));
      } catch (e) { alert(t('post.copyFail')); }
    } else {
      const ta = document.createElement('textarea');
      ta.value = shareUrl;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
        alert(t('post.copyOkFallback'));
      } catch (e) {
        window.prompt(t('post.copyPrompt'), shareUrl);
      } finally {
        document.body.removeChild(ta);
      }
    }
  };

  return (
    <div className="post-card" onClick={() => setMenuOpen(false)}>
      {/* 헤더 */}
      <div className="post-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        
        <div className="post-meta" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          
          {/* 💡 기존 유지: 프로필 사진과 닉네임, 그리고 클릭 기능 */}
          <div 
            onClick={(e) => {
              e.stopPropagation(); 
              if (onProfileClick && authorId) onProfileClick(authorId);
            }}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px', 
              cursor: 'pointer' 
            }}
            title={`${authorName}님의 프로필 보기`}
          >
            <img 
              src={getFullImageUrl(authorImage)} 
              alt={t('post.altProfile')} 
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
              {authorName}
            </span>
          </div>

          <span style={{ color: '#ccc', margin: '0 2px' }}>•</span>
          <span style={{ color: '#999', fontSize: '11px' }}>
            {new Date(post.created_at).toLocaleDateString(dateLocale)}
          </span>
        </div>

        <div className="post-region-wrapper">
          <div className="post-region">{post.location}</div>

          {isOwner && (
            <>
              <button
                type="button"
                className="post-menu-btn"
                onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }}
              >
                ⋮
              </button>
              <div className={`post-dropdown${menuOpen ? ' active' : ''}`} onClick={(e) => e.stopPropagation()}>
                <button type="button" onClick={() => { setMenuOpen(false); onEditOpen(post); }}>{t('post.edit')}</button>
                <button type="button" className="delete-text" onClick={handleDelete}>{t('post.delete')}</button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* 본문 */}
      <h2 className="post-title" style={{ fontSize: hasImage ? 16 : 20 }}>
        {/* 💡 본문 번역 컴포넌트 적용 */}
        <TranslatableText text={post.content} />
      </h2>

      {/* 이미지 */}
      {hasImage && (
        <div className="post-image-container">
          {/* 💡 기존 유지: 메인 포스트 이미지에 resolveMediaUrl 적용 */}
          <img src={resolveMediaUrl(post.image_url)} className="post-img" alt={t('post.altPost')} />
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
          type="button"
          className="action-btn btn-like"
          onClick={handleLike}
          style={post.is_liked ? { color: 'var(--rust)', fontWeight: 600 } : {}}
        >
          <span className="icon">{post.is_liked ? '♥' : '♡'}</span> {t('post.like')}{' '}
          <b className="like-cnt">{post.like_count}</b>
        </button>

        <button
          type="button"
          className="action-btn btn-comment"
          // 💡 기존 유지: 댓글 모달을 열 때 게시글 작성자의 ID도 함께 넘겨줍니다.
          onClick={() => onCommentOpen(post.id, post.user_id)}
        >
          <span>💬</span> {t('post.comment')} <b className="comment-cnt">{post.comment_count}</b>
        </button>

        <button type="button" className="action-btn btn-share" onClick={handleShare}>
          <span>⎋</span> {t('post.share')}
        </button>

        <button type="button" className="action-btn" style={{ cursor: 'default' }}>
          <span>⟡</span> {aiBadge}
        </button>
      </div>
    </div>
  );
}