// frontend_react/src/components/modals/Commentmodal.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchComments, postComment, updateCommentApi, deleteCommentApi } from '../../api/api';
import { useAuth } from '../../context/Authcontext';
import { formatApiError } from '../../utils/formatApiError';
import TranslatableText from '../common/TranslatableText';

// 유저 일치 여부 확인용 헬퍼 함수
function sameUser(a, b) {
  if (a == null || b == null) return false;
  return String(a).toLowerCase() === String(b).toLowerCase();
}

export default function CommentModal({
  isOpen,
  postId,
  postOwnerId,
  type = 'post', // 'post' 또는 'snap'을 받아 기능을 구분합니다.
  onClose,
  onCommentAdded,
  onCommentRemoved,
}) {
  const { t, i18n } = useTranslation();
  const { isLoggedIn, currentUserId, openAuthModal } = useAuth();
  
  const [comments, setComments] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState('');
  const [savingId, setSavingId] = useState(null);

  const dateLocale = i18n.language?.startsWith('zh') ? 'zh-CN' : i18n.language;
  const token = localStorage.getItem('stylescape_token');

  // 💡 [기능 유지] 현재 접속 환경(HTTP/HTTPS, 도메인/IP)을 감지하여 동적 주소 생성
  const currentProtocol = window.location.protocol;
  const currentHost = window.location.hostname;
  const API_BASE = currentProtocol === 'https:' 
    ? `https://${currentHost}` 
    : `http://${currentHost}:8000`;

  // 💡 [기능 유지] 타입에 따른 API 엔드포인트 결정 로직
  const getApiUrl = (commentId = '') => {
    const base = type === 'snap' ? 'snaps' : 'posts';
    let url = `${API_BASE}/api/v1/posts/${base}/${postId}/comments`;
    if (commentId) url += `/${commentId}`;
    return url;
  };

  // 댓글 목록 로드
  const loadComments = useCallback(async () => {
    if (!postId) return;
    setLoading(true);
    try {
      if (type === 'snap') {
        const res = await fetch(getApiUrl());
        if (res.ok) {
          const data = await res.json();
          setComments(Array.isArray(data) ? data : []);
        }
      } else {
        const data = await fetchComments(postId);
        setComments(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error("댓글 로드 실패:", err);
      setComments([]);
    } finally {
      setLoading(false);
    }
  }, [postId, type, API_BASE]);

  useEffect(() => {
    if (isOpen && postId) {
      loadComments();
    }
  }, [isOpen, postId, loadComments]);

  useEffect(() => {
    if (!isOpen) {
      setEditingId(null);
      setEditDraft('');
    }
  }, [isOpen]);

  const canModerate = (commentUserId) =>
    isLoggedIn &&
    currentUserId &&
    (sameUser(currentUserId, commentUserId) || sameUser(currentUserId, postOwnerId));

  // 댓글 작성
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isLoggedIn) {
      alert(t('comment.needLogin'));
      openAuthModal('login');
      return;
    }
    const commentContent = input.trim();
    if (!commentContent) return;

    setSubmitting(true);
    try {
      if (type === 'snap') {
        const response = await fetch(getApiUrl(), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ content: commentContent })
        });
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.detail || 'Post failed');
        }
      } else {
        await postComment(postId, commentContent);
      }
      
      setInput('');
      loadComments();
      
      // 💡 [핵심 수정] 전달받은 값이 진짜 '함수'일 때만 실행하도록 타입 검사 강화
      if (typeof onCommentAdded === 'function') {
        onCommentAdded(postId);
      }
    } catch (err) {
      console.error("댓글 작성 에러:", err);
      alert(formatApiError(t, err) || t('comment.postFail'));
    } finally {
      setSubmitting(false);
    }
  };

  // 댓글 수정 저장
  const handleSaveEdit = async (commentId) => {
    if (!isLoggedIn) return;
    const text = editDraft.trim();
    if (!text) {
      alert(t('comment.empty'));
      return;
    }
    setSavingId(commentId);
    try {
      if (type === 'snap') {
        const res = await fetch(getApiUrl(commentId), {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ content: text })
        });
        if (!res.ok) throw new Error('Update failed');
      } else {
        await updateCommentApi(postId, commentId, text);
      }
      setEditingId(null);
      setEditDraft('');
      loadComments();
    } catch (err) {
      alert(formatApiError(t, err) || t('comment.patchFail'));
    } finally {
      setSavingId(null);
    }
  };

  // 댓글 삭제
  const handleDelete = async (commentId) => {
    if (!isLoggedIn) return;
    if (!window.confirm(t('comment.confirmDel'))) return;
    try {
      if (type === 'snap') {
        const res = await fetch(getApiUrl(commentId), {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Delete failed');
      } else {
        await deleteCommentApi(postId, commentId);
      }
      
      // 💡 [핵심 수정] 삭제 시 카운트 다운 함수도 진짜 '함수'인지 확인 후 실행
      if (typeof onCommentRemoved === 'function') {
        onCommentRemoved(postId);
      }
      
      loadComments();
    } catch (err) {
      alert(formatApiError(t, err) || t('comment.delFail'));
    }
  };

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

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
          ) : (comments && comments.length === 0) ? (
            <div style={{ textAlign: 'center', color: '#999', marginTop: 20 }}>{t('comment.emptyHint')}</div>
          ) : (
            comments && comments.map((c) => (
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
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
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
                        resize: 'none',
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
                    <TranslatableText text={c.content} compact />
                  </div>
                )}
              </div>
            ))
          )}
        </div>

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