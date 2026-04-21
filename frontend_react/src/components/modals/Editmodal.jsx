import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next'; // 💡 다국어 훅 추가
import { editPostApi, resolveMediaUrl } from '../../api/api';
import { formatApiError } from '../../utils/formatApiError'; // 💡 에러 포매터 추가

/**
 * @param {object} post - 수정 대상 게시물/스냅 (null이면 닫힌 상태)
 * @param {string} type - 'post' 또는 'snap'
 * @param {function} onClose
 * @param {function} onEdited - 수정 완료 후 피드 새로고침 요청
 */
export default function EditModal({ post, type = 'post', onClose, onEdited }) {
  const { t } = useTranslation(); // 💡 다국어 함수 가져오기
  const isOpen = Boolean(post);
  const [content, setContent] = useState('');
  const [tags, setTags] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // post가 바뀔 때마다 폼 채우기
  useEffect(() => {
    if (post) {
      setContent(post.content || '');
      const tagStr = post.tags ? post.tags.map((t) => t.replace('#', '').trim()).join(', ') : '';
      setTags(tagStr);
    }
  }, [post]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!post) return;
    setSubmitting(true);
    try {
      if (type === 'snap') {
        // 💡 스냅 전용 수정 API 호출
        const token = localStorage.getItem('stylescape_token');
        const response = await fetch(`http://localhost:8000/api/v1/posts/snaps/${post.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ content, user_tags: tags })
        });
        
        if (!response.ok) throw new Error('스냅 수정 실패');
        alert(t('editModal.success') || "수정되었습니다!");
      } else {
        // 💡 기존 일반 게시물 수정 API 호출
        await editPostApi(post.id, { content, user_tags: tags });
        alert(t('editModal.success'));
      }
      
      onClose();
      onEdited();
    } catch (err) {
      alert(formatApiError(t, err) || "수정 중 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  const authorInitial = post?.author ? post.author.charAt(0).toUpperCase() : 'U';
  
  // 💡 이미지 또는 비디오(스냅) 미리보기를 위한 조건 확인
  const hasImage = type === 'post' && post?.image_url && post.image_url.trim() !== '';
  const isSnap = type === 'snap' && post?.video_url;

  return (
    <div
      className={`modal-overlay${isOpen ? ' active' : ''}`}
      id="editModal"
      onClick={handleOverlayClick}
    >
      <div className="auth-modal-content" style={{ maxWidth: 500 }}>
        <button type="button" className="modal-close" onClick={onClose}>&times;</button>
        <h3
          style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: 28,
            marginBottom: 20,
            color: 'var(--warm-black)',
          }}
        >
          {/* 💡 다국어가 지원되지 않는 경우를 대비한 폴백 추가 */}
          {type === 'snap' ? (t('editModal.titleSnap') || '스냅 수정') : t('editModal.title')}
        </h3>

        {/* 작성자 표시 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              background: 'var(--off-white)',
              border: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 'bold',
              color: 'var(--rust)',
            }}
          >
            {authorInitial}
          </div>
          <strong style={{ fontSize: 14, color: 'var(--warm-black)' }}>
            {post?.author}
          </strong>
        </div>

        {/* 💡 기존 이미지 미리보기 (일반 게시물) */}
        {hasImage && (
          <div style={{ marginBottom: 16 }}>
            <img
              src={resolveMediaUrl(post.image_url)}
              alt={t('editModal.imageAlt')}
              style={{
                width: '100%',
                maxHeight: 250,
                objectFit: 'cover',
                borderRadius: 8,
                border: '1px solid #eee',
              }}
            />
          </div>
        )}

        {/* 💡 스냅(비디오) 미리보기 추가 */}
        {isSnap && (
          <div style={{ marginBottom: 16, background: '#000', borderRadius: 8, overflow: 'hidden' }}>
            <video
              src={post.video_url}
              style={{
                width: '100%',
                maxHeight: 250,
                objectFit: 'contain',
                display: 'block'
              }}
              controls
              muted
            />
          </div>
        )}

        <form className="auth-form" onSubmit={handleSubmit}>
          <textarea
            rows={4}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            required
            style={{ fontSize: 14 }}
          />
          <input
            type="text"
            placeholder={t('editModal.tagsPh')}
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            style={{ fontSize: 14 }}
          />
          <button type="submit" disabled={submitting} style={{ marginTop: 10 }}>
            {submitting ? t('editModal.submitting') : t('editModal.submitBtn')}
          </button>
        </form>
      </div>
    </div>
  );
}