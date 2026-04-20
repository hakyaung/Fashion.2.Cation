import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next'; 
import { useAuth } from '../../context/Authcontext';
import { formatApiError } from '../../utils/formatApiError'; 

export default function AuthModal() {
  const { t } = useTranslation(); 
  // 💡 loginWithGoogle을 AuthContext에서 추가로 꺼내옵니다.
  const { authModalOpen, authMode, setAuthMode, closeAuthModal, login, register, loginWithGoogle } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState('');

  const isLogin = authMode === 'login';

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
        alert(t('auth.loginSuccess')); 
        closeAuthModal();
      } catch (err) {
        setError(formatApiError(t, err)); 
      }
    } else {
      try {
        await register(email, nickname, password);
        alert(t('auth.registerSuccess')); 
        setAuthMode('login');
        setPassword('');
      } catch (err) {
        setError(formatApiError(t, err)); 
      }
    }
  };

  // 💡 구글 소셜 로그인 버튼 클릭 핸들러
  const handleGoogleLogin = async () => {
    try {
      await loginWithGoogle();
      alert('구글 계정으로 로그인되었습니다! ✨');
      closeAuthModal();
    } catch (err) {
      setError('구글 로그인을 완료하지 못했습니다.');
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

        {/* 💡 구글 로그인 구분선 (OR) 및 버튼 추가 영역 시작 */}
        <div style={{ display: 'flex', alignItems: 'center', margin: '20px 0' }}>
          <div style={{ flex: 1, height: '1px', backgroundColor: '#ddd' }}></div>
          <span style={{ margin: '0 10px', fontSize: '12px', color: '#888' }}>OR</span>
          <div style={{ flex: 1, height: '1px', backgroundColor: '#ddd' }}></div>
        </div>

        <button 
          type="button" 
          onClick={handleGoogleLogin}
          style={{
            width: '100%',
            padding: '12px',
            backgroundColor: '#fff',
            color: '#333',
            border: '1px solid #ddd',
            borderRadius: '4px',
            cursor: 'pointer',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '8px',
            fontWeight: 'bold',
            marginBottom: '15px'
          }}
        >
          {/* 구글 로고 아이콘 */}
          <img 
            src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" 
            alt="Google" 
            style={{ width: '18px' }}
          />
          Continue with Google
        </button>
        {/* 💡 구글 로그인 영역 끝 */}

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