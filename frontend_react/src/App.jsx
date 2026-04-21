import React from 'react';
import { AuthProvider } from './context/Authcontext';
import { NotificationProvider } from './context/NotificationContext'; 
import CommunityPage from './pages/Communitypage';

export default function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        {/* 하단 바는 지우고 원래대로 커뮤니티 페이지만 부릅니다 */}
        <CommunityPage />
      </NotificationProvider>
    </AuthProvider>
  );
}