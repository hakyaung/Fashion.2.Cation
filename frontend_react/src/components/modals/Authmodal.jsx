import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next'; // 💡 다국어 훅 추가
import { useAuth } from '../../context/Authcontext';
import { formatApiError } from '../../utils/formatApiError'; // 💡 에러 포매터 추가

export default function AuthModal() {
  const { t } = useTranslation(); // 💡 번역 함수 가져오기
  const { authModalOpen, authMode, setAuthMode, closeAuthModal, login, register } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState('');

  const isLogin = authMode === 'login';

  // 모달 열릴 때 폼 초기화
  useEffect(() => {
    if (authModalOpen) {
      setEmail('');
      setPassword('');
      setNickname('');
      setError('');
    }
  }, [authModalOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (isLogin) {
      try {
        await login(email, password);
        alert(t('auth.loginSuccess')); // 💡 다국어 적용
        closeAuthModal();
      } catch (err) {
        setError(formatApiError(t, err)); // 💡 에러 포매터 적용
      }
    } else {
      try {
        await register(email, nickname, password);
        alert(t('auth.registerSuccess')); // 💡 다국어 적용
        setAuthMode('login');
        setPassword('');
      } catch (err) {
        setError(formatApiError(t, err)); // 💡 에러 포매터 적용
      }
    }
  };

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) closeAuthModal();
  };

  return (
    <div
      className={`modal-overlay${authModalOpen ? ' active' : ''}`}
      id="authModal"
      onClick={handleOverlayClick}
    >
      <div className="auth-modal-content">
        <button type="button" className="modal-close" onClick={closeAuthModal}>
          &times;
        </button>

        <h3
          style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: 28,
            marginBottom: 10,
            color: 'var(--warm-black)',
          }}
        >
          {isLogin ? t('auth.loginTitle') : t('auth.registerTitle')}
        </h3>
        <p style={{ fontSize: 12, color: '#666', marginBottom: 24 }}>
          {t('auth.tagline')}
        </p>

        {error && (
          <p style={{ color: 'var(--rust)', fontSize: 13, marginBottom: 12 }}>{error}</p>
        )}

        <form className="auth-form" onSubmit={handleSubmit}>
          {!isLogin && (
            <input
              type="text"
              placeholder={t('auth.nickPh')}
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              required
            />
          )}
          <input
            type="email"
            placeholder={t('auth.emailPh')}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder={t('auth.passPh')}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button type="submit">
            {isLogin ? t('auth.loginBtn') : t('auth.registerBtn')}
          </button>
        </form>

        <div className="auth-toggle">
          <span>{isLogin ? t('auth.toggleNoAccount') : t('auth.toggleHasAccount')}</span>
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              setAuthMode(isLogin ? 'register' : 'login');
              setError('');
            }}
          >
            {isLogin ? t('auth.registerLink') : t('auth.loginLink')}
          </a>
        </div>
      </div>
    </div>
  );
}