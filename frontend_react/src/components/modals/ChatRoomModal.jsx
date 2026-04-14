import React, { useState, useEffect, useRef } from 'react';
// 💡 markChatAsRead 함수를 추가로 import 합니다.
import { API_URL, getOrCreateChatRoom, fetchChatHistory, markChatAsRead } from '../../api/api';

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

        // 1. 기존 채팅 내역 불러오기
        const history = await fetchChatHistory(currentRoomId);
        if (isMounted) setMessages(history);

        // 💡 2. 채팅방에 들어왔으므로 지금까지 쌓인 메시지를 모두 '읽음' 처리합니다.
        await markChatAsRead(currentRoomId, currentUserId);

        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = API_URL.replace(/^https?:\/\//, '');
        const wsUrl = `${wsProtocol}//${host}/api/v1/chat/ws/${currentRoomId}/${currentUserId}`;

        console.log("🔗 Connecting to:", wsUrl);
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => console.log("✅ 웹소켓 서버에 연결되었습니다.");
        
        ws.onmessage = (event) => {
          if (isMounted) {
            const data = JSON.parse(event.data);
            
            // 💡 [핵심] 신호 종류에 따른 실시간 읽음 처리
            if (data.type === 'read_receipt') {
              // 상대방이 내 메시지를 읽었다는 신호가 오면, 내 화면의 모든 '안 읽음'을 '읽음'으로 변경
              if (String(data.reader_id) !== String(currentUserId)) {
                setMessages((prev) => prev.map(m => ({ ...m, is_read: true })));
              }
            } else {
              // 일반 메시지가 온 경우 (새 메시지 수신)
              setMessages((prev) => [...prev, data]);
              
              // 내가 지금 채팅방을 켜놓고 보고 있는데 상대가 메시지를 보냈다면, 즉시 읽음 처리 API를 호출
              if (String(data.sender_id) !== String(currentUserId)) {
                markChatAsRead(currentRoomId, currentUserId);
              }
            }
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
      <div id="chat-room-modal-content" className="auth-modal-content" style={{ 
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
              // 💡 말풍선과 읽음 표시를 나란히 배치하기 위한 구조 수정
              <div key={idx} style={{ 
                display: 'flex', 
                justifyContent: isMe ? 'flex-end' : 'flex-start' 
              }}>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'flex-end', 
                  gap: '6px', 
                  maxWidth: '75%' 
                }}>
                  
                  {/* 💡 내가 보낸 메시지인 경우 말풍선 왼쪽에 '읽음/안 읽음' 표시 */}
                  {isMe && (
                    <span style={{ 
                      fontSize: '11px', 
                      color: msg.is_read ? '#999' : 'var(--rust)', 
                      whiteSpace: 'nowrap',
                      fontWeight: msg.is_read ? 'normal' : 'bold',
                      marginBottom: '2px'
                    }}>
                      {msg.is_read ? '읽음' : '안 읽음'}
                    </span>
                  )}

                  {/* 말풍선 본체 */}
                  <div style={{
                    padding: '10px 14px',
                    borderRadius: isMe ? '16px 16px 0 16px' : '16px 16px 16px 0',
                    backgroundColor: isMe ? 'var(--rust)' : '#f0f0f0',
                    color: isMe ? '#fff' : '#333',
                    fontSize: '14px',
                    lineHeight: '1.5',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                    wordBreak: 'break-word'
                  }}>
                    {msg.content}
                  </div>

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