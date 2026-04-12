import React from 'react';

export default function MobileNav({ onNavigate, onSort, onNearby, onOpenPost }) {
  return (
    <nav className="mobile-nav">
      <button onClick={() => onNavigate('home')}>
        <span>⌂</span>홈
      </button>
      <button onClick={() => onSort('popular')}>
        <span>⟡</span>인기
      </button>
      <button className="post-btn" onClick={onOpenPost}>+</button>
      <button onClick={onNearby}>
        <span>⚑</span>주변
      </button>
      <button onClick={() => onNavigate('profile')}>
        <span>☺</span>나
      </button>
    </nav>
  );
}