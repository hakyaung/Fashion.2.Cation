// frontend_react/src/components/layout/Leftsidebar.jsx
import React from 'react';
import { useTranslation } from 'react-i18next';

export default function LeftSidebar({ activeView, activeSort, onNavigate, onSort, onNearby, onTagSearch }) {
  const { t } = useTranslation();

  return (
    <aside className="left-sidebar">
      <ul className="sidebar-menu">
        <li className="menu-title">{t('leftSidebar.sectionMain')}</li>
        <li>
          <a
            href="#"
            className={activeView === 'home' && activeSort !== 'recommend' ? 'active' : ''}
            onClick={(e) => {
              e.preventDefault();
              // '홈'을 누르면 기본 상태인 랜덤 피드로 이동합니다.
              onSort('random');
              onNavigate('home');
            }}
          >
            <span>⌂</span> {t('leftSidebar.home')}
          </a>
        </li>
        <li>
          <a
            href="#"
            className={activeView === 'profile' ? 'active' : ''}
            onClick={(e) => {
              e.preventDefault();
              onNavigate('profile');
            }}
          >
            <span>☺</span> {t('leftSidebar.profile')}
          </a>
        </li>
        <li>
          <a
            href="#"
            className={activeView === 'messages' ? 'active' : ''}
            onClick={(e) => {
              e.preventDefault();
              onNavigate('messages');
            }}
          >
            <span>✉</span> {t('leftSidebar.messages')}
          </a>
        </li>
        <li>
          <a
            href="#"
            className={activeView === 'fashion-eval' ? 'active' : ''}
            onClick={(e) => {
              e.preventDefault();
              onNavigate('fashion-eval');
            }}
          >
            <span>◇</span> {t('leftSidebar.fashionEval')}
          </a>
        </li>

        {/* ========================================== */}
        {/* 💡 AI 추천 의류 메뉴 추가 */}
        {/* ========================================== */}
        <li>
          <a
            href="#"
            className={activeView === 'home' && activeSort === 'recommend' ? 'active' : ''}
            onClick={(e) => {
              e.preventDefault();
              onSort('recommend');
            }}
          >
            <span>🤖</span> 추천 의류
          </a>
        </li>

        {/* ========================================== */}
        {/* 💡 스냅(숏폼) 피드 메뉴 */}
        {/* ========================================== */}
        <li>
          <a
            href="#"
            className={activeView === 'snap' ? 'active' : ''}
            onClick={(e) => {
              e.preventDefault();
              onNavigate('snap');
            }}
          >
            <span>🎬</span> 스냅
          </a>
        </li>

        <li className="menu-title" style={{ marginTop: 30 }}>
          {t('leftSidebar.sectionFeed')}
        </li>
        <li>
          <a
            href="#"
            className={activeSort === 'latest' ? 'active' : ''}
            onClick={(e) => {
              e.preventDefault();
              onSort('latest');
            }}
          >
            <span>✦</span> {t('leftSidebar.latest')}
          </a>
        </li>
        <li>
          <a
            href="#"
            className={activeSort === 'popular' ? 'active' : ''}
            onClick={(e) => {
              e.preventDefault();
              onSort('popular');
            }}
          >
            <span>⟡</span> {t('leftSidebar.popular')}
          </a>
        </li>
        <li>
          <a
            href="#"
            className={activeSort === 'nearby' ? 'active' : ''}
            onClick={(e) => {
              e.preventDefault();
              onNearby();
            }}
          >
            <span>⚑</span> {t('leftSidebar.nearby')}
          </a>
        </li>

        <li className="menu-title" style={{ marginTop: 30 }}>
          {t('leftSidebar.sectionTopics')}
        </li>
        <li>
          <a
            href="#"
            className="topic-tag"
            onClick={(e) => {
              e.preventDefault();
              onTagSearch('불당동');
            }}
          >
            #{t('leftSidebar.topicBuldang', '불당동')}
          </a>
        </li>
        <li>
          <a
            href="#"
            className="topic-tag"
            onClick={(e) => {
              e.preventDefault();
              onTagSearch('신부동');
            }}
          >
            #{t('leftSidebar.topicSinbu', '신부동')}
          </a>
        </li>
        <li>
          <a
            href="#"
            className="topic-tag"
            onClick={(e) => {
              e.preventDefault();
              onTagSearch('미니멀룩');
            }}
          >
            #{t('leftSidebar.topicMinimal', '미니멀룩')}
          </a>
        </li>
      </ul>
    </aside>
  );
}