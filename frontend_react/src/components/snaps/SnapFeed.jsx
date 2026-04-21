// frontend_react/src/components/snaps/SnapFeed.jsx
import React, { useState, useEffect } from 'react';
import SnapItem from './SnapItem';
import './SnapFeed.css';

export default function SnapFeed({ onProfileClick, onCommentOpen, onEditOpen, onDeleteSnap }) {
  const [snaps, setSnaps] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSnaps = async () => {
      try {
        const token = localStorage.getItem('stylescape_token');
        const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
        
        // 💡 [핵심] 현재 브라우저의 접속 주소를 감지하여 백엔드 주소를 자동 완성합니다!
        // 내 컴퓨터면 'localhost', AWS 서버면 '13.x.x.x' 등 접속 IP를 스스로 알아냅니다.
        const currentHost = window.location.hostname;
        const API_URL = `http://${currentHost}:8000/api/v1/posts/snaps`;
        
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

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: '#999' }}>
        스냅을 불러오는 중입니다... 🎬
      </div>
    );
  }

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
          onCommentOpen={onCommentOpen}
          onEditOpen={onEditOpen}
          onDeleteSnap={onDeleteSnap}
        />
      ))}
    </div>
  );
}