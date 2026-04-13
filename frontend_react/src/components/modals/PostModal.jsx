import React, { useState, useRef, useEffect, useCallback } from 'react';
import { uploadPost, searchLocations } from '../../api/api';
import imageCompression from 'browser-image-compression';

export default function PostModal({ isOpen, onClose, onPosted }) {
  const [content, setContent] = useState('');
  const [tags, setTags] = useState('');
  const [locationQuery, setLocationQuery] = useState('');
  const [locationId, setLocationId] = useState('');
  const [locationSelected, setLocationSelected] = useState(false);
  const [locationResults, setLocationResults] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [file, setFile] = useState(null);
  const [fileName, setFileName] = useState('선택된 파일 없음');
  const [submitting, setSubmitting] = useState(false);

  const fileInputRef = useRef(null);
  const searchTimerRef = useRef(null);

  // 모달 닫힐 때 초기화
  useEffect(() => {
    if (!isOpen) resetForm();
  }, [isOpen]);

  function resetForm() {
    setContent('');
    setTags('');
    setLocationQuery('');
    setLocationId('');
    setLocationSelected(false);
    setLocationResults([]);
    setShowDropdown(false);
    setPreviewUrl('');
    setFile(null);
    setFileName('선택된 파일 없음');
  }

  // ==========================================
  // 이미지 미리보기 및 압축
  // ==========================================
  const handleFileChange = async (e) => {
    const f = e.target.files[0];
    if (!f) {
      resetImagePreview();
      return;
    }

    if (f.size <= 500 * 1024) {
      setFileName(f.name);
      setFile(f);
      const reader = new FileReader();
      reader.onload = (ev) => setPreviewUrl(ev.target.result);
      reader.readAsDataURL(f);
      return;
    }

    setFileName("이미지 압축 중... ⏳");

    const options = {
      maxSizeMB: 0.9,
      maxWidthOrHeight: 1920,
      useWebWorker: true,
    };

    try {
      const compressedBlob = await imageCompression(f, options);
      const ext = f.name.split('.').pop() || 'jpg';
      const compressedFile = new File([compressedBlob], `compressed_${Date.now()}.${ext}`, {
        type: compressedBlob.type,
      });

      console.log(`원본: ${(f.size / 1024 / 1024).toFixed(2)}MB -> 압축: ${(compressedFile.size / 1024 / 1024).toFixed(2)}MB`);

      setFileName("압축 완료! (업로드 준비됨)");
      setFile(compressedFile);

      const reader = new FileReader();
      reader.onload = (ev) => setPreviewUrl(ev.target.result);
      reader.readAsDataURL(compressedFile);
    } catch (error) {
      console.error("이미지 압축 에러:", error);
      alert("이미지 압축 중 오류가 발생했습니다.");
      resetImagePreview();
    }
  };

  const resetImagePreview = () => {
    setPreviewUrl('');
    setFile(null);
    setFileName('선택된 파일 없음');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ==========================================
  // 지역 검색 자동완성
  // ==========================================
  const handleLocationInput = (e) => {
    const kw = e.target.value;
    setLocationQuery(kw);
    setLocationSelected(false);
    setLocationId('');

    if (kw.trim().length < 1) {
      setShowDropdown(false);
      return;
    }

    clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(async () => {
      try {
        const results = await searchLocations(kw.trim());
        setLocationResults(results || []);
        setShowDropdown(true);
      } catch (err) {
        setLocationResults([]);
        setShowDropdown(true);
      }
    }, 300);
  };

  const selectLocation = (loc) => {
    setLocationQuery(loc.full_name);
    setLocationId(String(loc.id));
    setLocationSelected(true);
    setShowDropdown(false);
  };

  // ==========================================
  // 게시글 제출
  // ==========================================
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!locationId || locationId.trim() === '') {
      alert('지역을 검색하고 목록에서 선택해주세요.');
      return;
    }
    setSubmitting(true);
    try {
      await uploadPost({ locationId, content, tags, file });
      alert('성공적으로 게시되었습니다!');
      onClose();
      onPosted(); 
    } catch (err) {
      alert(`업로드 실패: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="modal-overlay active"
      id="postModal"
      onClick={handleOverlayClick}
    >
      {/* 💡 [핵심 수정] id="post-modal-content"를 추가하여 모바일 CSS가 적용되게 합니다. */}
      <div 
        id="post-modal-content" 
        className="auth-modal-content" 
        style={{ maxWidth: 500, display: 'flex', flexDirection: 'column' }}
      >
        <button className="modal-close" onClick={onClose}>&times;</button>
        
        <h3
          style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: 28,
            marginBottom: 10,
            color: 'var(--warm-black)',
          }}
        >
          New Post
        </h3>
        <p style={{ fontSize: 12, color: '#666', marginBottom: 24 }}>
          텍스트만 올려도 좋고, 사진과 함께면 더 좋습니다.
        </p>

        <form className="auth-form" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* 본문 */}
          <textarea
            rows={4}
            placeholder="어떤 스타일인가요? 패션에 대한 이야기를 자유롭게 적어주세요."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            required
            style={{ width: '100%', resize: 'none' }}
          />

          {/* 지역 검색 */}
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              placeholder="🔍 지역 검색 (예: 불당동, 홍대)"
              value={locationQuery}
              onChange={handleLocationInput}
              onFocus={() => {
                if (locationQuery.trim().length > 0 && !locationSelected && locationResults.length > 0) {
                  setShowDropdown(true);
                }
              }}
              autoComplete="off"
              required
              style={{ width: '100%' }}
            />

            {showDropdown && (
              <ul className="location-dropdown" style={{ display: 'block', position: 'absolute', width: '100%', zIndex: 10 }}>
                {locationResults.length === 0 ? (
                  <li className="empty-result">검색 결과가 없습니다.</li>
                ) : (
                  locationResults.map((loc) => (
                    <li
                      key={loc.id}
                      onMouseDown={(e) => { e.preventDefault(); selectLocation(loc); }}
                      onClick={() => selectLocation(loc)}
                    >
                      {loc.full_name}
                    </li>
                  ))
                )}
              </ul>
            )}
          </div>

          {/* 태그 */}
          <input
            type="text"
            placeholder="태그 (쉼표로 구분, 예: 스트릿,오버핏)"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            style={{ width: '100%' }}
          />

          {/* 이미지 첨부 영역 */}
          <div
            style={{
              border: '1px dashed rgba(0,0,0,0.2)',
              padding: 16,
              borderRadius: 8,
              textAlign: 'center',
              backgroundColor: '#fafafa'
            }}
          >
            <label
              htmlFor="postFile"
              style={{ fontSize: 13, color: 'var(--rust)', cursor: 'pointer', fontWeight: 600, display: 'block' }}
            >
              + 이미지 첨부 (선택사항)
            </label>
            <input
              type="file"
              id="postFile"
              ref={fileInputRef}
              accept="image/png, image/jpeg"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
            <div style={{ fontSize: 11, marginTop: 8, color: '#888' }}>{fileName}</div>

            {previewUrl && (
              <div style={{ display: 'block', marginTop: 15, position: 'relative' }}>
                <img
                  src={previewUrl}
                  className="post-image-preview"
                  alt="미리보기"
                  style={{
                    width: '100%',
                    maxHeight: 250,
                    objectFit: 'cover',
                    borderRadius: 8,
                    border: '1px solid #eee'
                  }}
                />
                <button
                  type="button"
                  id="removePreviewBtn"
                  onClick={resetImagePreview}
                  style={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    background: 'rgba(0,0,0,0.7)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '50%',
                    width: 26,
                    height: 26,
                    cursor: 'pointer',
                    fontSize: 16,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  &times;
                </button>
              </div>
            )}
          </div>

          {/* 제출 버튼 */}
          <button 
            type="submit" 
            className="btn-submit-post"
            disabled={submitting}
            style={{ 
              marginTop: '10px',
              backgroundColor: submitting ? '#ccc' : 'var(--rust)',
              color: 'white',
              border: 'none',
              padding: '16px',
              borderRadius: '8px',
              fontWeight: 'bold',
              cursor: submitting ? 'default' : 'pointer'
            }}
          >
            {submitting ? '게시 중...' : '커뮤니티에 게시 ✦'}
          </button>
        </form>
      </div>
    </div>
  );
}