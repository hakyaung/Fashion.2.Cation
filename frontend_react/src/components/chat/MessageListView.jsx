import React, { useState, useEffect } from 'react';
import { API_URL } from '../../api/api';

export default function MessageListView({ currentUserId, onRoomClick }) {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRooms = async () => {
      try {
        const res = await fetch(`${API_URL}/api/v1/chat/rooms?current_user_id=${currentUserId}`);
        const data = await res.json();
        setRooms(data);
      } catch (e) {
        console.error("방 목록 로딩 실패", e);
      } finally {
        setLoading(false);
      }
    };
    fetchRooms();
  }, [currentUserId]);

  const getFullImageUrl = (url) => {
    if (!url) return "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=100";
    return url.startsWith('http') ? url : `${API_URL}${url}`;
  };

  if (loading) return <div style={{ padding: '20px', textAlign: 'center' }}>메시지를 불러오는 중...</div>;

  return (
    <div className="view-messages" style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
      <h2 style={{ marginBottom: '20px', fontSize: '24px' }}>메시지</h2>
      {rooms.length === 0 ? (
        <div style={{ color: '#999', textAlign: 'center', marginTop: '50px' }}>아직 대화 내역이 없습니다.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {rooms.map((room) => (
            <div 
              key={room.id} 
              onClick={() => onRoomClick(room.other_user)}
              style={{ 
                display: 'flex', alignItems: 'center', padding: '15px', 
                borderRadius: '12px', cursor: 'pointer', transition: 'background 0.2s',
                backgroundColor: '#fff', border: '1px solid #eee'
              }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f9f9f9'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#fff'}
            >
              <img 
                src={getFullImageUrl(room.other_user.profile_image_url)} 
                alt="avatar" 
                style={{ width: '56px', height: '56px', borderRadius: '50%', objectFit: 'cover', marginRight: '15px' }} 
              />
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <div style={{ fontWeight: 'bold', fontSize: '16px', marginBottom: '4px' }}>{room.other_user.nickname}</div>
                <div style={{ fontSize: '14px', color: '#666', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {room.last_message}
                </div>
              </div>
              {room.unread_count > 0 && (
                <div style={{ backgroundColor: 'var(--rust)', color: '#fff', borderRadius: '50%', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px' }}>
                  {room.unread_count}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}