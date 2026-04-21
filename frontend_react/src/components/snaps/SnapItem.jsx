// frontend_react/src/components/snaps/SnapItem.jsx
import React, { useRef, useEffect, useState } from 'react';
import { useAuth } from '../../context/Authcontext'; 
import { ref, deleteObject } from "firebase/storage";
import { storage } from '../../firebase'; 
import './SnapFeed.css';

export default function SnapItem({ snap, onProfileClick, onCommentOpen, onEditOpen, onDeleteSnap }) {
  const { currentUserId } = useAuth();
  const videoRef = useRef(null);
  
  // 상태 관리 (좋아요)
  const [isLiked, setIsLiked] = useState(snap.is_liked);
  const [likeCount, setLikeCount] = useState(snap.like_count);
  const [isVideoLoading, setIsVideoLoading] = useState(true);

  const token = localStorage.getItem('stylescape_token');

  // 비디오 관찰자 로직 (재생/정지)
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            videoRef.current?.play().catch(() => {
              // 브라우저 정책상 자동재생 실패 시 무시
            });
          } else {
            if (videoRef.current) {
              videoRef.current.pause();
              videoRef.current.currentTime = 0; // 스크롤 지나치면 처음으로 리셋
            }
          }
        });
      },
      { threshold: 0.5 } 
    );

    if (videoRef.current) observer.observe(videoRef.current);
    return () => observer.disconnect();
  }, []);

  // ❤️ 좋아요 토글
  const handleLike = async (e) => {
    e.stopPropagation();
    if (!token) return alert("로그인이 필요합니다!");
    
    try {
      const response = await fetch(`http://localhost:8000/api/v1/posts/snaps/${snap.id}/like`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.status === 'liked') {
        setIsLiked(true);
        setLikeCount(prev => prev + 1);
      } else {
        setIsLiked(false);
        setLikeCount(prev => prev - 1);
      }
    } catch (error) {
      console.error("좋아요 처리 실패:", error);
    }
  };

  // 💬 댓글 모달 연결
  const handleCommentClick = (e) => {
    e.stopPropagation();
    if (onCommentOpen) {
      onCommentOpen(snap.id, snap.user_id, 'snap');
    }
  };

  // 🛠️ 삭제 핸들러 (파이어베이스 스토리지 완전 삭제 포함)
  const handleDelete = async (e) => {
    e.stopPropagation();
    if (window.confirm("이 스냅 영상을 삭제하시겠습니까?")) {
      try {
        if (snap.video_url && snap.video_url.includes('firebasestorage')) {
          const fileRef = ref(storage, snap.video_url);
          await deleteObject(fileRef);
          console.log("Firebase 스토리지 영상 파일 삭제 완료 🧹");
        }
      } catch (error) {
        console.error("Firebase 파일 삭제 중 에러 발생:", error);
      }
      onDeleteSnap(snap.id);
    }
  };

  // ⎘ [추가됨] 스마트 공유 핸들러
  const handleShare = async (e) => {
    e.stopPropagation(); // 비디오 재생/정지 이벤트 방지
    
    // 나중에 단일 스냅 페이지가 만들어지면 쓸 수 있는 URL 형식으로 준비
    const shareUrl = `${window.location.origin}/snap/${snap.id}`;
    const shareData = {
      title: 'Fashion.2.Cation 스냅',
      text: `${snap.author || '유저'}님의 멋진 스타일을 확인해보세요! 🎬`,
      url: shareUrl
    };

    // 1. 모바일 환경 등 Web Share API를 지원하는 경우 (카카오톡, 인스타 등 네이티브 공유 창)
    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        console.error('공유 취소 또는 실패:', err);
      }
    } 
    // 2. PC 등 지원하지 않는 환경의 경우 (클립보드 복사 폴백)
    else {
      try {
        await navigator.clipboard.writeText(shareUrl);
        alert("🔗 링크가 클립보드에 복사되었습니다!\n원하는 곳에 붙여넣기 해주세요.");
      } catch (err) {
        alert("링크 복사에 실패했습니다.");
        console.error('클립보드 복사 실패:', err);
      }
    }
  };

  // 🖼️ 이미지 에러 핸들러 (무한루프 방지 포함)
  const handleImageError = (e) => {
    if (e.target.dataset.errorHandled) return;
    e.target.dataset.errorHandled = "true";
    e.target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 40 40'%3E%3Crect width='40' height='40' fill='%23cccccc'/%3E%3C/svg%3E";
  };

  return (
    <div className="snap-item-wrapper">
      <div className="snap-card">
        {/* 1. 상단 헤더 */}
        <div className="snap-card-header">
          <div className="snap-header-left" onClick={() => onProfileClick && onProfileClick(snap.user_id)} style={{ cursor: 'pointer' }}>
            <img 
              src={snap.author_profile_image || "data:image/svg+xml,%3Csvg..."} 
              alt="profile" 
              onError={handleImageError}
            />
            <div className="snap-header-info">
              <span className="snap-header-name">{snap.author || "사용자"}</span>
              <span className="snap-header-date">• {new Date(snap.created_at).toLocaleDateString()}</span>
            </div>
          </div>
          
          <div className="snap-header-right">
            <span style={{ color: '#d16b3c', marginRight: '10px', fontSize: '13px' }}>{snap.location_name || "위치 정보 없음"}</span>
            
            {/* 본인 글일 때만 수정/삭제 메뉴 노출 */}
            {currentUserId === snap.user_id ? (
              <div className="snap-more-menu" style={{ cursor: 'pointer', display: 'flex', gap: '8px', fontSize: '16px' }}>
                <span onClick={(e) => { e.stopPropagation(); onEditOpen(snap); }} title="수정">✏️</span>
                <span onClick={handleDelete} title="삭제">🗑️</span>
              </div>
            ) : (
              <span style={{ cursor: 'pointer', color: '#999' }}>⋮</span>
            )}
          </div>
        </div>

        {/* 2. 본문 텍스트 영역 */}
        {snap.content && (
          <div className="snap-card-text" style={{ padding: '0 20px', marginBottom: '10px', fontSize: '15px', color: '#333' }}>
            <span>{snap.content}</span>
            <span className="snap-translate-btn" style={{ marginLeft: '8px', color: '#d16b3c', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>번역</span>
          </div>
        )}

        {/* 3. 🎬 비디오 컨테이너 */}
        <div className="snap-video-container" style={{ position: 'relative', background: '#000', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {isVideoLoading && (
            <div className="video-loader" style={{
              position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: '#fff', zIndex: 1
            }}>
              Loading...
            </div>
          )}
          <video
            ref={videoRef}
            className="snap-video"
            src={snap.video_url}
            loop
            playsInline
            muted
            preload="auto"
            onPlaying={() => setIsVideoLoading(false)}
            onCanPlay={() => setIsVideoLoading(false)}
            onClick={() => {
              if (videoRef.current.paused) videoRef.current.play();
              else videoRef.current.pause();
            }}
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />
        </div>

        {/* 4. 태그 영역 */}
        {snap.tags && snap.tags.length > 0 && (
          <div className="snap-card-tags" style={{ padding: '12px 20px 0', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {snap.tags.map((tag, idx) => (
              <span key={idx} className="snap-tag" style={{ background: '#fdf3ed', color: '#d16b3c', padding: '4px 10px', borderRadius: '15px', fontSize: '12px', fontWeight: 'bold' }}>
                #{tag.tag_name || tag}
              </span>
            ))}
          </div>
        )}

        {/* 5. 하단 액션바 */}
        <div className="snap-card-footer" style={{ padding: '16px 20px', display: 'flex', gap: '20px', borderTop: '1px solid #f5f5f5', marginTop: '10px' }}>
          <div className="snap-action-btn" onClick={handleLike} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', color: isLiked ? '#ff4d4f' : '#666' }}>
            <span style={{ fontSize: '18px' }}>{isLiked ? '❤️' : '♡'}</span> 좋아요 {likeCount}
          </div>
          <div className="snap-action-btn" onClick={handleCommentClick} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', color: '#666' }}>
            <span style={{ fontSize: '18px' }}>💬</span> 댓글 {snap.comment_count || 0}
          </div>
          {/* 💡 [추가됨] onClick 이벤트에 handleShare 연결 */}
          <div className="snap-action-btn" onClick={handleShare} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', color: '#666' }}>
            <span style={{ fontSize: '18px' }}>⎘</span> 공유
          </div>
        </div>
      </div>
    </div>
  );
}