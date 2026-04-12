// ==========================================
// 💡 스마트 API URL 자동 설정 로직
// ==========================================
function getApiUrl() {
  const host = window.location.hostname;
  if (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host.startsWith('192.168.') ||
    host.startsWith('10.') ||
    host.startsWith('172.')
  ) {
    return `http://${host}:8000`;
  }
  return process.env.REACT_APP_PROD_API_URL || 'https://fashion2cation.co.kr';
}

export const API_URL = getApiUrl();

// ==========================================
// 인증 헬퍼
// ==========================================
export function getToken() {
  const rawToken = localStorage.getItem('stylescape_token');
  if (!rawToken) return null;
  return rawToken.replace(/['"]+/g, '').trim();
}

export function getCurrentUserId() {
  const token = getToken(); 
  if (!token) return null;
  
  try {
    const base64Url = token.split('.')[1];
    if (!base64Url) return null;

    // 1. Base64URL 기호를 표준 Base64 기호로 교체
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');

    // 2. 부족한 패딩(=) 강제 채우기 (4의 배수 맞추기)
    const pad = base64.length % 4;
    const paddedBase64 = pad ? base64 + '='.repeat(4 - pad) : base64;

    // 3. 이제 안전하게 디코딩
    const jsonPayload = decodeURIComponent(
      atob(paddedBase64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );

    return JSON.parse(jsonPayload).sub;
  } catch (e) {
    console.error("ID 추출 중 에러:", e);
    return null;
  }
}

// ==========================================
// 피드 API
// ==========================================
export async function fetchPosts({ skip = 0, limit = 5, sort = 'latest', lat = null, lng = null, q = '' }) {
  const token = getToken();
  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  let url = `${API_URL}/api/v1/posts/?skip=${skip}&limit=${limit}&sort_by=${sort}`;
  if (sort === 'nearby' && lat && lng) url += `&lat=${lat}&lng=${lng}`;
  if (q.trim()) url += `&q=${encodeURIComponent(q.trim())}`;

  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error('피드 로드 실패');
  return res.json();
}

// ==========================================
// 프로필 API
// ==========================================
export async function fetchMyPosts() {
  const token = getToken();
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const res = await fetch(`${API_URL}/api/v1/posts/?skip=0&limit=30`, { headers });
  if (!res.ok) throw new Error('프로필 로드 실패');
  return res.json();
}

// ==========================================
// 좋아요 API
// ==========================================
export async function toggleLikeApi(postId) {
  const token = getToken();
  const res = await fetch(`${API_URL}/api/v1/posts/${postId}/like`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('좋아요 실패');
  return res.json(); // { status: 'liked' | 'unliked' }
}

// ==========================================
// 댓글 API
// ==========================================
export async function fetchComments(postId) {
  const res = await fetch(`${API_URL}/api/v1/posts/${postId}/comments`);
  if (!res.ok) throw new Error('댓글 로드 실패');
  return res.json();
}

export async function postComment(postId, content) {
  const token = getToken();
  const res = await fetch(`${API_URL}/api/v1/posts/${postId}/comments`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ content }),
  });
  if (!res.ok) throw new Error('댓글 작성 실패');
  return res.json();
}

// ==========================================
// 게시물 작성 API
// ==========================================
export async function uploadPost({ locationId, content, tags, file }) {
  // 1. 토큰 강제 세척 (영어, 숫자, 기호 외의 모든 숨겨진 문자 제거)
  let token = getToken();
  if (token) {
    token = String(token).replace(/[^A-Za-z0-9-_=./+]/g, '').trim();
  }

  const formData = new FormData();
  
  // 2. 값들을 명시적으로 문자열로 변환하여 안전하게 추가
  formData.append('location_id', String(locationId));
  formData.append('content', String(content));
  if (tags) formData.append('user_tags', String(tags));

  // 3. 파일 이름 및 객체 세척
  if (file && file instanceof File) {
    const extension = file.name.split('.').pop() || 'jpg';
    // 모바일 특유의 파일명(image:123 등)을 무시하고 안전한 영어 이름으로 고정
    const safeFileName = `post_${Date.now()}.${extension}`;
    formData.append('file', file, safeFileName);
  }

  // 4. URL 공백 및 중복 슬래시 제거
  const targetUrl = `${API_URL}/api/v1/posts/upload`.replace(/([^:]\/)\/+/g, "$1").trim();

  const res = await fetch(targetUrl, {
    method: 'POST',
    headers: { 
      // 💡 헤더 문자열을 한 번 더 trim() 하여 안전하게 전송
      'Authorization': `Bearer ${token}`.trim()
    },
    body: formData, // 주의: Content-Type은 브라우저가 자동 설정하게 둡니다.
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || '업로드 실패');
  }
  return res.json();
}

// ==========================================
// 게시물 수정 API
// ==========================================
export async function editPostApi(postId, { content, user_tags }) {
  const token = getToken();
  const res = await fetch(`${API_URL}/api/v1/posts/${postId}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ content, user_tags }),
  });
  if (!res.ok) throw new Error('수정 권한이 없거나 오류가 발생했습니다.');
  return res.json();
}

// ==========================================
// 게시물 삭제 API
// ==========================================
export async function deletePostApi(postId) {
  const token = getToken();
  const res = await fetch(`${API_URL}/api/v1/posts/${postId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('삭제 권한이 없거나 오류가 발생했습니다.');
  return true;
}

// ==========================================
// 지역 검색 API
// ==========================================
export async function searchLocations(keyword) {
  const res = await fetch(`${API_URL}/api/v1/locations/search?q=${encodeURIComponent(keyword)}`);
  if (!res.ok) throw new Error('지역 검색 실패');
  return res.json();
}

// ==========================================
// 로그인 / 회원가입 API
// ==========================================
export async function loginApi(email, password) {
  const formData = new URLSearchParams();
  formData.append('username', email);
  formData.append('password', password);

  const res = await fetch(`${API_URL}/api/v1/users/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formData,
  });
  if (!res.ok) throw new Error('이메일이나 비밀번호가 틀렸습니다.');
  return res.json(); // { access_token }
}

export async function registerApi(email, nickname, password) {
  const res = await fetch(`${API_URL}/api/v1/users/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, nickname, password }),
  });
  if (!res.ok) throw new Error('회원가입에 실패했습니다.');
  return res.json();
}

