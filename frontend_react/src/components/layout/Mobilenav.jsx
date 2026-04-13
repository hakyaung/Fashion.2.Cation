import React from 'react';

export default function MobileNav({ onNavigate, onSort, onNearby, onOpenPost }) {
  return (
    <nav className="mobile-nav">
      {/* 1. 홈 */}
      <button onClick={() => onNavigate('home')}>
        <span>⌂</span>홈
      </button>

      {/* 2. 메시지 (새로 추가) */}
      <button onClick={() => onNavigate('messages')}>
        <span>✉</span>메시지
      </button>

      {/* 3. POST (가운데 정렬된 + 버튼) */}
      <button className="post-btn-inline" onClick={onOpenPost}>
        <span className="plus-icon">+</span>POST
      </button>

      {/* 4. 주변 */}
      <button onClick={onNearby}>
        <span>⚑</span>주변
      </button>

      {/* 5. 프로필(나) */}
      <button onClick={() => onNavigate('profile')}>
        <span>☺</span>나
      </button>
    </nav>
  );
}