import React from 'react';

export default function LeftSidebar({ activeView, activeSort, onNavigate, onSort, onNearby, onTagSearch }) {
  return (
    <aside className="left-sidebar">
      <ul className="sidebar-menu">
        <li className="menu-title">메인</li>
        <li>
          <a
            href="#"
            className={activeView === 'home' ? 'active' : ''}
            onClick={(e) => { e.preventDefault(); onNavigate('home'); }}
          >
            <span>⌂</span> 홈
          </a>
        </li>
        <li>
          <a
            href="#"
            className={activeView === 'profile' ? 'active' : ''}
            onClick={(e) => { e.preventDefault(); onNavigate('profile'); }}
          >
            <span>☺</span> 프로필
          </a>
        </li>
        <li>
            <a
                href="#"
                className={activeView === 'messages' ? 'active' : ''}
                onClick={(e) => { e.preventDefault(); onNavigate('messages'); }}
            >
                <span>✉</span> 메시지
            </a>
        </li>

        <li className="menu-title" style={{ marginTop: 30 }}>피드 필터</li>
        <li>
          <a
            href="#"
            className={activeSort === 'latest' ? 'active' : ''}
            onClick={(e) => { e.preventDefault(); onSort('latest'); }}
          >
            <span>✦</span> 최신 스타일
          </a>
        </li>
        <li>
          <a
            href="#"
            className={activeSort === 'popular' ? 'active' : ''}
            onClick={(e) => { e.preventDefault(); onSort('popular'); }}
          >
            <span>⟡</span> 인기 트렌드
          </a>
        </li>
        <li>
          <a
            href="#"
            className={activeSort === 'nearby' ? 'active' : ''}
            onClick={(e) => { e.preventDefault(); onNearby(); }}
          >
            <span>⚑</span> 내 주변 지역
          </a>
        </li>

        <li className="menu-title" style={{ marginTop: 30 }}>토픽</li>
        <li>
          <a href="#" className="topic-tag" onClick={(e) => { e.preventDefault(); onTagSearch('불당동'); }}>
            #불당동
          </a>
        </li>
        <li>
          <a href="#" className="topic-tag" onClick={(e) => { e.preventDefault(); onTagSearch('신부동'); }}>
            #신부동
          </a>
        </li>
        <li>
          <a href="#" className="topic-tag" onClick={(e) => { e.preventDefault(); onTagSearch('미니멀룩'); }}>
            #미니멀룩
          </a>
        </li>
      </ul>
    </aside>
  );
}