import React, { useState, useEffect } from 'react';
import { fetchComments, postComment, updateCommentApi, deleteCommentApi } from '../../api/api';
import { useAuth } from '../../context/Authcontext';

// 💡 텍스트를 한 곳에서 관리하기 위한 객체 (새로 추가된 기능)
const MSG = {
  needLogin: '댓글을 작성하려면 로그인이 필요합니다.',
  postFail: '댓글 작성에 실패했습니다.',
  empty: '댓글 내용을 입력해 주세요.',
  patchFail: '댓글 수정에 실패했습니다.',
  confirmDel: '이 댓글을 삭제할까요?',
  delFail: '댓글 삭제에 실패했습니다.',
  loading: '댓글을 불러오는 중...',
  emptyHint: '아직 댓글이 없습니다. 첫 댓글을 남겨보세요!',
  placeholder: '당신의 무드를 남겨주세요...',
  edit: '수정',
  del: '삭제',
  cancel: '취소',
  save: '저장',
  saving: '저장 중…',
  submit: '게시',
};

// 💡 유저 일치 여부 확인용 헬퍼 함수
function sameUser(a, b) {
  if (a == null || b == null) return false;
  return String(a).toLowerCase() === String(b).toLowerCase();
}

export default function CommentModal({
  isOpen,
  postId,
  postOwnerId, // 💡 추가됨: 게시물 작성자 ID (게시물 주인도 댓글 삭제 권한을 가질 수 있도록)
  onClose,
  onCommentAdded,
  onCommentRemoved, // 💡 추가됨: 댓글 삭제 시 피드 업데이트용
}) {
  const { isLoggedIn, currentUserId, openAuthModal } = useAuth();
  
  // 기존 상태
  const [comments, setComments] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // 💡 새로 추가된 수정 관련 상태
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState('');
  const [savingId, setSavingId] = useState(null);

  useEffect(() => {
    if (isOpen && postId) {
      loadComments();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, postId]);

  // 💡 모달이 닫힐 때 수정 중이던 상태 초기화
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

  // 💡 수정/삭제 권한 체크 (댓글 작성자이거나 게시물 작성자인 경우 true)
  const canModerate = (commentUserId) =>
    isLoggedIn &&
    currentUserId &&
    (sameUser(currentUserId, commentUserId) || sameUser(currentUserId, postOwnerId));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isLoggedIn) {
      alert(MSG.needLogin);
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
      alert(MSG.postFail);
    } finally {
      setSubmitting(false);
    }
  };

  // 💡 새로 추가된 댓글 수정 핸들러
  const handleSaveEdit = async (commentId) => {
    if (!isLoggedIn) return;
    const text = editDraft.trim();
    if (!text) {
      alert(MSG.empty);
      return;
    }
    setSavingId(commentId);
    try {
      await updateCommentApi(postId, commentId, text);
      setEditingId(null);
      setEditDraft('');
      loadComments(); // 수정 후 목록 새로고침
    } catch (err) {
      alert(err.message || MSG.patchFail);
    } finally {
      setSavingId(null);
    }
  };

  // 💡 새로 추가된 댓글 삭제 핸들러
  const handleDelete = async (commentId) => {
    if (!isLoggedIn) return;
    if (!window.confirm(MSG.confirmDel)) return;
    try {
      await deleteCommentApi(postId, commentId);
      if (onCommentRemoved) onCommentRemoved(postId); // 부모 컴포넌트(피드)에 삭제 알림
      loadComments(); // 삭제 후 목록 새로고침
    } catch (err) {
      alert(err.message || MSG.delFail);
    }
  };

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  // 💡 공통 버튼 스타일
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
            <div style={{ textAlign: 'center', color: '#999', marginTop: 20 }}>{MSG.loading}</div>
          ) : comments.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#999', marginTop: 20 }}>{MSG.emptyHint}</div>
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
                          {MSG.edit}
                        </button>
                        <button type="button" style={btnMuted} onClick={() => handleDelete(c.id)}>
                          {MSG.del}
                        </button>
                      </>
                    )}
                    <span style={{ fontSize: 11, color: '#999' }}>
                      {new Date(c.created_at).toLocaleDateString('ko-KR')}
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
                        {MSG.cancel}
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
                        {savingId === c.id ? MSG.saving : MSG.save}
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
                    {c.content}
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
            placeholder={MSG.placeholder}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            required
            style={{
              flex: 1,
              padding: 14,
              borderRadius: 4,
              border: '1px solid var(--border-color)',
              fontFamily: "'DM Sans', sans-serif'",
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
              fontFamily: "'DM Sans', sans-serif'",
            }}
          >
            {MSG.submit}
          </button>
        </form>
      </div>
    </div>
  );
}