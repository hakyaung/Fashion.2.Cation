// ==========================================
// 💡 스마트 API URL 자동 설정 로직
// ==========================================
import { ApiError } from './ApiError';

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

// 💡 추가된 기능: 이미지 경로를 안전하게 조합해주는 헬퍼 함수
/** /static/... or https://... -> full URL for <img src> */
export function resolveMediaUrl(pathOrUrl) {
  if (pathOrUrl == null || pathOrUrl === '') return '';
  const s = String(pathOrUrl).trim();
  if (s.startsWith('http://') || s.startsWith('https://')) return s;
  return `${API_URL}${s.startsWith('/') ? s : `/${s}`}`;
}

// ==========================================
// 인증 헬퍼 (원상 복구: 멀쩡하던 피드 에러 해결)
// ==========================================
export function getToken() {
  return localStorage.getItem('stylescape_token');
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
  // q가 존재하고 공백이 아닐 때만 추가 (trim() 안전 처리)
  if (q && String(q).trim()) url += `&q=${encodeURIComponent(String(q).trim())}`;

  const res = await fetch(url, { headers });
  if (!res.ok) throw new ApiError('FEED_LOAD');
  return res.json();
}

// ==========================================
// 프로필 API
// ==========================================
export async function fetchMyPosts() {
  const token = getToken();
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const res = await fetch(`${API_URL}/api/v1/posts/?skip=0&limit=30`, { headers });
  if (!res.ok) throw new ApiError('PROFILE_POSTS_LOAD');
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
  if (!res.ok) throw new ApiError('LIKE_FAILED');
  return res.json(); // { status: 'liked' | 'unliked' }
}

// 💡 추가된 기능: 좋아요 상태 동기화용
export async function ensureLikeApi(postId) {
  const token = getToken();
  const res = await fetch(`${API_URL}/api/v1/posts/${postId}/like/ensure`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new ApiError('LIKE_ENSURE_FAILED');
  return res.json(); // { status: 'liked' | 'already_liked' }
}

// ==========================================
// 댓글 API
// ==========================================
export async function fetchComments(postId) {
  const res = await fetch(`${API_URL}/api/v1/posts/${postId}/comments`);
  if (!res.ok) throw new ApiError('COMMENTS_LOAD');
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
  if (!res.ok) throw new ApiError('COMMENT_POST');
  return res.json();
}

// 💡 추가된 기능: 댓글 수정 API
export async function updateCommentApi(postId, commentId, content) {
  const token = getToken();
  const res = await fetch(`${API_URL}/api/v1/posts/${postId}/comments/${commentId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ content }),
  });
  if (!res.ok) {
    let detail = null;
    try {
      const j = await res.json();
      if (typeof j.detail === 'string') detail = j.detail;
    } catch (e) {}
    throw new ApiError('COMMENT_PATCH', detail);
  }
  return res.json();
}

// 💡 추가된 기능: 댓글 삭제 API
export async function deleteCommentApi(postId, commentId) {
  const token = getToken();
  const res = await fetch(`${API_URL}/api/v1/posts/${postId}/comments/${commentId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    let detail = null;
    try {
      const j = await res.json();
      if (typeof j.detail === 'string') detail = j.detail;
    } catch (e) {}
    throw new ApiError('COMMENT_DELETE', detail);
  }
  return res.json();
}

// ==========================================
// 게시물 작성 API (💡 모바일 사파리 에러 해결)
// ==========================================
export async function uploadPost({ locationId, content, tags, file }) {
  const token = getToken();
  const formData = new FormData();

  // 💡 모든 텍스트 필드를 명시적으로 String() 변환
  //    (모바일에서 숫자/undefined가 들어오면 "The string did not match" 에러 발생)
  formData.append('location_id', String(locationId));
  formData.append('content', String(content));
  if (tags && String(tags).trim()) formData.append('user_tags', String(tags));

  if (file) {
    // 💡 모바일 사파리는 HEIC·특수문자 파일명이 서버 패턴 검증에 걸림
    //    → 파일명을 안전한 ASCII로 강제 교체
    formData.append('file', file, 'safe_image.jpg');
  }

  const res = await fetch(`${API_URL}/api/v1/posts/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });

  if (!res.ok) {
    let detail = null;
    try {
      const err = await res.json();
      if (typeof err.detail === 'string') detail = err.detail;
    } catch (_) {}
    throw new ApiError('POST_UPLOAD', detail);
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
  if (!res.ok) throw new ApiError('POST_EDIT');
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
  if (!res.ok) throw new ApiError('POST_DELETE');
  return true;
}

// ==========================================
// 지역 검색 API
// ==========================================
export async function searchLocations(keyword) {
  const res = await fetch(`${API_URL}/api/v1/locations/search?q=${encodeURIComponent(keyword)}`);
  if (!res.ok) throw new ApiError('LOCATION_SEARCH');
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
  if (!res.ok) {
    let detail = null;
    try {
      const j = await res.json();
      if (typeof j.detail === 'string') detail = j.detail;
    } catch (_) {}
    throw new ApiError('LOGIN_FAILED', detail);
  }
  return res.json(); // { access_token }
}

export async function registerApi(email, nickname, password) {
  const res = await fetch(`${API_URL}/api/v1/users/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, nickname, password }),
  });
  if (!res.ok) {
    let detail = null;
    try {
      const j = await res.json();
      if (typeof j.detail === 'string') detail = j.detail;
    } catch (_) {}
    throw new ApiError('REGISTER_FAILED', detail);
  }
  return res.json();
}

