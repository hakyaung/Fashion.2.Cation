import React, { createContext, useContext, useState, useCallback } from 'react';
import { loginApi, registerApi, getCurrentUserId, getToken } from '../api/api';

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