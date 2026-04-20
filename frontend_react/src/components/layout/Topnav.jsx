import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next'; // 💡 다국어 훅 추가
import { useAuth } from '../../context/Authcontext';
import { searchUsersApi, API_URL } from '../../api/api';

// 💡 언어 코드 정규화 헬퍼 함수
function normalizeLang(lng) {
  if (!lng) return 'ko';
  const b = lng.split('-')[0];
  if (b === 'zh') return 'zh';
  return ['ko', 'en', 'ja', 'zh'].includes(b) ? b : 'ko';
}

export default function TopNav({ searchKeyword, onSearchChange, onUserSelect }) {
  const { t, i18n } = useTranslation(); // 💡 번역 함수 및 언어 객체 가져오기
  const { isLoggedIn, logout, openAuthModal } = useAuth();

  // 💡 유저 검색용 상태
  const [userResults, setUserResults] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);

  // 💡 '@' 감지 및 API 호출 로직 (기존 기능 유지)
  useEffect(() => {
    const fetchUsers = async () => {
      // 검색어에 @가 포함되어 있으면 유저 검색 모드 발동!
      if (searchKeyword.includes('@')) {
        const query = searchKeyword.split('@')[1]; // @ 뒤의 글자만 추출
        if (query.trim().length > 0) {
          try {
            const results = await searchUsersApi(query);
            setUserResults(results);
            setShowDropdown(true);
          } catch (e) {
            console.error('User search error:', e);
          }
        } else {
          setUserResults([]);
          setShowDropdown(false);
        }
      } else {
        // @가 없으면 일반 키워드 검색이므로 드롭다운 숨김
        setShowDropdown(false);
      }
    };

    // 타자 칠 때마다 API를 무한 호출하지 않도록 살짝 딜레이(디바운스)
    const timeoutId = setTimeout(fetchUsers, 300);
    return () => clearTimeout(timeoutId);
  }, [searchKeyword]);

  const handleLoginClick = useCallback(
    (e) => {
      e.preventDefault();
      if (isLoggedIn) {
        if (window.confirm(t('nav.logoutConfirm'))) { // 💡 다국어 적용
          logout();
        }
      } else {
        openAuthModal('login');
      }
    },
    [isLoggedIn, logout, openAuthModal, t]
  );

  // 💡 드롭다운에서 유저를 클릭했을 때 (기존 기능 유지)
  const handleUserClick = (userId) => {
    onSearchChange(''); // 검색창 비우기
    setShowDropdown(false); // 드롭다운 닫기
    if (onUserSelect) onUserSelect(userId); // 선택한 유저 전달
  };

  const getFullImageUrl = (url) => {
    if (!url) return 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=100';
    return url.startsWith('http') ? url : `${API_URL}${url}`;
  };

  const langValue = normalizeLang(i18n.resolvedLanguage || i18n.language);

  return (
    <nav className="top-nav">
      <div className="nav-left">
        <a href="/" className="nav-logo" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
          Fashion.2.Cation
        </a>
      </div>
      <div className="nav-center">
        {/* 💡 position: 'relative' 추가하여 드롭다운 기준점 설정 */}
        <div className="search-bar" style={{ position: 'relative' }}>
          <input
            type="text"
            placeholder={t('nav.searchPlaceholder')} // 💡 다국어 적용
            value={searchKeyword}
            onChange={(e) => onSearchChange(e.target.value)}
          />

          {/* 💡 유저 검색 결과 드롭다운 (기존 스타일 및 기능 유지) */}
          {showDropdown && userResults.length > 0 && (
            <div
              style={{
                position: 'absolute',
                top: '110%',
                left: 0,
                right: 0,
                backgroundColor: '#fff',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                zIndex: 1000,
                maxHeight: '300px',
                overflowY: 'auto',
              }}
            >
              {userResults.map((u) => (
                <div
                  key={u.id}
                  onClick={() => handleUserClick(u.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '12px',
                    borderBottom: '1px solid #f0f0f0',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s',
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.backgroundColor = '#f9f9f9';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.backgroundColor = '#fff';
                  }}
                >
                  <img
                    src={getFullImageUrl(u.profile_image_url)}
                    alt="profile"
                    style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover', marginRight: '12px' }}
                  />
                  <div>
                    <div style={{ fontWeight: 'bold', fontSize: '14px', color: '#333' }}>{u.nickname}</div>
                    <div style={{ fontSize: '12px', color: '#888' }}>{u.email}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="nav-right" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* 💡 추가된 언어 선택기 UI */}
        <label style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }} htmlFor="f2c-lang">
          {t('nav.langLabel')}
        </label>
        <select
          id="f2c-lang"
          className="lang-select"
          value={langValue}
          onChange={(e) => i18n.changeLanguage(e.target.value)}
          style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 12,
            padding: '6px 8px',
            borderRadius: 8,
            border: '1px solid var(--border-color)',
            background: 'var(--off-white)',
            color: 'var(--warm-black)',
            cursor: 'pointer',
          }}
        >
          <option value="ko">한국어</option>
          <option value="en">English</option>
          <option value="ja">日本語</option>
          <option value="zh">中文</option>
        </select>
        <button type="button" className="btn-login" onClick={handleLoginClick}>
          {isLoggedIn ? t('nav.logout') : t('nav.login')}
        </button>
      </div>
    </nav>
  );
}