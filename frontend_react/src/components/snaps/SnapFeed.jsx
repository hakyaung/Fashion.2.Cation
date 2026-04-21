// frontend_react/src/components/snaps/SnapFeed.jsx
import React, { useState, useEffect, useCallback } from 'react';
import SnapItem from './SnapItem';
import './SnapFeed.css';

export default function SnapFeed({ onProfileClick, onCommentOpen, onEditOpen, onDeleteSnap }) {
  const [snaps, setSnaps] = useState([]);
  const [loading, setLoading] = useState(true);

  // 1. 🌐 스냅 데이터 로드 (로컬/AWS 자동 감지 및 IP 로직 완벽 유지)
  useEffect(() => {
    const fetchSnaps = async () => {
      try {
        const token = localStorage.getItem('stylescape_token');
        const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
        
        // 브라우저 환경 감지
        const currentProtocol = window.location.protocol;
        const currentHost = window.location.hostname;
        
        // 하경님의 핵심 IP 로직: 배포 환경(HTTPS)과 로컬(8000포트) 자동 분기
        const API_URL = currentProtocol === 'https:'
          ? `https://${currentHost}/api/v1/posts/snaps`
          : `http://${currentHost}:8000/api/v1/posts/snaps`;
        
        const response = await fetch(API_URL, { headers }); 
        
        if (response.ok) {
          const data = await response.json();
          setSnaps(data);
        }
      } catch (error) {
        console.error('스냅 목록 불러오기 실패:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchSnaps();
  }, []);

  // 💬 댓글 작성 시 숫자를 실시간으로 +1 (기능 유지)
  const handleCommentCountIncrease = useCallback((snapId) => {
    setSnaps((prev) =>
      prev.map((s) =>
        s.id === snapId ? { ...s, comment_count: (s.comment_count || 0) + 1 } : s
      )
    );
  }, []);

  // 💬 댓글 삭제 시 숫자를 실시간으로 -1 (기능 유지)
  const handleCommentCountDecrease = useCallback((snapId) => {
    setSnaps((prev) =>
      prev.map((s) =>
        s.id === snapId ? { ...s, comment_count: Math.max(0, (s.comment_count || 0) - 1) } : s
      )
    );
  }, []);

  // 로딩 상태 UI
  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh', color: '#999' }}>
        스냅을 불러오는 중입니다... 🎬
      </div>
    );
  }

  // 데이터 없을 때 UI
  if (snaps.length === 0) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh', color: '#999' }}>
        아직 등록된 스냅이 없습니다. 첫 스냅의 주인공이 되어보세요! ✨
      </div>
    );
  }

  return (
    <div className="snap-feed-container">
      {snaps.map((snap) => (
        /* ✨ 핵심: 디자인은 기존과 동일하지만, 
          CSS의 scroll-snap-align: start를 작동시키기 위해 각 아이템을 wrapper로 감쌉니다.
        */
        <div className="snap-item-wrapper" key={snap.id}>
          <SnapItem 
            snap={snap} 
            onProfileClick={onProfileClick} 
            
            // 💡 댓글 모달 연동 및 실시간 카운트 업데이트 콜백 전달
            onCommentOpen={(id, ownerId) => 
              onCommentOpen(id, ownerId, 'snap', handleCommentCountIncrease, handleCommentCountDecrease)
            }
            
            onEditOpen={onEditOpen}
            onDeleteSnap={onDeleteSnap}
          />
        </div>
      ))}
    </div>
  );
}