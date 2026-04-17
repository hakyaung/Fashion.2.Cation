import React from 'react';

export default function RightSidebar({ onOpenPostModal }) {
  return (
    <aside className="right-sidebar">
      <div className="widget">
        <h3 className="widget-title">인기 커뮤니티 지역</h3>
        <ul className="trending-list">
          {[
            { rank: 1, name: '천안 · 불당동', members: '12,430' },
            { rank: 2, name: '서울 · 홍대', members: '45,120' },
            { rank: 3, name: '천안 · 신부동', members: '8,920' },
          ].map((item) => (
            <li key={item.rank}>
              <div className="trend-info">
                <span className="trend-rank">{item.rank}</span>
                <div className="trend-details">
                  <h4>{item.name}</h4>
                  <p>멤버 {item.members}명</p>
                </div>
              </div>
              <button className="btn-join">가입</button>
            </li>
          ))}
        </ul>
      </div>

      <div className="widget write-widget" style={{ borderColor: 'var(--rust)', background: 'var(--off-white)' }}>
        <h3 className="widget-title" style={{ color: 'var(--rust)' }}>새로운 스타일 공유</h3>
        <p style={{ fontSize: 12, color: 'rgba(26,22,18,0.6)', marginBottom: 16, lineHeight: 1.5 }}>
          오늘 당신의 OOTD나 패션 인사이트를 커뮤니티에 나누어보세요.
        </p>
        <button className="btn-write" onClick={onOpenPostModal}>
          글쓰기 ✦
        </button>
      </div>
    </aside>
  );
}