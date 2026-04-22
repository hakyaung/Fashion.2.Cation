// frontend_react/src/components/layout/Mobilenav.jsx
import React from 'react';
import { useTranslation } from 'react-i18next';

export default function MobileNav({ onNavigate, onSort, onNearby, onOpenPost, currentSort }) {
  const { t } = useTranslation();

  return (
    <nav className="mobile-nav">
      
      {/* 💡 1. 홈 ↔ AI 추천 스위치 버튼 */}
      {currentSort === 'recommend' ? (
        // 현재 추천 피드를 보고 있다면 -> [🏠 일반 홈]으로 가는 버튼 표시
        <button type="button" onClick={() => onSort('latest')} style={{ color: 'var(--rust)' }}>
          <span style={{ fontSize: '20px', fontWeight: 'bold' }}>🏠</span>
          {t('mobileNav.home', '홈')}
        </button>
      ) : (
        // 현재 일반 홈을 보고 있다면 -> [🤖 AI 추천]으로 가는 버튼 표시
        <button type="button" onClick={() => onSort('recommend')}>
          <span style={{ fontSize: '20px' }}>🤖</span>
          {t('mobileNav.aiRecommend', '추천')}
        </button>
      )}

      {/* 2. 메시지 */}
      <button type="button" onClick={() => onNavigate('messages')}>
        <span>✉</span>
        {t('mobileNav.messages')}
      </button>

      {/* 3. 패션 평가 */}
      <button type="button" onClick={() => onNavigate('fashion-eval')}>
        <span>◇</span>
        {t('mobileNav.fashionEval')}
      </button>

      {/* 4. POST (가운데 정렬된 + 버튼) */}
      <button type="button" className="post-btn-inline" onClick={onOpenPost}>
        <span className="plus-icon">+</span>
        {t('mobileNav.post')}
      </button>

      {/* 🎬 5. 스냅 */}
      <button type="button" onClick={() => onNavigate('snap')}>
        <span>🎬</span>
        {t('mobileNav.snap', '스냅')}
      </button>

      {/* 6. 프로필(나) */}
      <button type="button" onClick={() => onNavigate('profile')}>
        <span>☺</span>
        {t('mobileNav.me')}
      </button>
    </nav>
  );
}