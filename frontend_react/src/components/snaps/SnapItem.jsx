// frontend_react/src/components/snaps/SnapItem.jsx
import React, { useRef, useEffect, useState } from 'react';
import { useAuth } from '../../context/Authcontext'; 
import { ref, deleteObject } from "firebase/storage";
import { storage } from '../../firebase'; 
import './SnapFeed.css';

export default function SnapItem({ snap, onProfileClick, onCommentOpen, onEditOpen, onDeleteSnap }) {
  const { currentUserId } = useAuth();
  const videoRef = useRef(null);
  
  // 상태 관리 (좋아요 및 로딩)
  const [isLiked, setIsLiked] = useState(snap.is_liked);
  const [likeCount, setLikeCount] = useState(snap.like_count);
  const [isVideoLoading, setIsVideoLoading] = useState(true);

  const token = localStorage.getItem('stylescape_token');

  // 💡 [기능 유지] 현재 접속 환경(HTTP/HTTPS, 도메인/IP)을 감지하여 API 주소를 동적으로 설정
  const currentProtocol = window.location.protocol;
  const currentHost = window.location.hostname;
  const API_BASE = currentProtocol === 'https:' 
    ? `https://${currentHost}` 
    : `http://${currentHost}:8000`;

  // [기능 유지] 비디오 관찰자 로직 (자동 재생/정지)
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            if (videoRef.current && videoRef.current.src) {
              videoRef.current.play().catch(() => {});
            }
          } else {
            if (videoRef.current) {
              videoRef.current.pause();
              videoRef.current.currentTime = 0; 
            }
          }
        });
      },
      { threshold: 0.6 } // 릴스 스타일을 위해 60% 이상 보일 때 재생
    );

    if (videoRef.current) observer.observe(videoRef.current);
    return () => observer.disconnect();
  }, []);

  // [기능 유지] ❤️ 좋아요 토글 (동적 API 주소 적용)
  const handleLike = async (e) => {
    e.stopPropagation();
    if (!token) return alert("로그인이 필요합니다!");
    
    try {
      const response = await fetch(`${API_BASE}/api/v1/posts/snaps/${snap.id}/like`, {
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

  // [기능 유지] 💬 댓글 모달 연결
  const handleCommentClick = (e) => {
    e.stopPropagation();
    if (onCommentOpen) {
      onCommentOpen(snap.id, snap.user_id, 'snap');
    }
  };

  // [기능 유지] 🛠️ 삭제 핸들러 (파이어베이스 및 404 예외 처리)
  const handleDelete = async (e) => {
    e.stopPropagation();
    if (window.confirm("이 스냅 영상을 삭제하시겠습니까?")) {
      try {
        if (snap.video_url && snap.video_url.includes('firebasestorage')) {
          const fileRef = ref(storage, snap.video_url);
          await deleteObject(fileRef).catch(error => {
            if (error.code === 'storage/object-not-found') {
              console.warn("스토리지에 파일이 이미 없습니다.");
            } else {
              throw error;
            }
          });
        }
      } catch (error) {
        console.error("Firebase 파일 삭제 에러:", error);
      }
      onDeleteSnap(snap.id);
    }
  };

  // [기능 유지] ⎘ 스마트 공유 핸들러
  const handleShare = async (e) => {
    e.stopPropagation(); 
    const shareUrl = `${window.location.origin}/snap/${snap.id}`;
    const shareData = {
      title: 'Fashion.2.Cation 스냅',
      text: `${snap.author || '유저'}님의 멋진 스타일을 확인해보세요! 🎬`,
      url: shareUrl
    };

    if (navigator.share) {
      try { await navigator.share(shareData); } catch (err) {}
    } else {
      try {
        await navigator.clipboard.writeText(shareUrl);
        alert("🔗 링크가 복사되었습니다!");
      } catch (err) { alert("복사 실패"); }
    }
  };

  const handleImageError = (e) => {
    if (e.target.dataset.errorHandled) return;
    e.target.dataset.errorHandled = "true";
    e.target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 40 40'%3E%3Crect width='40' height='40' fill='%23cccccc'/%3E%3C/svg%3E";
  };

  return (
    <div className="reels-item-container">
      {/* 1. 메인 비디오 (배경 전체) */}
      <video
        ref={videoRef}
        className="reels-video"
        src={snap.video_url}
        loop
        playsInline
        muted
        preload="auto"
        onPlaying={() => setIsVideoLoading(false)}
        onCanPlay={() => setIsVideoLoading(false)}
        onClick={() => {
          if (videoRef.current && videoRef.current.readyState >= 2) {
            if (videoRef.current.paused) videoRef.current.play().catch(() => {});
            else videoRef.current.pause();
          }
        }}
      />

      {/* 2. 가독성을 위한 하단 그라데이션 오버레이 */}
      <div className="reels-overlay-bottom" />

      {/* 3. 좌측 하단 정보 섹션 (유저 정보, 본문, 태그) */}
      {/* 💡 강제 끌어올리기: bottom을 80px로 올려 하단바에 안 씹히게 고정 */}
      <div className="reels-info-section" style={{ bottom: '80px' }}>
        <div className="reels-user-row" onClick={() => onProfileClick && onProfileClick(snap.user_id)}>
          <img 
            src={snap.author_profile_image || "data:image/svg+xml,%3Csvg..."} 
            alt="profile" 
            onError={handleImageError}
            className="reels-avatar"
            style={{ width: '32px', height: '32px' }} /* 프사 크기도 살짝 조절 */
          />
          <span className="reels-username" style={{ fontSize: '14px' }}>{snap.author || "사용자"}</span>
          <button className="reels-follow-btn" style={{ padding: '2px 8px', fontSize: '11px' }}>팔로우</button>
        </div>
        
        <div className="reels-content-box">
          <p className="reels-text" style={{ fontSize: '13px' }}>
            {snap.content}
            <span className="reels-translate-link" onClick={(e) => { e.stopPropagation(); /* 번역 로직 연동 가능 */ }} style={{ fontSize: '11px' }}>번역 보기</span>
          </p>
        </div>

        <div className="reels-tags-row">
          {snap.tags?.map((tag, idx) => (
            <span key={idx} className="reels-tag-item" style={{ fontSize: '12px' }}>#{tag.tag_name || tag}</span>
          ))}
        </div>
        
        <div className="reels-location-tag" style={{ fontSize: '11px' }}>
          📍 {snap.location_name || "위치 정보 없음"}
        </div>
      </div>

      {/* 4. 우측 세로 액션 버튼 섹션 */}
      {/* 💡 강제 끌어올리기 & 크기 줄이기: bottom 90px, 아이콘 크기와 간격을 틱톡처럼 슬림하게 조정 */}
      <div className="reels-actions-column" style={{ bottom: '90px', gap: '14px' }}>
        <div className="reels-action-btn" onClick={handleLike}>
          <div className={`reels-icon-circle ${isLiked ? 'liked' : ''}`} style={{ fontSize: '24px' }}>
            {isLiked ? '❤️' : '🤍'}
          </div>
          <span className="reels-action-count" style={{ fontSize: '11px' }}>{likeCount}</span>
        </div>

        <div className="reels-action-btn" onClick={handleCommentClick}>
          <div className="reels-icon-circle" style={{ fontSize: '24px' }}>💬</div>
          <span className="reels-action-count" style={{ fontSize: '11px' }}>{snap.comment_count || 0}</span>
        </div>

        <div className="reels-action-btn" onClick={handleShare}>
          <div className="reels-icon-circle" style={{ fontSize: '24px' }}>✈️</div>
          <span className="reels-action-count" style={{ fontSize: '11px' }}>공유</span>
        </div>

        {currentUserId === snap.user_id && (
          <>
            <div className="reels-action-btn" onClick={(e) => { e.stopPropagation(); onEditOpen(snap); }}>
              <div className="reels-icon-circle" style={{ fontSize: '20px' }}>✏️</div>
            </div>
            <div className="reels-action-btn" onClick={handleDelete}>
              <div className="reels-icon-circle" style={{ fontSize: '20px' }}>🗑️</div>
            </div>
          </>
        )}
      </div>

      {/* 로딩 표시 */}
      {isVideoLoading && <div className="reels-loader">Loading...</div>}
    </div>
  );
}