// ==========================================
// 공유 URL
// ==========================================
export function getShareUrl(postId) {
  return `${API_URL}/share/${postId}`;
}

// 특정 유저의 상세 프로필 정보 가져오기
export async function fetchUserProfile(userId) {
  const token = getToken();
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const res = await fetch(`${API_URL}/api/v1/users/${userId}/profile`, { headers });
  if (!res.ok) throw new Error('프로필 로드 실패');
  return res.json();
}

// 내 프로필 수정하기
export async function updateProfileApi(profileData) {
  const token = getToken();
  const res = await fetch(`${API_URL}/api/v1/users/me/profile`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(profileData),
  });
  if (!res.ok) throw new Error('프로필 업데이트 실패');
  return res.json();
}

// 팔로우/언팔로우 토글
export async function toggleFollowApi(targetUserId) {
  const token = getToken();
  const res = await fetch(`${API_URL}/api/v1/users/${targetUserId}/follow`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('팔로우 처리 실패');
  return res.json();
}

export async function uploadProfileImageApi(file) {
  const token = getToken();
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${API_URL}/api/v1/users/me/profile-image`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      // 💡 주의: FormData를 보낼 때는 'Content-Type'을 수동으로 설정하지 않습니다!
    },
    body: formData,
  });

  if (!res.ok) throw new Error('이미지 업로드 실패');
  return res.json();
}