import React, { useState, useEffect } from 'react';
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { storage } from '../../firebase';
import { useAuth } from '../../context/Authcontext';

export default function SnapUpload({ onUploadComplete }) {
  const { currentUserId } = useAuth();

  const [content, setContent] = useState('');
  const [tags, setTags] = useState('');
  const [locationSearch, setLocationSearch] = useState('');
  const [locationResults, setLocationResults] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [file, setFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const currentProtocol = window.location.protocol;
  const currentHost = window.location.hostname;
  const API_BASE_URL = currentProtocol === 'https:'
    ? `https://${currentHost}`
    : `http://${currentHost}:8000`;

  useEffect(() => {
    const searchLocation = async () => {
      if (locationSearch.length < 2 || selectedLocation) {
        setLocationResults([]);
        return;
      }
      try {
        setIsSearching(true);
        const response = await fetch(
          `${API_BASE_URL}/api/v1/locations/search?q=${encodeURIComponent(locationSearch)}`
        );
        if (response.ok) setLocationResults(await response.json());
      } catch (error) {
        console.error("지역 검색 실패:", error);
      } finally {
        setIsSearching(false);
      }
    };
    const timer = setTimeout(searchLocation, 400);
    return () => clearTimeout(timer);
  }, [locationSearch, selectedLocation, API_BASE_URL]);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.type.startsWith('video/')) {
      alert('영상 파일만 업로드 가능합니다!');
      return;
    }

    // 파일 크기 경고 (500MB 초과 시)
    if (selectedFile.size > 500 * 1024 * 1024) {
      alert('파일이 너무 큽니다. 500MB 이하의 영상을 올려주세요.');
      return;
    }

    setFile(selectedFile);
  };

  // 파일 확장자를 실제 MIME 타입 기반으로 결정
  const getExtension = (file) => {
    const mime = file.type;
    if (mime === 'video/mp4') return 'mp4';
    if (mime === 'video/quicktime') return 'mov';
    if (mime === 'video/webm') return 'webm';
    if (mime === 'video/x-msvideo') return 'avi';
    // 그 외는 원본 확장자 유지
    const nameParts = file.name.split('.');
    return nameParts[nameParts.length - 1] || 'mp4';
  };

  const handleUpload = async () => {
    if (!file) return alert("동영상을 선택해 주세요!");
    if (!content.trim()) return alert("패션에 대한 이야기를 적어주세요!");
    if (!selectedLocation) return alert("지역을 검색하여 선택해 주세요!");

    try {
      setIsUploading(true);
      setUploadProgress(0);

      // ✅ 실제 MIME 타입 기반으로 확장자 결정 (속이지 않음)
      const ext = getExtension(file);
      const fileName = `snaps/${currentUserId}_${Date.now()}.${ext}`;
      const storageRef = ref(storage, fileName);

      // ✅ 올바른 contentType 명시 (Firebase가 Content-Type을 정확히 저장)
      const metadata = {
        contentType: file.type || 'video/mp4',
      };

      const uploadTask = uploadBytesResumable(storageRef, file, metadata);

      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const p = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress(Math.round(p));
        },
        (error) => {
          console.error("Firebase 업로드 에러:", error);
          // 에러 코드별 안내
          if (error.code === 'storage/unauthorized') {
            alert("업로드 권한이 없습니다. 로그인 상태를 확인해 주세요.");
          } else if (error.code === 'storage/quota-exceeded') {
            alert("저장 공간이 부족합니다.");
          } else {
            alert(`업로드 실패: ${error.message}`);
          }
          setIsUploading(false);
        },
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);

          const token = localStorage.getItem('stylescape_token');
          const response = await fetch(`${API_BASE_URL}/api/v1/posts/snaps`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({
              video_url: downloadURL,
              content,
              location_id: selectedLocation.id,
              tags,
            }),
          });

          if (response.ok) {
            alert("스냅이 성공적으로 게시되었습니다! 🎬");
            onUploadComplete?.();
          } else {
            alert("서버 저장에 실패했습니다.");
          }
          setIsUploading(false);
        }
      );
    } catch (err) {
      console.error(err);
      setIsUploading(false);
    }
  };

  return (
    <div className="snap-upload-wrapper" style={{ maxWidth: '650px', margin: '0 auto', padding: '20px' }}>
      <div className="widget" style={{ background: '#fff', borderRadius: '12px', padding: '30px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '8px' }}>새 스냅</h2>
        <p style={{ color: '#666', fontSize: '14px', marginBottom: '24px' }}>
          영상과 함께 당신의 스타일을 자유롭게 공유해 보세요.
        </p>

        <textarea
          placeholder="어떤 스타일인가요? 패션에 대한 이야기를 자유롭게 적어주세요."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          style={{
            width: '100%', height: '150px', padding: '15px', borderRadius: '8px',
            border: '1px solid #eee', background: '#fcfcfc', marginBottom: '16px', resize: 'none',
          }}
        />

        <div style={{ position: 'relative', marginBottom: '16px' }}>
          <span style={{ position: 'absolute', left: '15px', top: '12px' }}>🔍</span>
          <input
            type="text"
            placeholder="지역 검색 (예: 불당동, 홍대)"
            value={selectedLocation ? selectedLocation.full_name : locationSearch}
            onChange={(e) => {
              setLocationSearch(e.target.value);
              if (selectedLocation) setSelectedLocation(null);
            }}
            style={{ width: '100%', padding: '12px 12px 12px 45px', borderRadius: '8px', border: '1px solid #eee' }}
          />
          {locationResults.length > 0 && (
            <ul style={{
              position: 'absolute', top: '100%', left: 0, width: '100%', background: '#fff',
              border: '1px solid #eee', borderRadius: '0 0 8px 8px', zIndex: 10, listStyle: 'none', padding: 0,
            }}>
              {locationResults.map(loc => (
                <li
                  key={loc.id}
                  onClick={() => { setSelectedLocation(loc); setLocationResults([]); }}
                  style={{ padding: '12px 15px', cursor: 'pointer', borderBottom: '1px solid #f9f9f9' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                >
                  {loc.full_name}
                </li>
              ))}
            </ul>
          )}
        </div>

        <input
          type="text"
          placeholder="태그 (쉼표로 구분, 예: 스트릿, 오버핏)"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #eee', marginBottom: '20px' }}
        />

        <div
          onClick={() => !isUploading && document.getElementById('snap-video-file').click()}
          style={{
            border: '2px dashed #ddd', borderRadius: '12px', padding: '40px 20px',
            textAlign: 'center', cursor: 'pointer', background: '#fdfbf9', marginBottom: '24px',
          }}
        >
          {/* ✅ iOS .mov, 삼성 .mp4 모두 포함 */}
          <input
            type="file"
            id="snap-video-file"
            accept="video/*"
            hidden
            onChange={handleFileChange}
          />
          {file ? (
            <div>
              <p style={{ color: '#d16b3c', fontWeight: 'bold' }}>✅ {file.name}</p>
              <p style={{ color: '#999', fontSize: '12px', marginTop: '4px' }}>
                {(file.size / (1024 * 1024)).toFixed(1)} MB · {file.type}
              </p>
            </div>
          ) : (
            <p style={{ color: '#c98e6a' }}>+ 동영상 첨부 (필수)</p>
          )}
        </div>

        {isUploading && (
          <div style={{ marginBottom: '20px' }}>
            <div style={{ width: '100%', height: '8px', background: '#eee', borderRadius: '4px', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${uploadProgress}%`,
                  height: '100%',
                  background: '#d16b3c',
                  transition: 'width 0.3s',
                }}
              />
            </div>
            <p style={{ textAlign: 'center', fontSize: '13px', marginTop: '8px', color: '#d16b3c', fontWeight: 'bold' }}>
              ☁️ 서버로 업로드 중... {uploadProgress}%
            </p>
          </div>
        )}

        <button
          onClick={handleUpload}
          disabled={isUploading}
          style={{
            width: '100%', padding: '16px', borderRadius: '8px', border: 'none',
            background: '#d16b3c', color: '#fff', fontWeight: 'bold', fontSize: '16px',
            cursor: isUploading ? 'default' : 'pointer', opacity: isUploading ? 0.7 : 1,
          }}
        >
          {isUploading ? `업로드 중... ${uploadProgress}%` : '커뮤니티에 게시 ✦'}
        </button>
      </div>
    </div>
  );
}