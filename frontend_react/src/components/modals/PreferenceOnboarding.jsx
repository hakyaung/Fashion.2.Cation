// frontend_react/src/components/modals/PreferenceOnboarding.jsx
import React, { useState } from 'react';

// 유저가 선택할 수 있는 보기 옵션들
const STYLE_OPTIONS = ["미니멀", "스트릿", "캐주얼", "빈티지", "스포티", "프레피"];
const CATEGORY_OPTIONS = ["남성_상의", "남성_하의", "남성_아우터", "여성_상의", "여성_치마", "여성_원피스"];

export default function PreferenceOnboarding({ isOpen, onClose, onSave }) {
  const [selectedStyles, setSelectedStyles] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // 태그 선택/해제 토글 함수
  const toggleStyle = (style) => {
    setSelectedStyles(prev => prev.includes(style) ? prev.filter(s => s !== style) : [...prev, style]);
  };
  const toggleCategory = (category) => {
    setSelectedCategories(prev => prev.includes(category) ? prev.filter(c => c !== category) : [...prev, category]);
  };

  // 백엔드로 전송!
  const handleSubmit = async () => {
    if (selectedStyles.length === 0 && selectedCategories.length === 0) {
      alert("최소 한 개의 스타일이나 카테고리를 선택해주세요!");
      return;
    }

    setIsLoading(true);
    const token = localStorage.getItem('stylescape_token');
    
    try {
      const currentProtocol = window.location.protocol;
      const currentHost = window.location.hostname;
      const API_BASE = currentProtocol === 'https:' ? `https://${currentHost}` : `http://${currentHost}:8000`;

      // 💡 아까 만든 백엔드 API로 PUT 요청
      const response = await fetch(`${API_BASE}/api/v1/users/me/preferences`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          // 배열을 쉼표로 연결된 문자열로 변환하여 전송 ("미니멀,스트릿")
          preferred_styles: selectedStyles.join(','),
          preferred_categories: selectedCategories.join(',')
        })
      });

      if (response.ok) {
        alert("취향 분석이 완료되었습니다! ✨");
        onSave(); // 성공 시 CommunityPage에 알림
      } else {
        const errData = await response.json();
        alert(`저장 실패: ${errData.detail || '알 수 없는 오류'}`);
      }
    } catch (error) {
      console.error("온보딩 저장 에러:", error);
      alert("서버와 통신하는 중 문제가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <h2 style={styles.title}>환영합니다! 🎉</h2>
        <p style={styles.subtitle}>좋아하는 패션 스타일과 아이템을 골라주세요.<br/>AI가 딱 맞는 옷을 추천해 드립니다.</p>
        
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>어떤 스타일을 좋아하시나요?</h3>
          <div style={styles.tagContainer}>
            {STYLE_OPTIONS.map(style => (
              <button
                key={style}
                style={{ ...styles.tag, ...(selectedStyles.includes(style) ? styles.tagActive : {}) }}
                onClick={() => toggleStyle(style)}
              >
                #{style}
              </button>
            ))}
          </div>
        </div>

        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>주로 찾는 아이템은 무엇인가요?</h3>
          <div style={styles.tagContainer}>
            {CATEGORY_OPTIONS.map(category => (
              <button
                key={category}
                style={{ ...styles.tag, ...(selectedCategories.includes(category) ? styles.tagActive : {}) }}
                onClick={() => toggleCategory(category)}
              >
                #{category.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        <button 
          style={{ ...styles.submitBtn, opacity: isLoading ? 0.7 : 1 }} 
          onClick={handleSubmit} 
          disabled={isLoading}
        >
          {isLoading ? "저장 중..." : "선택 완료하고 피드 보기"}
        </button>
      </div>
    </div>
  );
}

// 간단한 인라인 스타일 (필요시 CSS 파일로 옮기셔도 됩니다)
const styles = {
  overlay: { 
    position: 'fixed', 
    top: 0, 
    left: 0, 
    right: 0, 
    bottom: 0, 
    backgroundColor: 'rgba(0,0,0,0.6)', 
    display: 'flex', 
    justifyContent: 'center', 
    alignItems: 'center', zIndex: 9999 },
  modal: { backgroundColor: '#fff', padding: '30px', borderRadius: '16px', maxWidth: '500px', width: '90%', textAlign: 'center', boxShadow: '0 10px 30px rgba(0,0,0,0.2)' },
  title: { fontSize: '24px', fontWeight: 'bold', marginBottom: '10px', color: '#333' },
  subtitle: { fontSize: '15px', color: '#666', marginBottom: '24px', lineHeight: '1.5' },
  section: { marginBottom: '24px', textAlign: 'left' },
  sectionTitle: { fontSize: '16px', fontWeight: 'bold', marginBottom: '12px', color: '#444' },
  tagContainer: { display: 'flex', flexWrap: 'wrap', gap: '8px' },
  tag: { padding: '8px 16px', borderRadius: '20px', border: '1px solid #ddd', backgroundColor: '#f9f9f9', color: '#555', cursor: 'pointer', fontSize: '14px', transition: 'all 0.2s' },
  tagActive: { backgroundColor: 'var(--rust, #D96C4A)', color: '#fff', borderColor: 'var(--rust, #D96C4A)' },
  submitBtn: { width: '100%', padding: '14px', backgroundColor: '#222', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', marginTop: '10px' }
};