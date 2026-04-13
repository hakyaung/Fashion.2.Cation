import React, { useState, useRef, useEffect } from 'react';
import { updateProfileApi, uploadProfileImageApi, API_URL } from '../../api/api';
import { useAuth } from '../../context/Authcontext'; 
import imageCompression from 'browser-image-compression'; // 💡 압축 라이브러리 불러오기

export default function ProfileEditModal({ isOpen, user, onClose, onUpdated }) {
  const { currentUserId } = useAuth();
  const [nickname, setNickname] = useState(user?.nickname || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [submitting, setSubmitting] = useState(false);
  
  const [profileImageUrl, setProfileImageUrl] = useState(user?.profile_image_url || ''); 
  const [previewUrl, setPreviewUrl] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (user?.profile_image_url) {
      setProfileImageUrl(user.profile_image_url);
      const url = user.profile_image_url;
      setPreviewUrl(url.startsWith('http') ? url : `${API_URL}${url}`);
    } else {
      setPreviewUrl("https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=300");
    }
  }, [user]);

  if (!isOpen) return null;

  // ==========================================
  // 💡 프로필 이미지 압축 및 업로드 핸들러
  // ==========================================
  const handleImageChange = async (e) => {
    let file = e.target.files[0];
    if (!file) return;

    try {
      setSubmitting(true); // 압축 및 업로드 중 클릭 방지

      // 💡 1. 이미지 압축 로직 (500KB 이상일 때만 실행)
      if (file.size > 500 * 1024) {
        const options = {
          maxSizeMB: 0.8, // 프로필은 0.8MB면 아주 충분합니다.
          maxWidthOrHeight: 1024, // 프로필용이므로 1024px로 리사이징
          useWebWorker: true,
        };
        
        const compressedBlob = await imageCompression(file, options);
        const ext = file.name.split('.').pop() || 'jpg';
        file = new File([compressedBlob], `compressed_profile_${Date.now()}.${ext}`, {
          type: compressedBlob.type,
        });
        
        console.log(`프로필 원본: ${(e.target.files[0].size / 1024 / 1024).toFixed(2)}MB -> 압축 후: ${(file.size / 1024 / 1024).toFixed(2)}MB`);
      }

      // 2. 압축된 파일로 로컬 미리보기 즉시 갱신
      setPreviewUrl(URL.createObjectURL(file));

      // 3. 서버로 압축된 파일 전송
      const result = await uploadProfileImageApi(file);
      
      setProfileImageUrl(result.profile_image_url); 
      const newUrl = result.profile_image_url;
      setPreviewUrl(newUrl.startsWith('http') ? newUrl : `${API_URL}${newUrl}`);
      
      alert('프로필 이미지가 성공적으로 업로드되었습니다! ✦');
    } catch (err) {
      alert('이미지 처리/업로드 중 오류가 발생했습니다: ' + err.message);
      // 실패 시 롤백
      setPreviewUrl(user?.profile_image_url ? (user.profile_image_url.startsWith('http') ? user.profile_image_url : `${API_URL}${user.profile_image_url}`) : "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=300");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await updateProfileApi({ 
        nickname, 
        bio, 
        profile_image_url: profileImageUrl 
      });
      
      alert('프로필이 성공적으로 변경되었습니다! ✨');
      onUpdated(); 
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
            <img 
              src={previewUrl} 
              alt="Profile Preview" 
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
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