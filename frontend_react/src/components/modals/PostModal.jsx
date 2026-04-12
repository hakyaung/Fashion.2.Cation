import React, { useState, useRef, useEffect, useCallback } from 'react';
import { uploadPost, searchLocations } from '../../api/api';

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
  // 이미지 미리보기
  // ==========================================
  const handleFileChange = (e) => {
    const f = e.target.files[0];
    if (!f) {
      resetImagePreview();
      return;
    }
    setFileName(f.name);
    setFile(f);
    const reader = new FileReader();
    reader.onload = (ev) => setPreviewUrl(ev.target.result);
    reader.readAsDataURL(f);
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
  // 제출
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
      onPosted(); // 피드 새로고침
    } catch (err) {
      alert(`업로드 실패: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      className={`modal-overlay${isOpen ? ' active' : ''}`}
      id="postModal"
      onClick={handleOverlayClick}
    >
      <div className="auth-modal-content" style={{ maxWidth: 500 }}>
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

        <form className="auth-form" onSubmit={handleSubmit}>
          {/* 본문 */}
          <textarea
            rows={4}
            placeholder="어떤 스타일인가요? 패션에 대한 이야기를 자유롭게 적어주세요."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            required
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
              <ul className="location-dropdown" style={{ display: 'block' }}>
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
          />

          {/* 이미지 첨부 */}
          <div
            style={{
              border: '1px dashed rgba(0,0,0,0.2)',
              padding: 16,
              borderRadius: 4,
              textAlign: 'center',
            }}
          >
            <label
              htmlFor="postFile"
              style={{ fontSize: 12, color: 'var(--rust)', cursor: 'pointer', fontWeight: 600 }}
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
            <div style={{ fontSize: 11, marginTop: 8, color: '#666' }}>{fileName}</div>

            {previewUrl && (
              <div style={{ display: 'block', marginTop: 15, position: 'relative' }}>
                <img
                  src={previewUrl}
                  alt="미리보기"
                  style={{
                    width: '100%',
                    maxHeight: 250,
                    objectFit: 'cover',
                    borderRadius: 4,
                    border: '1px solid #eee',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                  }}
                />
                <button
                  type="button"
                  id="removePreviewBtn"
                  onClick={resetImagePreview}
                  style={{
                    position: 'absolute',
                    top: 5,
                    right: 5,
                    background: 'rgba(0,0,0,0.6)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '50%',
                    width: 24,
                    height: 24,
                    cursor: 'pointer',
                    fontSize: 14,
                    lineHeight: 1,
                  }}
                >
                  &times;
                </button>
              </div>
            )}
          </div>

          <button type="submit" disabled={submitting}>
            {submitting ? '게시 중...' : '커뮤니티에 게시 ✦'}
          </button>
        </form>
      </div>
    </div>
  );
}