// frontend_react/src/components/snaps/SnapFeed.jsx
import React, { useState, useEffect } from 'react';
import SnapItem from './SnapItem';
import './SnapFeed.css';

// 💡 1. 부모(CommunityPage)가 주는 모든 함수를 빠짐없이 받아옵니다.
export default function SnapFeed({ onProfileClick, onCommentOpen, onEditOpen, onDeleteSnap }) {
  const [snaps, setSnaps] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSnaps = async () => {
      try {
        // 💡 2. 로그인 유저의 토큰을 가져와서 함께 보냅니다. (본인 좋아요/권한 확인용)
        const token = localStorage.getItem('stylescape_token');
        const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
        
        const response = await fetch('http://localhost:8000/api/v1/posts/snaps', { headers }); 
        
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

  // 로딩 중일 때 깔끔한 UI
  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: '#999' }}>
        스냅을 불러오는 중입니다... 🎬
      </div>
    );
  }

  // 스냅이 하나도 없을 때 보여줄 빈 화면 UI
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
          
          // 💡 3. 받아온 함수들을 자식(SnapItem)에게 안전하게 배달해 줍니다!
          onProfileClick={onProfileClick} 
          onCommentOpen={onCommentOpen}
          onEditOpen={onEditOpen}
          onDeleteSnap={onDeleteSnap}
        />
      ))}
    </div>
  );
}