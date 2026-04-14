import React, { useState, useEffect } from 'react';
import { API_URL } from '../../api/api';

export default function MessageListView({ currentUserId, onRoomClick }) {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUserId) return;

    // 💡 데이터를 불러오는 함수
    const fetchRooms = async () => {
      try {
        const res = await fetch(`${API_URL}/api/v1/chat/rooms?current_user_id=${currentUserId}`);
        const data = await res.json();
        setRooms(data);
      } catch (e) {
        console.error("방 목록 로딩 실패", e);
      } finally {
        // 첫 로딩 시에만 로딩 화면을 없애주고, 이후 3초마다 갱신될 때는 화면 깜빡임 없이 조용히 넘어갑니다.
        setLoading(false);
      }
    };

    // 1. 컴포넌트가 마운트될 때 즉시 1회 호출
    fetchRooms();

    // 💡 2. 3초(3000ms)마다 백그라운드에서 조용히 새로고침 실행 (실시간 빨간원 뱃지용)
    const intervalId = setInterval(() => {
      fetchRooms();
    }, 3000);

    // 3. 사용자가 다른 화면으로 이동하면 타이머를 꺼서 메모리 누수 방지
    return () => clearInterval(intervalId);
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
              
              {/* 💡 안 읽은 메시지가 있을 경우에만 빨간 원(뱃지) 표시 */}
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