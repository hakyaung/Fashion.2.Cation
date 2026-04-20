import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next'; // 💡 다국어 훅 추가
import { fetchComments, postComment, updateCommentApi, deleteCommentApi } from '../../api/api';
import { useAuth } from '../../context/Authcontext';
import { formatApiError } from '../../utils/formatApiError'; // 💡 에러 포매터 추가
import TranslatableText from '../common/TranslatableText'; // 💡 본문 번역 컴포넌트 추가

// 💡 유저 일치 여부 확인용 헬퍼 함수 (기존 유지)
function sameUser(a, b) {
  if (a == null || b == null) return false;
  return String(a).toLowerCase() === String(b).toLowerCase();
}

export default function CommentModal({
  isOpen,
  postId,
  postOwnerId, // 💡 게시물 작성자 ID (게시물 주인도 댓글 삭제 권한을 가질 수 있도록)
  onClose,
  onCommentAdded,
  onCommentRemoved, // 💡 댓글 삭제 시 피드 업데이트용
}) {
  const { t, i18n } = useTranslation(); // 💡 번역 함수 및 언어 객체 가져오기
  const { isLoggedIn, currentUserId, openAuthModal } = useAuth();
  
  // 기존 상태
  const [comments, setComments] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // 수정 관련 상태
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState('');
  const [savingId, setSavingId] = useState(null);

  // 💡 다국어 날짜 포맷 로케일
  const dateLocale = i18n.language?.startsWith('zh') ? 'zh-CN' : i18n.language;

  useEffect(() => {
    if (isOpen && postId) {
      loadComments();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, postId]);

  // 모달이 닫힐 때 수정 중이던 상태 초기화
  useEffect(() => {
    if (!isOpen) {
      setEditingId(null);
      setEditDraft('');
    }
  }, [isOpen]);

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

  // 💡 수정/삭제 권한 체크 (댓글 작성자이거나 게시물 작성자인 경우 true - 기존 유지)
  const canModerate = (commentUserId) =>
    isLoggedIn &&
    currentUserId &&
    (sameUser(currentUserId, commentUserId) || sameUser(currentUserId, postOwnerId));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isLoggedIn) {
      alert(t('comment.needLogin')); // 💡 다국어 적용
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
      alert(t('comment.postFail')); // 💡 다국어 적용
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveEdit = async (commentId) => {
    if (!isLoggedIn) return;
    const text = editDraft.trim();
    if (!text) {
      alert(t('comment.empty')); // 💡 다국어 적용
      return;
    }
    setSavingId(commentId);
    try {
      await updateCommentApi(postId, commentId, text);
      setEditingId(null);
      setEditDraft('');
      loadComments(); // 수정 후 목록 새로고침
    } catch (err) {
      alert(formatApiError(t, err) || t('comment.patchFail')); // 💡 에러 포매터 적용
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async (commentId) => {
    if (!isLoggedIn) return;
    if (!window.confirm(t('comment.confirmDel'))) return; // 💡 다국어 적용
    try {
      await deleteCommentApi(postId, commentId);
      if (onCommentRemoved) onCommentRemoved(postId); // 부모 컴포넌트(피드)에 삭제 알림
      loadComments(); // 삭제 후 목록 새로고침
    } catch (err) {
      alert(formatApiError(t, err) || t('comment.delFail')); // 💡 에러 포매터 적용
    }
  };

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  // 공통 버튼 스타일
  const btnMuted = {
    border: 'none',
    background: 'transparent',
    color: 'var(--rust)',
    fontSize: 12,
    cursor: 'pointer',
    fontFamily: "'DM Sans', sans-serif",
    padding: '0 6px',
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
        <button type="button" className="modal-close" onClick={onClose}>&times;</button>
        <h3
          style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: 24,
            marginBottom: 20,
            color: 'var(--warm-black)',
          }}
        >
          {t('comment.title')}
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
            <div style={{ textAlign: 'center', color: '#999', marginTop: 20 }}>{t('comment.loading')}</div>
          ) : comments.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#999', marginTop: 20 }}>{t('comment.emptyHint')}</div>
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
                    alignItems: 'center',
                    marginBottom: 4,
                    gap: 8,
                  }}
                >
                  <strong style={{ color: 'var(--warm-black)', fontSize: 13 }}>
                    {c.author}
                  </strong>
                  
                  {/* 날짜 및 수정/삭제 버튼 영역 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    {/* 권한이 있고 현재 수정 모드가 아닐 때만 버튼 표시 */}
                    {canModerate(c.user_id) && editingId !== c.id && (
                      <>
                        <button
                          type="button"
                          style={btnMuted}
                          onClick={() => {
                            setEditingId(c.id);
                            setEditDraft(c.content);
                          }}
                        >
                          {t('comment.edit')}
                        </button>
                        <button type="button" style={btnMuted} onClick={() => handleDelete(c.id)}>
                          {t('comment.del')}
                        </button>
                      </>
                    )}
                    <span style={{ fontSize: 11, color: '#999' }}>
                      {new Date(c.created_at).toLocaleDateString(dateLocale)}
                    </span>
                  </div>
                </div>

                {/* 💡 수정 모드 vs 일반 읽기 모드 렌더링 */}
                {editingId === c.id ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <textarea
                      value={editDraft}
                      onChange={(e) => setEditDraft(e.target.value)}
                      rows={3}
                      style={{
                        width: '100%',
                        padding: 10,
                        borderRadius: 4,
                        border: '1px solid var(--border-color)',
                        fontFamily: "'DM Sans', sans-serif",
                        fontSize: 14,
                        resize: 'vertical',
                        boxSizing: 'border-box',
                      }}
                    />
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(null);
                          setEditDraft('');
                        }}
                        style={{ ...btnMuted, color: '#666' }}
                      >
                        {t('comment.cancel')}
                      </button>
                      <button
                        type="button"
                        disabled={savingId === c.id}
                        onClick={() => handleSaveEdit(c.id)}
                        style={{
                          border: 'none',
                          background: 'var(--rust)',
                          color: 'white',
                          padding: '8px 16px',
                          borderRadius: 4,
                          cursor: 'pointer',
                          fontSize: 13,
                          fontFamily: "'DM Sans', sans-serif",
                        }}
                      >
                        {savingId === c.id ? t('comment.saving') : t('comment.save')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    style={{
                      fontSize: 14,
                      color: 'rgba(26,22,18,0.8)',
                      lineHeight: 1.5,
                    }}
                  >
                    {/* 💡 본문 번역 컴포넌트 적용 */}
                    <TranslatableText text={c.content} compact />
                  </div>
                )}
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
            placeholder={t('comment.placeholder')}
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
            {t('comment.submit')}
          </button>
        </form>
      </div>
    </div>
  );
}