import React, { useState, useEffect } from 'react';
// 💡 API_URL 대신 resolveMediaUrl을 가져옵니다.
import { editPostApi, resolveMediaUrl } from '../../api/api';

/**
 * @param {object} post - 수정 대상 게시물 (null이면 닫힌 상태)
 * @param {function} onClose
 * @param {function} onEdited - 수정 완료 후 피드 새로고침 요청
 */
export default function EditModal({ post, onClose, onEdited }) {
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
      await editPostApi(post.id, { content, user_tags: tags });
      alert('게시물이 성공적으로 수정되었습니다. ✦');
      onClose();
      onEdited();
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  const authorInitial = post?.author ? post.author.charAt(0).toUpperCase() : 'U';
  const hasImage = post?.image_url && post.image_url.trim() !== '';

  return (
    <div
      className={`modal-overlay${isOpen ? ' active' : ''}`}
      id="editModal"
      onClick={handleOverlayClick}
    >
      <div className="auth-modal-content" style={{ maxWidth: 500 }}>
        <button className="modal-close" onClick={onClose}>&times;</button>
        <h3
          style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: 28,
            marginBottom: 20,
            color: 'var(--warm-black)',
          }}
        >
          Edit Post
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

        {/* 기존 이미지 미리보기 */}
        {hasImage && (
          <div style={{ marginBottom: 16 }}>
            <img
              // 💡 추가된 기능: resolveMediaUrl을 사용하여 이미지 경로를 안전하게 렌더링합니다.
              src={resolveMediaUrl(post.image_url)}
              alt="기존 이미지"
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
            placeholder="태그 (쉼표로 구분, 예: 스트릿,오버핏)"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            style={{ fontSize: 14 }}
          />
          <button type="submit" disabled={submitting} style={{ marginTop: 10 }}>
            {submitting ? '수정 중...' : '수정 완료 ✦'}
          </button>
        </form>
      </div>
    </div>
  );
}