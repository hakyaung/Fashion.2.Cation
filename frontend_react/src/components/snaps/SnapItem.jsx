import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useAuth } from '../../context/Authcontext';
import { ref, deleteObject } from "firebase/storage";
import { getAuth, signInAnonymously } from 'firebase/auth'; // ✅ 추가
import { storage } from '../../firebase';
import { preloadVideo, getCachedUrl } from '../../utils/videoPreloader';
import './SnapFeed.css';

// ✅ Firebase Auth 보장 헬퍼 — 이미 로그인돼 있으면 아무것도 안 함
const ensureFirebaseAuth = async () => {
  const auth = getAuth();
  if (!auth.currentUser) {
    await signInAnonymously(auth);
  }
};

export default function SnapItem({
  snap,
  onProfileClick,
  onCommentOpen,
  onEditOpen,
  onDeleteSnap,
  onBecomeActive,
}) {
  const { currentUserId } = useAuth();
  const videoRef = useRef(null);
  const containerRef = useRef(null);

  const [isLiked, setIsLiked] = useState(snap.is_liked);
  const [likeCount, setLikeCount] = useState(snap.like_count);
  const [isVideoLoading, setIsVideoLoading] = useState(false);

  const token = localStorage.getItem('stylescape_token');
  const currentProtocol = window.location.protocol;
  const currentHost = window.location.hostname;
  const API_BASE = currentProtocol === 'https:'
    ? `https://${currentHost}`
    : `http://${currentHost}:8000`;

  const applyVideoSrc = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    const cachedBlobUrl = getCachedUrl(snap.video_url);
    const targetSrc = cachedBlobUrl ?? snap.video_url;

    if (video.src === targetSrc) return;

    video.src = targetSrc;
    setIsVideoLoading(true);

    if (!cachedBlobUrl) {
      preloadVideo(snap.video_url);
    }
  }, [snap.video_url]);

  useEffect(() => {
    const video = videoRef.current;
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          const ratio = entry.intersectionRatio;

          if (ratio >= 0.6) {
            applyVideoSrc();
            video?.play().catch(() => {});
            onBecomeActive?.(snap.id);

          } else if (entry.isIntersecting) {
            applyVideoSrc();

          } else {
            video?.pause();
            if (video) video.currentTime = 0;
          }
        });
      },
      {
        threshold: [0, 0.6],
        rootMargin: '100% 0px',
      }
    );

    observer.observe(container);
    return () => observer.disconnect();
  }, [applyVideoSrc, snap.id, onBecomeActive]);

  const handleCanPlay = useCallback(() => {
    setIsVideoLoading(false);
    videoRef.current?.play().catch(() => {});
  }, []);

  // ❤️ 좋아요
  const handleLike = async (e) => {
    e.stopPropagation();
    if (!token) return alert("로그인이 필요합니다!");
    try {
      const res = await fetch(`${API_BASE}/api/v1/posts/snaps/${snap.id}/like`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.status === 'liked') {
        setIsLiked(true);
        setLikeCount(prev => prev + 1);
      } else {
        setIsLiked(false);
        setLikeCount(prev => prev - 1);
      }
    } catch (err) {
      console.error("좋아요 처리 실패:", err);
    }
  };

  // 💬 댓글
  const handleCommentClick = (e) => {
    e.stopPropagation();
    onCommentOpen?.(snap.id, snap.user_id, 'snap');
  };

  // 🗑️ 삭제 — ✅ ensureFirebaseAuth 추가
  const handleDelete = async (e) => {
    e.stopPropagation();
    if (!window.confirm("이 스냅 영상을 삭제하시겠습니까?")) return;

    try {
      if (snap.video_url?.includes('firebasestorage')) {
        await ensureFirebaseAuth(); // ✅ 삭제 전 Firebase Auth 보장
        const fileRef = ref(storage, snap.video_url);
        await deleteObject(fileRef).catch(err => {
          if (err.code !== 'storage/object-not-found') throw err;
        });
      }
    } catch (err) {
      console.error("Firebase 파일 삭제 에러:", err);
    }
    onDeleteSnap(snap.id);
  };

  // ✈️ 공유
  const handleShare = async (e) => {
    e.stopPropagation();
    const shareUrl = `${window.location.origin}/snap/${snap.id}`;
    const shareData = {
      title: 'Fashion.2.Cation 스냅',
      text: `${snap.author || '유저'}님의 멋진 스타일을 확인해보세요! 🎬`,
      url: shareUrl,
    };
    if (navigator.share) {
      try { await navigator.share(shareData); } catch {}
    } else {
      try {
        await navigator.clipboard.writeText(shareUrl);
        alert("🔗 링크가 복사되었습니다!");
      } catch { alert("복사 실패"); }
    }
  };

  const handleImageError = (e) => {
    if (e.target.dataset.errorHandled) return;
    e.target.dataset.errorHandled = "true";
    e.target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 40 40'%3E%3Crect width='40' height='40' fill='%23cccccc'/%3E%3C/svg%3E";
  };

  return (
    <div className="reels-item-container" ref={containerRef}>

      <video
        ref={videoRef}
        className="reels-video"
        loop
        playsInline
        muted
        preload="auto"
        onPlaying={() => setIsVideoLoading(false)}
        onCanPlay={handleCanPlay}
        onClick={() => {
          const v = videoRef.current;
          if (v?.readyState >= 2) {
            v.paused ? v.play().catch(() => {}) : v.pause();
          }
        }}
      />

      <div className="reels-overlay-bottom" />

      <div className="reels-info-section" style={{ bottom: '80px' }}>
        <div className="reels-user-row" onClick={() => onProfileClick?.(snap.user_id)}>
          <img
            src={snap.author_profile_image || "data:image/svg+xml,%3Csvg..."}
            alt="profile"
            onError={handleImageError}
            className="reels-avatar"
            style={{ width: '32px', height: '32px' }}
          />
          <span className="reels-username" style={{ fontSize: '14px' }}>{snap.author || "사용자"}</span>
          <button className="reels-follow-btn" style={{ padding: '2px 8px', fontSize: '11px' }}>팔로우</button>
        </div>

        <div className="reels-content-box">
          <p className="reels-text" style={{ fontSize: '13px' }}>
            {snap.content}
            <span className="reels-translate-link" onClick={e => e.stopPropagation()} style={{ fontSize: '11px' }}>번역 보기</span>
          </p>
        </div>

        <div className="reels-tags-row">
          {snap.tags?.map((tag, idx) => (
            <span key={idx} className="reels-tag-item" style={{ fontSize: '12px' }}>
              #{tag.tag_name || tag}
            </span>
          ))}
        </div>

        <div className="reels-location-tag" style={{ fontSize: '11px' }}>
          📍 {snap.location_name || "위치 정보 없음"}
        </div>
      </div>

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
            <div className="reels-action-btn" onClick={e => { e.stopPropagation(); onEditOpen(snap); }}>
              <div className="reels-icon-circle" style={{ fontSize: '20px' }}>✏️</div>
            </div>
            <div className="reels-action-btn" onClick={handleDelete}>
              <div className="reels-icon-circle" style={{ fontSize: '20px' }}>🗑️</div>
            </div>
          </>
        )}
      </div>

      {isVideoLoading && (
        <div className="reels-loader">영상을 불러오는 중... 🎬</div>
      )}
    </div>
  );
}