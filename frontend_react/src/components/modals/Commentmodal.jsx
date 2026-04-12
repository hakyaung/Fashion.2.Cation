import React, { useState, useEffect } from 'react';
import { fetchComments, postComment } from '../../api/api';
import { useAuth } from '../../context/Authcontext';

export default function CommentModal({ isOpen, postId, onClose, onCommentAdded }) {
  const { isLoggedIn, openAuthModal } = useAuth();
  const [comments, setComments] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen && postId) {
      loadComments();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, postId]);

  async function loadComments() {
    setLoading(true);
    setComments([]);
    try {
      const data = await fetchComments(postId);
      setComments(data);
    } catch (err) {
      setComments([]);
    } finally {
      setLoading(false);
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isLoggedIn) {
      alert('댓글을 작성하려면 로그인이 필요합니다.');
      openAuthModal('login');
      return;
    }
    if (!input.trim()) return;
    setSubmitting(true);
    try {
      await postComment(postId, input.trim());
      setInput('');
      loadComments();
      if (onCommentAdded) onCommentAdded(postId);
    } catch (err) {
      alert('댓글 작성에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      className={`modal-overlay${isOpen ? ' active' : ''}`}
      id="commentModal"
      onClick={handleOverlayClick}
    >
      <div
        className="auth-modal-content"
        style={{
          maxWidth: 500,
          height: '60vh',
          display: 'flex',
          flexDirection: 'column',
          padding: 30,
        }}
      >
        <button className="modal-close" onClick={onClose}>&times;</button>
        <h3
          style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: 24,
            marginBottom: 20,
            color: 'var(--warm-black)',
          }}
        >
          Comments
        </h3>

        {/* 댓글 목록 */}
        <div
          id="commentList"
          style={{
            flex: 1,
            overflowY: 'auto',
            marginBottom: 20,
            borderBottom: '1px solid rgba(0,0,0,0.1)',
            paddingBottom: 10,
          }}
        >
          {loading ? (
            <div style={{ textAlign: 'center', color: '#999', marginTop: 20 }}>
              댓글을 불러오는 중...
            </div>
          ) : comments.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#999', marginTop: 20 }}>
              아직 댓글이 없습니다. 첫 댓글을 남겨보세요!
            </div>
          ) : (
            comments.map((c) => (
              <div
                key={c.id || c.created_at}
                style={{
                  marginBottom: 16,
                  paddingBottom: 12,
                  borderBottom: '1px dashed rgba(0,0,0,0.05)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: 4,
                  }}
                >
                  <strong style={{ color: 'var(--warm-black)', fontSize: 13 }}>
                    {c.author}
                  </strong>
                  <span style={{ fontSize: 11, color: '#999' }}>
                    {new Date(c.created_at).toLocaleDateString('ko-KR')}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: 14,
                    color: 'rgba(26,22,18,0.8)',
                    lineHeight: 1.5,
                  }}
                >
                  {c.content}
                </div>
              </div>
            ))
          )}
        </div>

        {/* 댓글 입력 */}
        <form
          id="commentForm"
          onSubmit={handleSubmit}
          style={{ display: 'flex', gap: 10 }}
        >
          <input
            type="text"
            placeholder="당신의 무드를 남겨주세요..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            required
            style={{
              flex: 1,
              padding: 14,
              borderRadius: 4,
              border: '1px solid var(--border-color)',
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 14,
              outline: 'none',
            }}
          />
          <button
            type="submit"
            disabled={submitting}
            style={{
              background: 'var(--rust)',
              color: 'white',
              border: 'none',
              padding: '0 20px',
              borderRadius: 4,
              cursor: 'pointer',
              fontWeight: 600,
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            게시
          </button>
        </form>
      </div>
    </div>
  );
}