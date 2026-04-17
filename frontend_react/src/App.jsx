import React from 'react';
import { AuthProvider } from './context/Authcontext';
import { NotificationProvider } from './context/NotificationContext'; // 💡 알림 컨텍스트 불러오기
import CommunityPage from './pages/Communitypage';

export default function App() {
  return (
    <AuthProvider>
      {/* 💡 앱 전체에서 알림 기능을 쓸 수 있도록 감싸줍니다 */}
      <NotificationProvider>
        <CommunityPage />
      </NotificationProvider>
    </AuthProvider>
  );
}