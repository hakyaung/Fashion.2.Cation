import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next'; // 💡 다국어 훅 추가
import { updateProfileApi, uploadProfileImageApi, API_URL } from '../../api/api';
import { useAuth } from '../../context/Authcontext'; 
import { formatApiError } from '../../utils/formatApiError'; // 💡 에러 포매터 추가
import imageCompression from 'browser-image-compression'; 

export default function ProfileEditModal({ isOpen, user, onClose, onUpdated }) {
  const { t } = useTranslation(); // 💡 번역 함수 가져오기
  const { currentUserId } = useAuth();
  const [nickname, setNickname] = useState('');
  const [bio, setBio] = useState('');
  const [submitting, setSubmitting] = useState(false);
  
  const [profileImageUrl, setProfileImageUrl] = useState(''); 
  const [previewUrl, setPreviewUrl] = useState('');
  const [selectedFile, setSelectedFile] = useState(null); 
  
  const fileInputRef = useRef(null);

  // 모달이 열리거나 user 정보가 바뀔 때마다 입력창 초기화
  useEffect(() => {
    if (user && isOpen) {
      setNickname(user.nickname || '');
      setBio(user.bio || '');
      setSelectedFile(null); // 모달 열 때 이전 선택 파일 찌꺼기 비우기

      if (user.profile_image_url) {
        setProfileImageUrl(user.profile_image_url);
        const url = user.profile_image_url;
        // 💡 [캐시 방지 트릭] 브라우저가 옛날 사진을 보여주지 못하도록 주소 뒤에 현재 시간을 붙입니다!
        setPreviewUrl(url.startsWith('http') ? url : `${API_URL}${url}?t=${Date.now()}`);
      } else {
        setPreviewUrl("https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=300");
      }
    }
  }, [user, isOpen]);

  if (!isOpen) return null;

  // ==========================================
  // 💡 사진을 선택했을 때: 업로드 하지 말고 미리보기만 띄우기!
  // ==========================================
  const handleImageChange = async (e) => {
    let file = e.target.files[0];
    if (!file) return;

    try {
      // 1. 선택한 이미지를 화면에 띄워주기 위해 임시 주소 생성
      const tempUrl = URL.createObjectURL(file);
      setPreviewUrl(tempUrl);

      let fileToUpload = file;

      // 2. 이미지 압축 로직 (500KB 이상일 때만 실행)
      if (file.size > 500 * 1024) {
        const options = {
          maxSizeMB: 0.8,
          maxWidthOrHeight: 1024,
          useWebWorker: true,
        };
        
        const compressedBlob = await imageCompression(file, options);
        // 압축된 Blob을 원본 파일 이름으로 다시 예쁘게 포장합니다.
        fileToUpload = new File([compressedBlob], file.name, {
          type: compressedBlob.type,
        });
        
        console.log(`프로필 압축 완료: ${(fileToUpload.size / 1024 / 1024).toFixed(2)}MB`);
      }

      // 3. 압축이 끝난 파일을 'selectedFile' 통에 담아두기 (나중에 저장 버튼 누르면 보냄)
      setSelectedFile(fileToUpload);

    } catch (err) {
      alert(t('profileEdit.imageErr', { msg: formatApiError(t, err) })); // 💡 에러 포매터 및 다국어 적용
    }
  };

  // ==========================================
  // 💡 저장 버튼을 눌렀을 때: 사진 업로드 -> 프로필 정보 수정
  // ==========================================
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    
    try {
      let finalImageUrl = profileImageUrl; // 기본값은 기존 사진 주소

      // 1. 새로 선택한 사진(selectedFile)이 있다면 지금 서버로 업로드!
      if (selectedFile) {
        const result = await uploadProfileImageApi(selectedFile);
        // 💡 만약 서버 응답 키값이 다를 경우를 대비해 확실하게 URL을 낚아챕니다.
        finalImageUrl = result.profile_image_url || result.image_url || result.url || finalImageUrl;
      }

      // 2. 새 주소(또는 기존 주소)와 텍스트를 묶어서 내 프로필 업데이트!
      await updateProfileApi({ 
        nickname, 
        bio, 
        profile_image_url: finalImageUrl 
      });
      
      alert(t('profileEdit.success')); // 💡 다국어 적용
      onUpdated(); 
      onClose();
    } catch (err) {
      alert(t('profileEdit.saveErr', { msg: formatApiError(t, err) })); // 💡 에러 포매터 및 다국어 적용
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={`modal-overlay ${isOpen ? 'active' : ''}`} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="auth-modal-content" style={{ maxWidth: '420px', textAlign: 'center' }}>
        <button type="button" className="modal-close" onClick={onClose}>&times;</button>
        
        <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, marginBottom: 10 }}>
          {t('profileEdit.title')}
        </h3>
        <p style={{ fontSize: 12, color: '#666', marginBottom: 25 }}>
          {t('profileEdit.subtitle')}
        </p>

        <div style={{ marginBottom: '25px', position: 'relative', display: 'inline-block' }}>
          <div 
            // 💡 웹 접근성(A11y) 향상을 위한 속성 추가
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
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
              alt={t('profileEdit.previewAlt')} 
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
              {t('profileEdit.editPhoto')}
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
            <label 
              style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--rust)', marginLeft: '4px' }}
              htmlFor="profile-nickname-input"
            >
              {t('profileEdit.nicknameLabel')}
            </label>
            <input 
              type="text" 
              value={nickname} 
              onChange={(e) => setNickname(e.target.value)} 
              required 
              placeholder={t('profileEdit.nickPh')}
              id="profile-nickname-input"
            />
          </div>

          <div style={{ textAlign: 'left', marginBottom: '20px' }}>
            <label 
              style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--rust)', marginLeft: '4px' }}
              htmlFor="profile-bio-textarea"
            >
              {t('profileEdit.bioLabel')}
            </label>
            <textarea 
              value={bio} 
              onChange={(e) => setBio(e.target.value)} 
              placeholder={t('profileEdit.bioPh')}
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
            {submitting ? t('profileEdit.submitting') : t('profileEdit.submitBtn')}
          </button>
        </form>
      </div>
    </div>
  );
}