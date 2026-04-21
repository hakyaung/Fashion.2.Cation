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
        
        // 브라우저 환경 감지 (HTTPS/AWS vs HTTP/Local)
        const currentProtocol = window.location.protocol;
        const currentHost = window.location.hostname;
        
        // 💡 하경님의 핵심 IP 로직: 접속 주소에 따라 백엔드 URL을 동적으로 결정
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
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#000', color: '#fff' }}>
        <div className="reels-loader">스냅을 불러오는 중... 🎬</div>
      </div>
    );
  }

  // 데이터 없을 때 UI
  if (snaps.length === 0) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#000', color: '#999' }}>
        아직 등록된 스냅이 없습니다. ✨
      </div>
    );
  }

  return (
    <div className="snap-feed-container">
      {snaps.map((snap) => (
        /* ✨ 핵심: CSS의 scroll-snap-align: start를 작동시키기 위해 
           각 SnapItem을 snap-item-wrapper로 감쌉니다. 
           이 구조가 있어야 릴스처럼 한 화면씩 딱딱 끊겨서 보입니다. 
        */
        <div className="snap-item-wrapper" key={snap.id}>
          <SnapItem 
            snap={snap} 
            onProfileClick={onProfileClick} 
            
            // 💡 댓글 모달 연동 및 실시간 카운트 업데이트 콜백 완벽 전달
            onCommentOpen={(id, ownerId) => 
              onCommentOpen(
                id, 
                ownerId, 
                'snap', 
                handleCommentCountIncrease, 
                handleCommentCountDecrease
              )
            }
            
            onEditOpen={onEditOpen}
            onDeleteSnap={onDeleteSnap}
          />
        </div>
      ))}
    </div>
  );
}