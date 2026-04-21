import React from 'react';
import { useTranslation } from 'react-i18next';

// 💡 [수정됨] activeView와 onOpenSnapUpload props 추가
export default function RightSidebar({ activeView, onOpenPostModal, onOpenSnapUpload }) {
  const { t } = useTranslation();

  const areas = [
    { rank: 1, nameKey: 'rightSidebar.area1', members: '12,430' },
    { rank: 2, nameKey: 'rightSidebar.area2', members: '45,120' },
    { rank: 3, nameKey: 'rightSidebar.area3', members: '8,920' },
  ];

  // 스냅 모드인지 확인하는 변수
  const isSnapMode = activeView === 'snap' || activeView === 'snap-upload';

  return (
    <aside className="right-sidebar">
      <div className="widget">
        <h3 className="widget-title">{t('rightSidebar.trendingTitle')}</h3>
        <ul className="trending-list">
          {areas.map((item) => (
            <li key={item.rank}>
              <div className="trend-info">
                <span className="trend-rank">{item.rank}</span>
                <div className="trend-details">
                  <h4>{t(item.nameKey)}</h4>
                  <p>{t('rightSidebar.membersLabel', { count: item.members })}</p>
                </div>
              </div>
              <button type="button" className="btn-join">
                {t('rightSidebar.join')}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="widget write-widget" style={{ borderColor: 'var(--rust)', background: 'var(--off-white)' }}>
        {/* 💡 [수정됨] 현재 화면 상태(isSnapMode)에 따라 위젯 내용이 동적으로 바뀝니다! */}
        {isSnapMode ? (
          <>
            <h3 className="widget-title" style={{ color: 'var(--rust)' }}>
              새로운 스냅 공유
            </h3>
            <p style={{ fontSize: 12, color: 'rgba(26,22,18,0.6)', marginBottom: 16, lineHeight: 1.5 }}>
              오늘의 멋진 핏과 스타일을 숏폼 영상으로 커뮤니티에 공유해보세요.
            </p>
            <button type="button" className="btn-write" onClick={onOpenSnapUpload}>
              스냅 올리기 🎬
            </button>
          </>
        ) : (
          <>
            <h3 className="widget-title" style={{ color: 'var(--rust)' }}>
              {t('rightSidebar.writeWidgetTitle')}
            </h3>
            <p style={{ fontSize: 12, color: 'rgba(26,22,18,0.6)', marginBottom: 16, lineHeight: 1.5 }}>
              {t('rightSidebar.writeWidgetDesc')}
            </p>
            <button type="button" className="btn-write" onClick={onOpenPostModal}>
              {t('rightSidebar.writeBtn')}
            </button>
          </>
        )}
      </div>
    </aside>
  );
}