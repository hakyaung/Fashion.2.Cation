import React from 'react';

export default function MobileNav({ onNavigate, onSort, onNearby, onOpenPost }) {
  return (
    <nav className="mobile-nav">
      {/* 1. 홈 */}
      <button type="button" onClick={() => onNavigate('home')}>
        <span>⌂</span>홈
      </button>

      {/* 2. 메시지 */}
      <button type="button" onClick={() => onNavigate('messages')}>
        <span>✉</span>메시지
      </button>

      {/* 💡 3. 패션 평가 (새로 추가됨) */}
      <button type="button" onClick={() => onNavigate('fashion-eval')}>
        <span>◇</span>패션평가
      </button>

      {/* 4. POST (가운데 정렬된 + 버튼) */}
      <button type="button" className="post-btn-inline" onClick={onOpenPost}>
        <span className="plus-icon">+</span>POST
      </button>

      {/* 5. 주변 */}
      <button type="button" onClick={onNearby}>
        <span>⚑</span>주변
      </button>

      {/* 6. 프로필(나) */}
      <button type="button" onClick={() => onNavigate('profile')}>
        <span>☺</span>나
      </button>
    </nav>
  );
}