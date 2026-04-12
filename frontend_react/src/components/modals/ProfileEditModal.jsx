import React, { useState, useRef, useEffect } from 'react';
import { updateProfileApi, uploadProfileImageApi, API_URL } from '../../api/api';
import { useAuth } from '../../context/Authcontext'; // 현재 유저 아이디를 가져오기 위해 useAuth 사용

export default function ProfileEditModal({ isOpen, user, onClose, onUpdated }) {
  // 💡 기존 상태 유지
  const { currentUserId } = useAuth();
  const [nickname, setNickname] = useState(user?.nickname || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [submitting, setSubmitting] = useState(false);
  
  // 💡 이미지 처리를 위한 새로운 상태 및 Ref 추가
  // 1. profileImageUrl: API로 보낼 최종 경로 (예: /static/profiles/abcdef.jpg)
  const [profileImageUrl, setProfileImageUrl] = useState(user?.profile_image_url || ''); 
  // 2. previewUrl: 화면에 보여줄 가공된 URL (로컬 미리보기 또는 서버 주소 포함)
  const [previewUrl, setPreviewUrl] = useState('');
  const fileInputRef = useRef(null);

  // 💡 컴포넌트 마운트 시 초기 이미지 설정
  useEffect(() => {
    if (user?.profile_image_url) {
      setProfileImageUrl(user.profile_image_url);
      const url = user.profile_image_url;
      // 서버 경로이면 API_URL을 붙여서 풀 URL을 만듭니다.
      setPreviewUrl(url.startsWith('http') ? url : `${API_URL}${url}`);
    } else {
      // 이미지 경로가 없으면 디폴트 이미지를 사용합니다.
      setPreviewUrl("https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=300");
    }
  }, [user]);

  if (!isOpen) return null;

  // 💡 이미지 선택 및 업로드 핸들러 (기존 기능 유지 및 확장)
  const handleImageChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // 파일 크기 제한 (5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert("파일 크기는 5MB 이하여야 합니다.");
      return;
    }

    // 💡 1. 즉시 로컬 미리보기 제공 (사용자 경험 향상)
    setPreviewUrl(URL.createObjectURL(file));

    try {
      setSubmitting(true);
      // 2. 서버의 /me/profile-image 엔드포인트로 파일 전송 및 업로드
      const result = await uploadProfileImageApi(file);
      
      // 💡 3. 서버에서 반환된 새로운 이미지 경로로 상태 업데이트
      setProfileImageUrl(result.profile_image_url); // 이것이 최종 저장될 경로입니다.
      const newUrl = result.profile_image_url;
      // 화면 표시용 URL도 가공하여 업데이트합니다.
      setPreviewUrl(newUrl.startsWith('http') ? newUrl : `${API_URL}${newUrl}`);
      alert('프로필 이미지가 성공적으로 업로드되었습니다! ✦');
    } catch (err) {
      alert('이미지 업로드 중 오류가 발생했습니다: ' + err.message);
      // 업로드 실패 시 로컬 미리보기를 취소하고 이전 상태로 되돌립니다.
      setPreviewUrl(user?.profile_image_url ? `${API_URL}${user.profile_image_url}` : "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=300");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      // 💡 닉네임, 소개글과 함께 최종 이미지 경로(profileImageUrl)를 함께 저장
      await updateProfileApi({ 
        nickname, 
        bio, 
        profile_image_url: profileImageUrl // 💡 서버 경로를 보냅니다.
      });
      
      alert('프로필이 성공적으로 변경되었습니다! ✨');
      onUpdated(); // 부모(ProfileView) 데이터 갱신
      onClose();
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={`modal-overlay ${isOpen ? 'active' : ''}`} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="auth-modal-content" style={{ maxWidth: '420px', textAlign: 'center' }}>
        <button className="modal-close" onClick={onClose}>&times;</button>
        
        <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, marginBottom: 10 }}>Edit Profile</h3>
        <p style={{ fontSize: 12, color: '#666', marginBottom: 25 }}>나만의 스타일을 프로필에 담아보세요.</p>

        {/* 💡 4. 프로필 이미지 업로드 영역 (하경님 디자인 코드 적극 활용) */}
        <div style={{ marginBottom: '25px', position: 'relative', display: 'inline-block' }}>
          <div 
            onClick={() => fileInputRef.current.click()}
            style={{ 
              width: '110px', 
              height: '110px', 
              borderRadius: '50%', 
              overflow: 'hidden', 
              border: '2px solid var(--rust)',
              cursor: 'pointer',
              backgroundColor: '#f8f8f8',
              position: 'relative',
              boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
            }}
          >
            {/* 💡 가공된 previewUrl을 src에 할당합니다. */}
            <img 
              src={previewUrl} 
              alt="Profile Preview" 
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
            {/* 💡 마우스 오버 시 EDIT 글자를 보여주는 오버레이 */}
            <div style={{
              position: 'absolute',
              bottom: '0',
              left: '0',
              right: '0',
              background: 'rgba(0,0,0,0.5)',
              color: '#fff',
              fontSize: '10px',
              padding: '4px 0',
              fontFamily: 'sans-serif',
              fontWeight: 'bold',
              letterSpacing: '0.5px'
            }}>
              EDIT
            </div>
          </div>
          {/* 실제 파일 입력창은 숨겨둡니다. */}
          <input 
            type="file" 
            ref={fileInputRef} 
            style={{ display: 'none' }} 
            accept="image/*" 
            onChange={handleImageChange} 
          />
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <div style={{ textAlign: 'left', marginBottom: '15px' }}>
            <label style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--rust)', marginLeft: '4px' }}>NICKNAME</label>
            <input 
              type="text" 
              value={nickname} 
              onChange={(e) => setNickname(e.target.value)} 
              required 
              placeholder="닉네임을 입력하세요"
              id="profile-nickname-input"
            />
          </div>

          <div style={{ textAlign: 'left', marginBottom: '20px' }}>
            <label style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--rust)', marginLeft: '4px' }}>BIO</label>
            <textarea 
              value={bio} 
              onChange={(e) => setBio(e.target.value)} 
              placeholder="당신만의 패션 무드를 설명해주세요."
              rows={3}
              style={{ 
                width: '100%', 
                padding: '12px', 
                marginTop: '8px', 
                borderRadius: '4px', 
                border: '1px solid var(--border-color)',
                fontSize: '14px',
                lineHeight: '1.6'
              }}
              id="profile-bio-textarea"
            />
          </div>

          <button type="submit" disabled={submitting}>
            {submitting ? '처리 중...' : '변경사항 저장 ✦'}
          </button>
        </form>
      </div>
    </div>
  );
}