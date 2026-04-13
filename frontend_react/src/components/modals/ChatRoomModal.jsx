import React, { useState, useEffect, useRef } from 'react';
import { API_URL, getOrCreateChatRoom, fetchChatHistory } from '../../api/api';

export default function ChatRoomModal({ isOpen, onClose, currentUserId, targetUser }) {
  const [roomId, setRoomId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const wsRef = useRef(null); 
  const messagesEndRef = useRef(null);

  // 스크롤 하단 이동 함수
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (!isOpen || !targetUser || !currentUserId) return;

    let isMounted = true;

    const setupChat = async () => {
      try {
        const roomData = await getOrCreateChatRoom(targetUser.id);
        const currentRoomId = roomData.room_id;
        if (isMounted) setRoomId(currentRoomId);

        const history = await fetchChatHistory(currentRoomId);
        if (isMounted) setMessages(history);

        // 💡 주소 생성 로직 강화
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        // API_URL에서 http:// 또는 https:// 부분을 제거하고 호스트만 추출
        const host = API_URL.replace(/^https?:\/\//, '');
        const wsUrl = `${wsProtocol}//${host}/api/v1/chat/ws/${currentRoomId}/${currentUserId}`;

        console.log("🔗 Connecting to:", wsUrl); // 터미널 콘솔(F12)에서 주소 확인용
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => console.log("✅ 웹소켓 서버에 연결되었습니다.");
        
        // 상대방이 메시지를 보내거나, 내가 보낸 메시지가 서버를 거쳐 돌아올 때
        ws.onmessage = (event) => {
          if (isMounted) {
            const newMsg = JSON.parse(event.data);
            setMessages((prev) => [...prev, newMsg]);
          }
        };

        ws.onerror = (error) => console.error("❌ 웹소켓 에러:", error);
        ws.onclose = () => console.log("ℹ️ 웹소켓 연결이 종료되었습니다.");

      } catch (error) {
        console.error("채팅 설정 중 오류 발생:", error);
      }
    };

    setupChat();

    return () => {
      isMounted = false;
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [isOpen, targetUser, currentUserId]);

  // 메시지 업데이트 시 스크롤 하단 고정
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 메시지 전송
  const sendMessage = (e) => {
    e.preventDefault();
    if (!inputMessage.trim() || !wsRef.current) return;

    // 소켓이 열려있는지 확인 후 전송
    if (wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(inputMessage);
      setInputMessage(''); 
    } else {
      alert("서버와 연결이 끊어졌습니다. 잠시 후 다시 시도해주세요.");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay active" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="auth-modal-content" style={{ 
        maxWidth: '400px', 
        height: '600px', 
        display: 'flex', 
        flexDirection: 'column', 
        padding: 0, 
        overflow: 'hidden',
        borderRadius: '12px'
      }}>
        
        {/* 상단 헤더 */}
        <div style={{ 
          padding: '15px', 
          borderBottom: '1px solid #ddd', 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          backgroundColor: '#f9f9f9' 
        }}>
          <div style={{ fontWeight: 'bold', fontSize: '16px' }}>{targetUser.nickname}님</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#666' }}>&times;</button>
        </div>

        {/* 대화창 영역 */}
        <div style={{ 
          flex: 1, 
          padding: '15px', 
          overflowY: 'auto', 
          backgroundColor: '#fff', 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '12px' 
        }}>
          {messages.map((msg, idx) => {
            const isMe = String(msg.sender_id) === String(currentUserId);
            return (
              <div key={idx} style={{ alignSelf: isMe ? 'flex-end' : 'flex-start', maxWidth: '75%' }}>
                <div style={{
                  padding: '10px 14px',
                  borderRadius: isMe ? '16px 16px 0 16px' : '16px 16px 16px 0',
                  backgroundColor: isMe ? 'var(--rust)' : '#f0f0f0',
                  color: isMe ? '#fff' : '#333',
                  fontSize: '14px',
                  lineHeight: '1.5',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                }}>
                  {msg.content}
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* 하단 입력바 */}
        <form onSubmit={sendMessage} style={{ 
          padding: '15px', 
          borderTop: '1px solid #eee', 
          display: 'flex', 
          gap: '10px', 
          backgroundColor: '#fff' 
        }}>
          <input 
            type="text" 
            value={inputMessage} 
            onChange={(e) => setInputMessage(e.target.value)} 
            placeholder="메시지 보내기..." 
            style={{ 
              flex: 1, 
              padding: '12px 18px', 
              borderRadius: '24px', 
              border: '1px solid #ddd', 
              outline: 'none',
              fontSize: '14px'
            }}
          />
          <button 
            type="submit" 
            disabled={!inputMessage.trim()}
            style={{ 
              padding: '10px 18px', 
              borderRadius: '24px', 
              backgroundColor: inputMessage.trim() ? 'var(--rust)' : '#ccc', 
              color: 'white', 
              border: 'none', 
              cursor: 'pointer', 
              fontWeight: 'bold',
              transition: 'all 0.2s'
            }}
          >
            전송
          </button>
        </form>
      </div>
    </div>
  );
}