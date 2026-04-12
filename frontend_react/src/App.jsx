import React from 'react';
import { AuthProvider } from './context/Authcontext';
import CommunityPage from './pages/Communitypage';

export default function App() {
  return (
    <AuthProvider>
      <CommunityPage />
    </AuthProvider>
  );
}