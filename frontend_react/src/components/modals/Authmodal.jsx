import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/Authcontext';

export default function AuthModal() {
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
        alert('로그인 성공!');
        closeAuthModal();
      } catch (err) {
        setError(err.message);
      }
    } else {
      try {
        await register(email, nickname, password);
        alert('회원가입 성공! 이제 로그인해주세요.');
        setAuthMode('login');
        setPassword('');
      } catch (err) {
        setError(err.message);
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
        <button className="modal-close" onClick={closeAuthModal}>&times;</button>

        <h3
          style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: 28,
            marginBottom: 10,
            color: 'var(--warm-black)',
          }}
        >
          {isLogin ? 'Login' : 'Register'}
        </h3>
        <p style={{ fontSize: 12, color: '#666', marginBottom: 24 }}>
          Fashion.2.Cation 커뮤니티에 합류하세요.
        </p>

        {error && (
          <p style={{ color: 'var(--rust)', fontSize: 13, marginBottom: 12 }}>{error}</p>
        )}

        <form className="auth-form" onSubmit={handleSubmit}>
          {!isLogin && (
            <input
              type="text"
              placeholder="닉네임"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              required
            />
          )}
          <input
            type="email"
            placeholder="이메일"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="비밀번호"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button type="submit">{isLogin ? '로그인 ✦' : '회원가입 ✦'}</button>
        </form>

        <div className="auth-toggle">
          <span>{isLogin ? '계정이 없으신가요? ' : '이미 계정이 있으신가요? '}</span>
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              setAuthMode(isLogin ? 'register' : 'login');
              setError('');
            }}
          >
            {isLogin ? '회원가입' : '로그인'}
          </a>
        </div>
      </div>
    </div>
  );
}