// frontend_react/src/components/snaps/SnapFeed.jsx
import React, { useState, useEffect, useCallback } from 'react';
import SnapItem from './SnapItem';
import './SnapFeed.css';

export default function SnapFeed({ onProfileClick, onCommentOpen, onEditOpen, onDeleteSnap }) {
  const [snaps, setSnaps] = useState([]);
  const [loading, setLoading] = useState(true);

  // 1. 스냅 데이터 로드 (로컬/AWS 자동 감지)
  useEffect(() => {
    const fetchSnaps = async () => {
      try {
        const token = localStorage.getItem('stylescape_token');
        const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
        
        const currentProtocol = window.location.protocol;
        const currentHost = window.location.hostname;
        
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

  // 💡 [추가] 댓글이 작성되었을 때 화면상의 댓글 수를 실시간으로 +1 해주는 로직
  const handleCommentCountIncrease = useCallback((snapId) => {
    setSnaps((prev) =>
      prev.map((s) =>
        s.id === snapId ? { ...s, comment_count: (s.comment_count || 0) + 1 } : s
      )
    );
  }, []);

  // 💡 [추가] 댓글이 삭제되었을 때 화면상의 댓글 수를 실시간으로 -1 해주는 로직
  const handleCommentCountDecrease = useCallback((snapId) => {
    setSnaps((prev) =>
      prev.map((s) =>
        s.id === snapId ? { ...s, comment_count: Math.max(0, (s.comment_count || 0) - 1) } : s
      )
    );
  }, []);

  // 로딩 UI
  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: '#999' }}>
        스냅을 불러오는 중입니다... 🎬
      </div>
    );
  }

  // 빈 화면 UI
  if (snaps.length === 0) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: '#999' }}>
        아직 등록된 스냅이 없습니다. 첫 스냅의 주인공이 되어보세요! ✨
      </div>
    );
  }

  return (
    <div className="snap-feed-container">
      {snaps.map((snap) => (
        <SnapItem 
          key={snap.id} 
          snap={snap} 
          onProfileClick={onProfileClick} 
          
          // 💡 [핵심 수정] 
          // 이제 댓글 모달을 열 때, 'snap' 타입임을 알리고 
          // 숫자를 올리고 내리는 함수(Callback)들을 함께 배달해줍니다.
          onCommentOpen={(id, ownerId) => 
            onCommentOpen(id, ownerId, 'snap', handleCommentCountIncrease, handleCommentCountDecrease)
          }
          
          onEditOpen={onEditOpen}
          onDeleteSnap={onDeleteSnap}
        />
      ))}
    </div>
  );
}