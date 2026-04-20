import React, { createContext, useContext, useState, useCallback } from 'react';
// 💡 firebaseLoginSyncApi 임포트 추가
import { loginApi, registerApi, getCurrentUserId, firebaseLoginSyncApi } from '../api/api';
// 💡 파이어베이스 인증 관련 모듈 임포트
import { auth, googleProvider } from '../firebase';
import { signInWithPopup } from 'firebase/auth';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('stylescape_token'));
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState('login'); // 'login' | 'register'

  const isLoggedIn = Boolean(token);
  const currentUserId = isLoggedIn ? getCurrentUserId() : null;

  const login = useCallback(async (email, password) => {
    const data = await loginApi(email, password);
    localStorage.setItem('stylescape_token', data.access_token);
    setToken(data.access_token);
  }, []);

  const register = useCallback(async (email, nickname, password) => {
    await registerApi(email, nickname, password);
  }, []);

  // 💡 구글 소셜 로그인 함수 추가
  const loginWithGoogle = useCallback(async () => {
    try {
      // 1. Firebase 구글 팝업 띄우기
      const result = await signInWithPopup(auth, googleProvider);
      
      // 2. Firebase ID 토큰 가져오기
      const idToken = await result.user.getIdToken();
      
      // 3. 백엔드로 토큰 보내서 우리 서버 전용 JWT로 교환받기
      const data = await firebaseLoginSyncApi(idToken);
      
      // 4. 로컬 스토리지에 저장하고 로그인 처리
      localStorage.setItem('stylescape_token', data.access_token);
      setToken(data.access_token);
      return true;
    } catch (error) {
      console.error("구글 로그인 에러:", error);
      throw error;
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('stylescape_token');
    setToken(null);
  }, []);

  const openAuthModal = useCallback((mode = 'login') => {
    setAuthMode(mode);
    setAuthModalOpen(true);
  }, []);

  const closeAuthModal = useCallback(() => {
    setAuthModalOpen(false);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        token,
        isLoggedIn,
        currentUserId,
        login,
        register,
        loginWithGoogle, // 💡 프로바이더에 구글 로그인 함수 추가
        logout,
        authModalOpen,
        authMode,
        setAuthMode,
        openAuthModal,
        closeAuthModal,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}