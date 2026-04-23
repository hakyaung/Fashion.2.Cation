// frontend_react/src/components/snaps/SnapUpload.jsx
import React, { useState, useEffect, useRef } from 'react';
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { storage } from '../../firebase'; 
import { useAuth } from '../../context/Authcontext';

// 💡 [추가] 동영상 압축 라이브러리 임포트
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';

export default function SnapUpload({ onUploadComplete }) {
  const { currentUserId } = useAuth();
  
  // 1. 입력 필드 상태 관리
  const [content, setContent] = useState('');
  const [tags, setTags] = useState('');
  
  // 2. 지역 검색 관련 상태
  const [locationSearch, setLocationSearch] = useState('');
  const [locationResults, setLocationResults] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [isSearching, setIsSearching] = useState(false);

  // 3. 파일 및 업로드 상태
  const [file, setFile] = useState(null);
  
  // 💡 [수정] 압축과 업로드 상태를 분리하여 디테일한 진행률 표시
  const [isCompressing, setIsCompressing] = useState(false);
  const [compressProgress, setCompressProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // 💡 [추가] FFmpeg 인스턴스 보관용 Ref
  const ffmpegRef = useRef(new FFmpeg());

  const currentProtocol = window.location.protocol;
  const currentHost = window.location.hostname;
  const API_BASE_URL = currentProtocol === 'https:'
    ? `https://${currentHost}`
    : `http://${currentHost}:8000`;

  // 실시간 지역 검색 로직 (유지)
  useEffect(() => {
    const searchLocation = async () => {
      if (locationSearch.length < 2 || selectedLocation) {
        setLocationResults([]);
        return;
      }

      try {
        setIsSearching(true);
        const response = await fetch(`${API_BASE_URL}/api/v1/locations/search?q=${encodeURIComponent(locationSearch)}`);
        if (response.ok) {
          const data = await response.json();
          setLocationResults(data);
        }
      } catch (error) {
        console.error("지역 검색 실패:", error);
      } finally {
        setIsSearching(false);
      }
    };

    const timer = setTimeout(searchLocation, 400); // 디바운싱
    return () => clearTimeout(timer);
  }, [locationSearch, selectedLocation, API_BASE_URL]);

  const handleFileChange = (e) => {
    if (e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (!selectedFile.type.startsWith('video/')) {
        alert('영상 파일만 업로드 가능합니다!');
        return;
      }
      setFile(selectedFile);
    }
  };

  // 🚀 [추가] 폰에서 직접 동영상을 압축하는 마법의 함수
  const compressVideo = async (videoFile) => {
    setIsCompressing(true);
    setCompressProgress(0);
    try {
      const ffmpeg = ffmpegRef.current;
      
      if (!ffmpeg.loaded) {
        await ffmpeg.load();
      }

      ffmpeg.on('progress', ({ progress }) => {
        setCompressProgress(Math.round(progress * 100));
      });

      await ffmpeg.writeFile('input.mov', await fetchFile(videoFile));

      // 용량은 확 줄이고 속도는 가장 빠르게! (.mp4로 강제 변환)
      await ffmpeg.exec([
        '-i', 'input.mov',
        '-vcodec', 'libx264',
        '-crf', '28', 
        '-preset', 'ultrafast', 
        'output.mp4'
      ]);

      const data = await ffmpeg.readFile('output.mp4');
      const compressedBlob = new Blob([data.buffer], { type: 'video/mp4' });
      const compressedFile = new File([compressedBlob], `compressed_${Date.now()}.mp4`, { type: 'video/mp4' });

      return compressedFile;
    } catch (error) {
      console.error("비디오 압축 실패:", error);
      // 압축 실패 시 에러 내지 않고 쿨하게 원본 파일로 리턴
      return videoFile; 
    } finally {
      setIsCompressing(false);
    }
  };

  const handleUpload = async () => {
    if (!file) return alert("동영상을 선택해 주세요!");
    if (!content.trim()) return alert("패션에 대한 이야기를 적어주세요!");
    if (!selectedLocation) return alert("지역을 검색하여 선택해 주세요!");

    try {
      // 🚀 1단계: 동영상 압축 (여기서 시간이 조금 걸릴 수 있습니다)
      const fileToUpload = await compressVideo(file);

      // 🚀 2단계: 파이어베이스 스토리지 업로드 시작
      setIsUploading(true);
      setUploadProgress(0);
      
      // 파일명 끝을 무조건 .mp4로 고정 (아이폰 호환성 극대화)
      const fileName = `snaps/${currentUserId}_${Date.now()}.mp4`;
      const storageRef = ref(storage, fileName);
      const uploadTask = uploadBytesResumable(storageRef, fileToUpload);

      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const p = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress(Math.round(p));
        },
        (error) => {
          console.error(error);
          alert("파이어베이스 업로드 실패!");
          setIsUploading(false);
        },
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);

          // 🚀 3단계: 백엔드 DB 저장
          const token = localStorage.getItem('stylescape_token');
          const response = await fetch(`${API_BASE_URL}/api/v1/posts/snaps`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              video_url: downloadURL,
              content: content,
              location_id: selectedLocation.id, 
              tags: tags
            })
          });

          if (response.ok) {
            alert("스냅이 성공적으로 게시되었습니다! 🎬");
            if (onUploadComplete) onUploadComplete();
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

  // 작업 진행 중인지 확인 (압축 중이거나 업로드 중일 때)
  const isWorking = isCompressing || isUploading;

  return (
    <div className="snap-upload-wrapper" style={{ maxWidth: '650px', margin: '0 auto', padding: '20px' }}>
      <div className="widget" style={{ background: '#fff', borderRadius: '12px', padding: '30px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '8px' }}>새 스냅</h2>
        <p style={{ color: '#666', fontSize: '14px', marginBottom: '24px' }}>
          영상과 함께 당신의 스타일을 자유롭게 공유해 보세요.
        </p>

        {/* 1. 본문 입력 */}
        <textarea
          placeholder="어떤 스타일인가요? 패션에 대한 이야기를 자유롭게 적어주세요."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          style={{
            width: '100%', height: '150px', padding: '15px', borderRadius: '8px',
            border: '1px solid #eee', background: '#fcfcfc', marginBottom: '16px', resize: 'none'
          }}
        />

        {/* 2. 지역 검색 */}
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
          
          {/* 검색 결과 드롭다운 */}
          {locationResults.length > 0 && (
            <ul style={{
              position: 'absolute', top: '100%', left: 0, width: '100%', background: '#fff',
              border: '1px solid #eee', borderRadius: '0 0 8px 8px', zIndex: 10, listStyle: 'none', padding: 0
            }}>
              {locationResults.map(loc => (
                <li 
                  key={loc.id} 
                  onClick={() => {
                    setSelectedLocation(loc);
                    setLocationResults([]);
                  }}
                  style={{ padding: '12px 15px', cursor: 'pointer', borderBottom: '1px solid #f9f9f9' }}
                  onMouseEnter={(e) => e.target.style.background = '#f5f5f5'}
                  onMouseLeave={(e) => e.target.style.background = 'none'}
                >
                  {loc.full_name}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* 3. 태그 입력 */}
        <input
          type="text"
          placeholder="태그 (쉼표로 구분, 예: 스트릿, 오버핏)"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #eee', marginBottom: '20px' }}
        />

        {/* 4. 동영상 첨부 영역 */}
        <div
          onClick={() => !isWorking && document.getElementById('snap-video-file').click()}
          style={{
            border: '2px dashed #ddd', borderRadius: '12px', padding: '40px 20px',
            textAlign: 'center', cursor: 'pointer', background: '#fdfbf9', marginBottom: '24px'
          }}
        >
          {/* 💡 [핵심] 아이폰 포맷 완벽 지원 */}
          <input 
            type="file" 
            id="snap-video-file" 
            accept="video/*, video/mp4, video/quicktime, .mov, .MOV" 
            hidden 
            onChange={handleFileChange} 
          />
          {file ? (
            <p style={{ color: '#d16b3c', fontWeight: 'bold' }}>✅ {file.name}</p>
          ) : (
            <p style={{ color: '#c98e6a' }}>+ 동영상 첨부 (필수)</p>
          )}
        </div>

        {/* 5. 💡 통합 진행바 (압축 & 업로드) */}
        {isWorking && (
          <div style={{ marginBottom: '20px' }}>
            <div style={{ width: '100%', height: '8px', background: '#eee', borderRadius: '4px', overflow: 'hidden' }}>
              <div 
                style={{ 
                  width: `${isCompressing ? compressProgress : uploadProgress}%`, 
                  height: '100%', 
                  background: isCompressing ? '#4CAF50' : '#d16b3c', // 압축: 초록색, 업로드: 주황색
                  transition: 'width 0.3s' 
                }} 
              />
            </div>
            <p style={{ textAlign: 'center', fontSize: '13px', marginTop: '8px', color: isCompressing ? '#4CAF50' : '#d16b3c', fontWeight: 'bold' }}>
              {isCompressing 
                ? `🔥 영상 용량 압축 중... ${compressProgress}%` 
                : `☁️ 서버로 업로드 중... ${uploadProgress}%`}
            </p>
          </div>
        )}

        <button
          onClick={handleUpload}
          disabled={isWorking}
          style={{
            width: '100%', padding: '16px', borderRadius: '8px', border: 'none',
            background: '#d16b3c', color: '#fff', fontWeight: 'bold', fontSize: '16px',
            cursor: isWorking ? 'default' : 'pointer', opacity: isWorking ? 0.7 : 1
          }}
        >
          {isWorking ? '처리 중...' : '커뮤니티에 게시 ✦'}
        </button>
      </div>
    </div>
  );
}