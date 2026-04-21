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
        
        // 💡 [핵심 수정] HTTP(로컬)와 HTTPS(AWS) 환경을 모두 지원하는 동적 라우팅!
        const currentProtocol = window.location.protocol; // 'http:' 또는 'https:'
        const currentHost = window.location.hostname;
        
        // HTTPS 환경에서는 포트(8000)를 빼고 리버스 프록시(443 포트)로 요청합니다.
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