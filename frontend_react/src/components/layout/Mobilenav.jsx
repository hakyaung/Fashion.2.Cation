// frontend_react/src/components/layout/Mobilenav.jsx
import React from 'react';
import { useTranslation } from 'react-i18next';

export default function MobileNav({ onNavigate, onSort, onNearby, onOpenPost }) {
  const { t } = useTranslation();

  return (
    <nav className="mobile-nav">
      {/* 1. 홈 */}
      <button type="button" onClick={() => onNavigate('home')}>
        <span>⌂</span>
        {t('mobileNav.home')}
      </button>

      {/* 2. 메시지 */}
      <button type="button" onClick={() => onNavigate('messages')}>
        <span>✉</span>
        {t('mobileNav.messages')}
      </button>

      {/* 💡 3. 패션 평가 */}
      <button type="button" onClick={() => onNavigate('fashion-eval')}>
        <span>◇</span>
        {t('mobileNav.fashionEval')}
      </button>

      {/* 4. POST (가운데 정렬된 + 버튼) */}
      <button type="button" className="post-btn-inline" onClick={onOpenPost}>
        <span className="plus-icon">+</span>
        {t('mobileNav.post')}
      </button>

      {/* 🎬 5. 스냅 (기존 '주변' 버튼 대체) */}
      <button type="button" onClick={() => onNavigate('snap')}>
        <span>🎬</span>
        {/* 다국어 사전에 'mobileNav.snap'이 없더라도 '스냅'으로 출력되도록 폴백 설정 */}
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