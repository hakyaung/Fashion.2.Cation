// frontend_react/src/components/snaps/SnapFeed.jsx
import React, { useState, useEffect, useCallback } from 'react';
import SnapItem from './SnapItem';
import { preloadVideo } from '../../utils/videoPreloader';
import './SnapFeed.css';

const INITIAL_COUNT = 4;   // 초기 렌더링 개수
const LOAD_MORE_COUNT = 3; // 추가 로딩 단위

export default function SnapFeed({ onProfileClick, onCommentOpen, onEditOpen, onDeleteSnap, prefetchedSnaps }) {

  const [snaps, setSnaps] = useState(prefetchedSnaps || []);
  const [loading, setLoading] = useState(!prefetchedSnaps);
  const [visibleCount, setVisibleCount] = useState(INITIAL_COUNT);

  // 부모 프리패치 데이터 반영
  useEffect(() => {
    if (prefetchedSnaps != null) {
      setSnaps(prefetchedSnaps);
      setLoading(false);
      setVisibleCount(INITIAL_COUNT);

      // 🚀 데이터 도착 즉시 첫 2개 영상 선제 다운로드 시작
      prefetchedSnaps.slice(0, 2).forEach(snap => {
        preloadVideo(snap.video_url);
      });
    }
  }, [prefetchedSnaps]);

  // 프리패칭 데이터 없을 때 직접 fetch
  useEffect(() => {
    if (prefetchedSnaps?.length > 0) return;

    const fetchSnaps = async () => {
      try {
        const token = localStorage.getItem('stylescape_token');
        const headers = token ? { 'Authorization': `Bearer ${token}` } : {};

        const currentProtocol = window.location.protocol;
        const currentHost = window.location.hostname;
        const API_URL = currentProtocol === 'https:'
          ? `https://${currentHost}/api/v1/posts/snaps`
          : `http://${currentHost}:8000/api/v1/posts/snaps`;

        const res = await fetch(API_URL, { headers });
        if (res.ok) {
          const data = await res.json();
          setSnaps(data);

          // 🚀 fetch 완료 즉시 첫 2개 선제 다운로드
          data.slice(0, 2).forEach(snap => preloadVideo(snap.video_url));
        }
      } catch (err) {
        console.error('스냅 목록 불러오기 실패:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchSnaps();
  }, [prefetchedSnaps]);

  // 🚀 [핵심] SnapItem이 활성화됐다고 알리면 → 다음 영상 Blob 선제 다운로드
  const handleSnapBecomeActive = useCallback((activeSnapId) => {
    const allVisible = snaps.slice(0, visibleCount);
    const activeIdx = allVisible.findIndex(s => s.id === activeSnapId);

    if (activeIdx < 0) return;

    // 다음 2개 영상 미리 다운로드 (화면에 보이는 영상 재생 중에 백그라운드로)
    [activeIdx + 1, activeIdx + 2].forEach(nextIdx => {
      const url = snaps[nextIdx]?.video_url;
      if (url) preloadVideo(url);
    });

    // 끝에서 2번째 영상에 도달하면 더 렌더링
    if (activeIdx >= visibleCount - 2) {
      setVisibleCount(prev => Math.min(prev + LOAD_MORE_COUNT, snaps.length));
    }
  }, [snaps, visibleCount]);

  // 댓글 수 실시간 반영
  const handleCommentCountIncrease = useCallback((snapId) => {
    setSnaps(prev => prev.map(s =>
      s.id === snapId ? { ...s, comment_count: (s.comment_count || 0) + 1 } : s
    ));
  }, []);

  const handleCommentCountDecrease = useCallback((snapId) => {
    setSnaps(prev => prev.map(s =>
      s.id === snapId ? { ...s, comment_count: Math.max(0, (s.comment_count || 0) - 1) } : s
    ));
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#000', color: '#fff' }}>
        <div className="reels-loader">스냅을 불러오는 중... 🎬</div>
      </div>
    );
  }

  if (snaps.length === 0) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#000', color: '#999' }}>
        아직 등록된 스냅이 없습니다. ✨
      </div>
    );
  }

  const visibleSnaps = snaps.slice(0, visibleCount);

  return (
    <div className="snap-feed-container">
      {visibleSnaps.map(snap => (
        <div className="snap-item-wrapper" key={snap.id}>
          <SnapItem
            snap={snap}
            onProfileClick={onProfileClick}
            onBecomeActive={handleSnapBecomeActive}
            onCommentOpen={(id, ownerId) =>
              onCommentOpen(id, ownerId, 'snap', handleCommentCountIncrease, handleCommentCountDecrease)
            }
            onEditOpen={onEditOpen}
            onDeleteSnap={onDeleteSnap}
          />
        </div>
      ))}

      {/* 스크롤 하단 sentinel — 보이면 다음 배치 렌더링 */}
      {visibleCount < snaps.length && (
        <div style={{
          height: '1px',
          background: 'transparent',
        }} />
      )}
    </div>
  );
}