// ==========================================
// 공유 URL
// ==========================================
export function getShareUrl(postId) {
  return `${API_URL}/share/${postId}`;
}

// ==========================================
// 특정 유저 상세 프로필 조회
// ==========================================
export async function fetchUserProfile(userId) {
  const token = getToken();
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const res = await fetch(`${API_URL}/api/v1/users/${userId}/profile`, { headers });
  if (!res.ok) throw new ApiError('USER_PROFILE_LOAD');
  return res.json();
}

// ==========================================
// 내 프로필 수정
// ==========================================
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
  if (!res.ok) throw new ApiError('PROFILE_UPDATE');
  return res.json();
}

// ==========================================
// 팔로우 / 언팔로우 토글
// ==========================================
export async function toggleFollowApi(targetUserId) {
  const token = getToken();
  const res = await fetch(`${API_URL}/api/v1/users/${targetUserId}/follow`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new ApiError('FOLLOW_FAILED');
  return res.json();
}

// ==========================================
// 프로필 이미지 업로드 (💡 모바일 사파리 에러 해결 적용)
// ==========================================
export async function uploadProfileImageApi(file) {
  const token = getToken();
  const formData = new FormData();

  if (file) {
    // 모바일 특수 파일명 강제 교체
    formData.append('file', file, 'safe_profile.jpg');
  }

  const res = await fetch(`${API_URL}/api/v1/users/me/profile-image`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });

  if (!res.ok) throw new ApiError('PROFILE_IMAGE_UPLOAD');
  return res.json();
}

// ==========================================
// 💬 채팅 API
// ==========================================

// 1. 특정 유저와의 채팅방 생성 (또는 기존 방 가져오기)
export async function getOrCreateChatRoom(targetUserId) {
  const token = getToken();
  const currentUserId = getCurrentUserId();
  
  // FastAPI에서는 쿼리 파라미터(?키=값)로 current_user_id를 받도록 설정했습니다.
  const res = await fetch(`${API_URL}/api/v1/chat/room/${targetUserId}?current_user_id=${currentUserId}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new ApiError('CHAT_ROOM');
  return res.json(); // { room_id: 123 }
}

// 2. 과거 채팅 내역 불러오기
export async function fetchChatHistory(roomId) {
  const token = getToken();
  const res = await fetch(`${API_URL}/api/v1/chat/${roomId}/messages`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new ApiError('CHAT_HISTORY');
  return res.json();
}

// ==========================================
// 유저 검색 API (@ 검색용)
// ==========================================
export async function searchUsersApi(keyword) {
  const res = await fetch(`${API_URL}/api/v1/users/search?q=${encodeURIComponent(keyword)}`);
  if (!res.ok) throw new ApiError('USER_SEARCH');
  return res.json();
}

// 💡 채팅방 읽음 처리 API
export const markChatAsRead = async (roomId, currentUserId) => {
  try {
    const res = await fetch(`${API_URL}/api/v1/chat/room/${roomId}/read?current_user_id=${currentUserId}`, {
      method: 'PUT',
    });
    if (!res.ok) throw new ApiError('CHAT_READ');
    return await res.json();
  } catch (error) {
    console.error(error);
  }
};