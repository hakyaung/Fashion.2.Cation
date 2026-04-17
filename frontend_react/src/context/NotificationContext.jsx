import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './Authcontext'; // 💡 1. 현재 로그인한 유저 정보를 가져오기 위해 추가!

const NotificationContext = createContext();
export const useNotification = () => useContext(NotificationContext);

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);
  const { currentUserId } = useAuth(); // 💡 2. 현재 로그인한 유저 ID 가져오기

  useEffect(() => {
    // 💡 사이트 접속 시 핸드폰/PC 자체 푸시 알림 권한을 요청합니다.
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  // 🔔 알림을 띄우는 마법의 함수
  const showNotification = (title, body) => {
    // 1. 웹/모바일 화면 내부에 인스타그램 스타일 토스트 띄우기
    const id = Date.now();
    setNotifications((prev) => [...prev, { id, title, body }]);

    // 3초 뒤에 토스트 알림 스르륵 사라지게 하기
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, 3000);

    // 2. 브라우저를 내리고 있어도 핸드폰/PC에 진짜 푸시 알림 쏘기
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(title, { body });
    }
  };

  // ==========================================
  // 🔌 3. [핵심] 로그인 시 백엔드 무전기(WebSocket)와 연결하기!
  // ==========================================
  useEffect(() => {
    // 로그인하지 않았으면 무전기를 켜지 않고 대기합니다.
    if (!currentUserId) return; 

    // 채팅과 똑같이 localhost로 주소를 맞춰줍니다!
    const ws = new WebSocket(`ws://localhost:8000/ws/${currentUserId}`);

    // 백엔드에서 신호가 날아오면 낚아채서 화면에 띄우기
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      showNotification(data.title, data.body); 
    };

    // 혹시 연결에 문제가 생기면 콘솔에 표시
    ws.onerror = (error) => {
      console.error("WebSocket 통신 에러:", error);
    };

    // 창을 닫거나 로그아웃하면 무전기 전원 끄기 (메모리 낭비 방지)
    return () => {
      ws.close(); 
    };
  }, [currentUserId]);

  // 🧪 당장 테스트해 보기 위한 임시 스위치 (나중에 백엔드 연결 후 지울 예정)
  window.testAlert = () => showNotification("새로운 알림 ❤️", "하경님의 게시물에 좋아요가 달렸습니다!");

  return (
    <NotificationContext.Provider value={{ showNotification }}>
      {children}

      {/* 🎨 알림(토스트)이 화면에 그려지는 영역 */}
      <div className="toast-container">
        {notifications.map((n) => (
          <div key={n.id} className="toast">
            <strong>{n.title}</strong>
            <p>{n.body}</p>
          </div>
        ))}
      </div>
    </NotificationContext.Provider>
  );
};