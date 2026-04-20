import React from 'react';
import { useTranslation } from 'react-i18next';

export default function RightSidebar({ onOpenPostModal }) {
  const { t } = useTranslation();

  const areas = [
    { rank: 1, nameKey: 'rightSidebar.area1', members: '12,430' },
    { rank: 2, nameKey: 'rightSidebar.area2', members: '45,120' },
    { rank: 3, nameKey: 'rightSidebar.area3', members: '8,920' },
  ];

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
        <h3 className="widget-title" style={{ color: 'var(--rust)' }}>
          {t('rightSidebar.writeWidgetTitle')}
        </h3>
        <p style={{ fontSize: 12, color: 'rgba(26,22,18,0.6)', marginBottom: 16, lineHeight: 1.5 }}>
          {t('rightSidebar.writeWidgetDesc')}
        </p>
        <button type="button" className="btn-write" onClick={onOpenPostModal}>
          {t('rightSidebar.writeBtn')}
        </button>
      </div>
    </aside>
  );
}