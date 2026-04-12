import React from 'react';
import { useAuth } from '../../context/Authcontext';

export default function TopNav({ searchKeyword, onSearchChange }) {
  const { isLoggedIn, logout, openAuthModal } = useAuth();

  const handleLoginClick = (e) => {
    e.preventDefault();
    if (isLoggedIn) {
      if (window.confirm('로그아웃 하시겠습니까?')) {
        logout();
      }
    } else {
      openAuthModal('login');
    }
  };

  return (
    <nav className="top-nav">
      <div className="nav-left">
        <a href="../index.html" className="nav-logo">Fashion.2.Cation</a>
      </div>
      <div className="nav-center">
        <div className="search-bar">
          <input
            type="text"
            placeholder="관심 있는 스타일이나 키워드를 검색해보세요 (예: 오버핏, 스트릿)"
            value={searchKeyword}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
      </div>
      <div className="nav-right">
        <button className="btn-login" onClick={handleLoginClick}>
          {isLoggedIn ? '로그아웃' : '로그인'}
        </button>
      </div>
    </nav>
  );
}