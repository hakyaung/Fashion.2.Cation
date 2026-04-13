import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/Authcontext';
import { searchUsersApi, API_URL } from '../../api/api'; // 💡 API 불러오기 추가

export default function TopNav({ searchKeyword, onSearchChange, onUserSelect }) {
  const { isLoggedIn, logout, openAuthModal } = useAuth();
  
  // 💡 유저 검색용 상태 추가
  const [userResults, setUserResults] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);

  // 💡 '@' 감지 및 API 호출 로직
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
            console.error("유저 검색 에러:", e);
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

  // 💡 드롭다운에서 유저를 클릭했을 때
  const handleUserClick = (userId) => {
    onSearchChange(''); // 검색창 비우기
    setShowDropdown(false); // 드롭다운 닫기
    if (onUserSelect) onUserSelect(userId); // Communitypage.jsx 로 선택한 유저 ID 전달
  };

  const getFullImageUrl = (url) => {
    if (!url) return "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=100";
    return url.startsWith('http') ? url : `${API_URL}${url}`;
  };

  return (
    <nav className="top-nav">
      <div className="nav-left">
        <a href="../index.html" className="nav-logo">Fashion.2.Cation</a>
      </div>
      <div className="nav-center">
        {/* 💡 position: 'relative' 추가하여 드롭다운 기준점 설정 */}
        <div className="search-bar" style={{ position: 'relative' }}>
          <input
            type="text"
            placeholder="키워드 검색 또는 '@'로 유저 검색"
            value={searchKeyword}
            onChange={(e) => onSearchChange(e.target.value)}
          />
          
          {/* 💡 유저 검색 결과 드롭다운 */}
          {showDropdown && userResults.length > 0 && (
            <div style={{
              position: 'absolute',
              top: '110%', left: 0, right: 0,
              backgroundColor: '#fff',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              zIndex: 1000,
              maxHeight: '300px',
              overflowY: 'auto'
            }}>
              {userResults.map((u) => (
                <div 
                  key={u.id} 
                  onClick={() => handleUserClick(u.id)}
                  style={{ 
                    display: 'flex', alignItems: 'center', padding: '12px', 
                    borderBottom: '1px solid #f0f0f0', cursor: 'pointer',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f9f9f9'}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#fff'}
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
      <div className="nav-right">
        <button className="btn-login" onClick={handleLoginClick}>
          {isLoggedIn ? '로그아웃' : '로그인'}
        </button>
      </div>
    </nav>
  );
}