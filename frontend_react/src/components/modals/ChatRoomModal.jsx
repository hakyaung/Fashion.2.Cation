// frontend_react/src/components/modals/ChatRoomModal.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next'; 
import { API_URL, getOrCreateChatRoom, fetchChatHistory, markChatAsRead } from '../../api/api';
import TranslatableText from '../common/TranslatableText'; 

export default function ChatRoomModal({ isOpen, onClose, currentUserId, targetUser }) {
  const { t } = useTranslation(); 
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
        
        // 🚀 [추가] DB 업데이트로 인해 순서가 뒤틀리는 현상을 막기 위한 프론트엔드 강제 정렬 로직
        const sortedHistory = history.sort((a, b) => {
          // id가 있으면 id 순서대로, 없으면 시간 순서대로 안전하게 정렬합니다.
          return (a.id && b.id) ? a.id - b.id : new Date(a.created_at) - new Date(b.created_at);
        });

        if (isMounted) setMessages(sortedHistory);

        // 2. 채팅방 진입 시 읽음 처리
        await markChatAsRead(currentRoomId, currentUserId);

        const isLocal = window.location.hostname === 'localhost';
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = isLocal ? 'localhost:8000' : window.location.host; 
        
        const wsUrl = `${wsProtocol}//${host}/api/v1/chat/ws/${currentRoomId}/${currentUserId}`;

        console.log("🔗 Connecting to:", wsUrl);

        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => console.log("✅ 웹소켓 서버에 연결되었습니다.");
        
        ws.onmessage = (event) => {
          if (isMounted) {
            const data = JSON.parse(event.data);
            
            // 💡 백엔드가 JSON 시스템 신호를 구별하지 못하므로, 무조건 새 메시지로 처리
            setMessages((prev) => [...prev, data]);
            
            // 내가 채팅방을 보고 있을 때 새 메시지가 오면 즉시 DB 읽음 처리
            if (String(data.sender_id) !== String(currentUserId)) {
              markChatAsRead(currentRoomId, currentUserId);
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

  // ==========================================
  // 🚀 [수정] 닌자 동기화 (F5 없이 자동 읽음 처리 & 순서 꼬임 완벽 방어)
  // ==========================================
  useEffect(() => {
    if (!roomId || !isOpen) return;

    const syncInterval = setInterval(async () => {
      try {
        const history = await fetchChatHistory(roomId);
        
        // 🚀 [추가] 백그라운드에서 가져온 데이터도 무조건 시간순/ID순으로 재정렬
        const sortedHistory = history.sort((a, b) => {
          return (a.id && b.id) ? a.id - b.id : new Date(a.created_at) - new Date(b.created_at);
        });
        
        setMessages((prev) => {
          // 상태가 이전과 완전히 동일하면 업데이트하지 않음 (스크롤 튀는 현상 방지)
          if (JSON.stringify(prev) === JSON.stringify(sortedHistory)) {
            return prev;
          }
          return sortedHistory;
        });
      } catch (error) {
        console.error("채팅 동기화 실패 (조용히 무시)", error);
      }
    }, 2000); 

    return () => clearInterval(syncInterval);
  }, [roomId, isOpen]);
  // ==========================================

  // 메시지 업데이트 시 스크롤 하단 고정
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 메시지 전송
  const sendMessage = (e) => {
    e.preventDefault();
    if (!inputMessage.trim() || !wsRef.current) return;

    if (wsRef.current.readyState === WebSocket.OPEN) {
      // 💡 백엔드 DB 오염을 막기 위해 JSON이 아닌 순수 텍스트만 보냅니다.
      wsRef.current.send(inputMessage);
      setInputMessage(''); 
    } else {
      alert(t('chat.disconnect')); 
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
          <div style={{ fontWeight: 'bold', fontSize: '16px' }}>
            {t('chat.headerName', { name: targetUser.nickname })}
          </div>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#666' }}>&times;</button>
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
                  
                  {isMe && (
                    <span style={{ 
                      fontSize: '11px', 
                      color: msg.is_read ? '#999' : 'var(--rust)', 
                      whiteSpace: 'nowrap',
                      fontWeight: msg.is_read ? 'normal' : 'bold',
                      marginBottom: '2px'
                    }}>
                      {msg.is_read ? t('chat.read') : t('chat.unread')}
                    </span>
                  )}

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
                    <TranslatableText text={msg.content} compact invert={isMe} />
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
            placeholder={t('chat.placeholder')} 
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
            {t('chat.send')} 
          </button>
        </form>
      </div>
    </div>
  );
}