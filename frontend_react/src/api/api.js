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
  return localStorage.getItem('stylescape_token');
  if (!token) return null;
  // 따옴표 제거 및 앞뒤 공백 제거 (모바일 사파리 에러 방지 핵심)
  return token.replace(/['"]+/g, '').trim();
}

export function getCurrentUserId() {
  const token = getToken();
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.sub;
  } catch (e) {
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
  // 1. 토큰 세척: 모바일에서 따옴표가 포함되어 fetch가 거절되는 현상 방지
  let token = getToken();
  if (token) token = token.replace(/['"]+/g, '').trim();

  const formData = new FormData();
  formData.append('location_id', locationId);
  formData.append('content', content);
  
  if (tags) formData.append('user_tags', tags);

  // 2. 파일 이름 세척: 모바일 특유의 파일명 패턴(image:123 등)으로 인한 에러 방지
  if (file) {
    const extension = file.name.split('.').pop() || 'jpg';
    const safeName = `upload_${Date.now()}.${extension}`;
    // 세 번째 인자로 안전한 이름을 넘겨주면 "The string did not match..." 에러가 사라집니다.
    formData.append('file', file, safeName);
  }

  const res = await fetch(`${API_URL}/api/v1/posts/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData, // FormData를 보낼 땐 Content-Type을 수동으로 넣지 마세요!
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