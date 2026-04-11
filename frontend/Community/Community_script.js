//const API_URL = "http://192.168.35.158:8000"; //집
//const API_URL = "http://10.20.102.78:8000"; //학교
//const API_URL = "http://172.20.10.2:8000"; //휴대폰
//const API_URL = "http://fashion2cation.co.kr"; //구매한 도메인

// ==========================================
// 💡 스마트 API URL 자동 설정 로직
// ==========================================
let API_URL;
const currentHost = window.location.hostname;

// 1. 로컬(노트북)이거나 내부망(핸드폰 와이파이 192.168~, 10.~, 172.~) 접속인지 확인
if (
  currentHost === 'localhost' || 
  currentHost === '127.0.0.1' || 
  currentHost.startsWith('192.168.') || 
  currentHost.startsWith('10.') || 
  currentHost.startsWith('172.')
) {
  // 노트북이든 핸드폰이든, 현재 접속한 그 주소의 8000번 포트로 연결!
  API_URL = `http://${currentHost}:8000`; 
} 
// 2. 그 외 (진짜 외부에서 도메인으로 접속했을 때)
else {
  // 실제 AWS 서버 주소
  API_URL = "https://fashion2cation.co.kr";
}

// DOM Elements
const viewHome = document.getElementById('view-home');
const viewProfile = document.getElementById('view-profile');
const menuHome = document.getElementById('menu-home');
const menuProfile = document.getElementById('menu-profile');

let skip = 0;
const limit = 5; 
let isLoading = false;
let hasMoreData = true; 

let currentSearchKeyword = ""; 
let searchTimer;

let currentSort = "latest";
let searchTimeout;

let userLat = null;
let userLng = null;

let locationSelected = false; // 지역 선택 추적

// ==========================================
// 0. 모바일 레이아웃 강제 적용
// ==========================================
function fixMobileLayout() {
  if (window.innerWidth <= 768) {
    const layout = document.getElementById('communityLayout');
    if (layout) {
      layout.style.cssText = 'display:block !important; width:100% !important; max-width:100% !important; margin-top:54px !important; padding:12px 12px 80px 12px !important; box-sizing:border-box !important;';
    }
    const feed = document.querySelector('.center-feed');
    if (feed) {
      feed.style.cssText = 'width:100% !important; max-width:100% !important; min-width:0 !important; box-sizing:border-box !important;';
    }
  }
}
fixMobileLayout();
window.addEventListener('resize', fixMobileLayout);

// ==========================================
// 1. 메뉴 탭 전환 로직 (홈 <-> 프로필)
// ==========================================
menuHome.addEventListener('click', (e) => {
  e.preventDefault();
  menuHome.classList.add('active');
  menuProfile.classList.remove('active');
  viewProfile.style.display = 'none';
  viewHome.style.display = 'block';
  
  document.getElementById('feed-container').innerHTML = '';
  skip = 0; hasMoreData = true;
  loadCommunityFeed();
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

menuProfile.addEventListener('click', (e) => {
  e.preventDefault();
  if (!localStorage.getItem('stylescape_token')) {
    alert("프로필을 보려면 로그인이 필요합니다.");
    openAuthModal('login');
    return;
  }
  menuProfile.classList.add('active');
  menuHome.classList.remove('active');
  viewHome.style.display = 'none';
  viewProfile.style.display = 'block';
  
  loadProfileData();
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

// ==========================================
// 2. 피드 초기화 유틸리티 함수
// ==========================================
function resetFeed() {
  skip = 0;
  hasMoreData = true;
  document.getElementById('feed-container').innerHTML = '';
}

// ==========================================
// 3. 홈: 무한 스크롤 피드 로직
// ==========================================
async function loadCommunityFeed() {
  if (isLoading || !hasMoreData) return;
  isLoading = true;
  document.getElementById('loading-indicator').style.display = 'block';

  try {
    const token = localStorage.getItem('stylescape_token');
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    let url = `${API_URL}/api/v1/posts/?skip=${skip}&limit=${limit}&sort_by=${currentSort}`;

    if (currentSort === 'nearby' && userLat && userLng) {
      url += `&lat=${userLat}&lng=${userLng}`;
    }

    if (currentSearchKeyword.trim() !== "") {
      url += `&q=${encodeURIComponent(currentSearchKeyword.trim())}`;
    }

    const response = await fetch(url, { headers: headers });
    const posts = await response.json();

    if (posts.length < limit) {
      hasMoreData = false;
      document.getElementById('loading-indicator').innerHTML = posts.length === 0 && skip === 0
        ? "찾으시는 스타일이 아직 없네요! 🌿"
        : "마지막 스타일입니다. ✦";
    } else {
      document.getElementById('loading-indicator').style.display = 'none';
    }

    renderCommunityPosts(posts);
    skip += limit;
  } catch (error) {
    document.getElementById('loading-indicator').innerHTML = "데이터 로드 실패";
  } finally {
    isLoading = false;
  }
}

// ==========================================
// 4. 태그 클릭 검색 함수
// ==========================================
function searchByTag(tag) {
  const keyword = tag.replace('#', '').trim();
  const searchBar = document.getElementById('feedSearchInput');
  if (searchBar) {
    searchBar.value = keyword;
    currentSearchKeyword = keyword;
    resetFeed();
    changeSort('latest');
  }
}

// ==========================================
// 5. 피드 렌더링
// ==========================================
function renderCommunityPosts(posts) {
  const container = document.getElementById('feed-container');

  posts.forEach(post => {
    const card = document.createElement('div');
    card.className = 'post-card';

    const hasImage = post.image_url && post.image_url.trim() !== "";
    const imageHtml = hasImage
      ? `<div class="post-image-container"><img src="${API_URL}${post.image_url}" class="post-img" alt="Fashion Post"></div>`
      : "";

    let tagsHtml = "";
    if (post.tags && post.tags.length > 0) {
      tagsHtml = `
        <div class="post-tags-container" style="margin: 12px 0; display: flex; flex-wrap: wrap; gap: 6px;">
          ${post.tags.map(tag => `
            <span class="post-hashtag" onclick="searchByTag('${tag}')" style="font-size: 12px; color: var(--rust); background: rgba(181, 97, 66, 0.08); padding: 4px 10px; border-radius: 20px; font-weight: 500; cursor: pointer;">
              ${tag}
            </span>
          `).join('')}
        </div>
      `;
    }

    const aiBadge = hasImage
      ? (post.ai_status === 'pending' ? '분석 중' : 'AI 분석완료')
      : '텍스트 게시물';

    const likeIcon = post.is_liked ? '♥' : '♡';
    const likeStyle = post.is_liked ? 'color: var(--rust); font-weight: 600;' : '';

    card.innerHTML = `
      <div class="post-header">
        <div class="post-meta"><span class="post-author">By. ${post.author}</span><span>•</span><span>${new Date(post.created_at).toLocaleDateString('ko-KR')}</span></div>
        <div class="post-region-wrapper">
          <div class="post-region">${post.location}</div>
          <button class="post-menu-btn" onclick="togglePostMenu('${post.id}')">⋮</button>
          <div id="post-menu-${post.id}" class="post-dropdown">
            <button onclick="editPost('${post.id}')">수정</button>
            <button onclick="deletePost('${post.id}')" class="delete-text">삭제</button>
          </div>
        </div>
      </div>
      <h2 class="post-title" style="font-size: ${hasImage ? '16px' : '20px'}; margin-bottom: 12px;">${post.content}</h2>
      
      ${imageHtml}
      
      ${tagsHtml}

      <div class="post-actions" style="border-top: 1px solid rgba(0,0,0,0.05); padding-top: 12px;">
        <button class="action-btn btn-like" data-id="${post.id}" onclick="toggleLike('${post.id}', this)" style="${likeStyle}">
          <span class="icon">${likeIcon}</span> 좋아요 <b class="like-cnt">${post.like_count}</b>
        </button>
        <button class="action-btn btn-comment" data-id="${post.id}" onclick="openComments('${post.id}')">
          <span>💬</span> 댓글 <b class="comment-cnt">${post.comment_count}</b>
        </button>
        
        <button class="action-btn btn-share" onclick="sharePost('${post.id}')">
          <span>⎋</span> 공유
        </button>

        <button class="action-btn" style="cursor: default;">
          <span>⟡</span> ${aiBadge}
        </button>
      </div>
    `;
    container.appendChild(card);
  });
  bindCursorEventsToNewElements();
}

window.addEventListener('scroll', () => {
  if (viewHome.style.display !== 'none') {
    const { scrollTop, scrollHeight, clientHeight } = document.documentElement;
    if (scrollTop + clientHeight >= scrollHeight - 200) loadCommunityFeed();
  }
});

// ==========================================
// 6. 프로필: 데이터 로직
// ==========================================
async function loadProfileData() {
  try {
    const token = localStorage.getItem('stylescape_token');
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch(`${API_URL}/api/v1/posts/?skip=0&limit=30`, {
      method: 'GET',
      headers: headers
    });

    const posts = await response.json();

    if (posts.length > 0) {
      document.getElementById('profile-nickname-display').innerText = posts[0].author;
    }
    document.getElementById('profile-post-count').innerText = posts.length;

    const gridContainer = document.getElementById('profile-grid-container');
    gridContainer.innerHTML = '';

    posts.forEach(post => {
      if (post.image_url && post.image_url.trim() !== "") {
        const item = document.createElement('div');
        item.className = 'grid-item';

        const likeCount = post.like_count || 0;
        const commentCount = post.comment_count || 0;
        const isLiked = post.is_liked;

        item.innerHTML = `
          <img src="${API_URL}${post.image_url}" alt="Post">
          <div class="grid-overlay">
            <span style="${isLiked ? 'color: var(--rust); font-weight: bold;' : ''}">
              ${isLiked ? '♥' : '♡'} ${likeCount}
            </span>
            <span>💬 ${commentCount}</span>
          </div>
        `;
        gridContainer.appendChild(item);
      }
    });

    bindCursorEventsToNewElements();

  } catch (error) {
    console.error("프로필 로드 실패", error);
  }
}

// ==========================================
// 7. 정렬 변경 함수
// ==========================================
function changeSort(newSort) {
  if (currentSort === newSort && skip !== 0) return;

  currentSort = newSort;
  resetFeed();

  const sortLatestBtn = document.getElementById('head-sort-latest');
  const sortPopularBtn = document.getElementById('head-sort-popular');

  if (sortLatestBtn && sortPopularBtn) {
    if (newSort === 'latest') {
      sortLatestBtn.classList.add('active');
      sortPopularBtn.classList.remove('active');
    } else {
      sortPopularBtn.classList.add('active');
      sortLatestBtn.classList.remove('active');
    }
  }

  const sideLatest = document.getElementById('side-filter-latest');
  const sidePopular = document.getElementById('side-filter-popular');

  if (sideLatest && sidePopular) {
    if (newSort === 'latest') {
      sideLatest.classList.add('active');
      sidePopular.classList.remove('active');
    } else {
      sidePopular.classList.add('active');
      sideLatest.classList.remove('active');
    }
  }

  loadCommunityFeed();
}

// ==========================================
// 8. 인증(Auth) 모달 로직
// ==========================================
function checkAuthStatus() {
  const token = localStorage.getItem('stylescape_token');
  const navLoginBtn = document.getElementById('navLoginBtn');
  navLoginBtn.textContent = token ? '로그아웃' : '로그인';
}

const authModal = document.getElementById('authModal');
let isLoginMode = true;

function openAuthModal(mode = 'login') {
  authModal.classList.add('active');
  isLoginMode = (mode === 'login');
  updateAuthUI();
}

document.getElementById('closeAuthModal').addEventListener('click', () => {
  authModal.classList.remove('active');
  document.getElementById('authForm').reset();
});

document.getElementById('navLoginBtn').addEventListener('click', (e) => {
  e.preventDefault();
  if (localStorage.getItem('stylescape_token')) {
    if (confirm("로그아웃 하시겠습니까?")) {
      localStorage.removeItem('stylescape_token');
      checkAuthStatus();
      menuHome.click();
    }
  } else { openAuthModal('login'); }
});

function updateAuthUI() {
  document.getElementById('authTitle').textContent = isLoginMode ? 'Login' : 'Register';
  document.getElementById('authSubmitBtn').textContent = isLoginMode ? '로그인 ✦' : '회원가입 ✦';
  document.getElementById('authToggleBtn').textContent = isLoginMode ? '회원가입' : '로그인';

  const nicknameField = document.getElementById('authNickname');
  if (isLoginMode) {
    nicknameField.style.display = 'none';
    nicknameField.removeAttribute('required');
  } else {
    nicknameField.style.display = 'block';
    nicknameField.setAttribute('required', 'true');
  }
}

document.getElementById('authToggleBtn').addEventListener('click', (e) => {
  e.preventDefault();
  isLoginMode = !isLoginMode;
  updateAuthUI();
});

document.getElementById('authForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('authEmail').value;
  const password = document.getElementById('authPassword').value;

  if (isLoginMode) {
    const formData = new URLSearchParams();
    formData.append('username', email);
    formData.append('password', password);
    try {
      const res = await fetch(`${API_URL}/api/v1/users/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData
      });
      if (res.ok) {
        const data = await res.json();
        localStorage.setItem('stylescape_token', data.access_token);
        alert("로그인 성공!");
        authModal.classList.remove('active');
        checkAuthStatus();
      } else { alert("이메일이나 비밀번호가 틀렸습니다."); }
    } catch (e) { alert("서버 연결 실패."); }
  } else {
    const nickname = document.getElementById('authNickname').value;
    try {
      const res = await fetch(`${API_URL}/api/v1/users/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, nickname, password })
      });
      if (res.ok) {
        alert("회원가입 성공! 이제 로그인해주세요.");
        isLoginMode = true;
        updateAuthUI();
        document.getElementById('authPassword').value = '';
      } else { alert("가입 실패"); }
    } catch (e) { alert("서버 연결 실패"); }
  }
});

// ==========================================
// 9. 글쓰기(Post) 모달 로직
// ==========================================
const postModal = document.getElementById('postModal');

document.getElementById('openPostModalBtn').addEventListener('click', () => {
  if (!localStorage.getItem('stylescape_token')) {
    alert("글을 작성하려면 로그인이 필요합니다.");
    openAuthModal('login');
    return;
  }
  postModal.classList.add('active');
});

document.getElementById('closePostModal').addEventListener('click', () => {
  postModal.classList.remove('active');
  document.getElementById('postForm').reset();
  document.getElementById('fileNameDisplay').textContent = "선택된 파일 없음";
  resetImagePreview();
  locationSelected = false;
  document.getElementById('locationSearchInput').value = '';
  document.getElementById('postLocation').value = '';
});

// ==========================================
// 10. 이미지 미리보기 기능
// ==========================================
const postFileInput = document.getElementById('postFile');
const imagePreviewContainer = document.getElementById('imagePreviewContainer');
const imagePreview = document.getElementById('imagePreview');
const fileNameDisplay = document.getElementById('fileNameDisplay');
const removePreviewBtn = document.getElementById('removePreviewBtn');

function resetImagePreview() {
  if (postFileInput) postFileInput.value = "";
  if (imagePreview) imagePreview.src = "";
  if (imagePreviewContainer) imagePreviewContainer.style.display = 'none';
  if (fileNameDisplay) fileNameDisplay.textContent = "선택된 파일 없음";
}

if (postFileInput) {
  postFileInput.addEventListener('change', function (e) {
    const file = e.target.files[0];
    const fileName = file ? file.name : "선택된 파일 없음";
    if (fileNameDisplay) fileNameDisplay.textContent = fileName;

    if (file) {
      const reader = new FileReader();
      reader.onload = function (e) {
        if (imagePreview) imagePreview.src = e.target.result;
        if (imagePreviewContainer) imagePreviewContainer.style.display = 'block';
      };
      reader.readAsDataURL(file);
    } else {
      resetImagePreview();
    }
  });
}

if (removePreviewBtn) {
  removePreviewBtn.addEventListener('click', function () {
    resetImagePreview();
  });
}

// ==========================================
// 💡 11. 지역 검색 자동완성 로직 (버그 수정 완료)
// ==========================================
const searchInput = document.getElementById('locationSearchInput');
const hiddenLocationId = document.getElementById('postLocation');
const dropdown = document.getElementById('locationDropdown');

if (searchInput) {
  searchInput.addEventListener('input', (e) => {
    const keyword = e.target.value.trim();

    locationSelected = false;
    if (hiddenLocationId) hiddenLocationId.value = "";

    if (keyword.length < 1) {
      if (dropdown) dropdown.style.display = 'none';
      return;
    }

    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(async () => {
      try {
        const response = await fetch(`${API_URL}/api/v1/locations/search?q=${encodeURIComponent(keyword)}`);

        if (!response.ok) throw new Error('검색 실패');

        const results = await response.json();

        if (!dropdown) return;
        dropdown.innerHTML = '';
        dropdown.style.display = 'block';

        if (!results || results.length === 0) {
          dropdown.innerHTML = '<li class="empty-result">검색 결과가 없습니다.</li>';
          return;
        }

        results.forEach(loc => {
          const li = document.createElement('li');
          li.textContent = loc.full_name;
          li.style.cursor = 'pointer';

          // 💡 수정: 모바일 키보드가 내려가면서 발생하는 씹힘 방지
          li.addEventListener('mousedown', (e) => {
            e.preventDefault(); // 인풋창 포커스 상실 방지
            selectLocation(loc);
          });
          
          // 💡 수정: 터치 환경에서 확실한 클릭 보장
          li.addEventListener('click', (e) => {
            selectLocation(loc);
          });

          dropdown.appendChild(li);
        });

      } catch (error) {
        console.error("지역 검색 실패", error);
        if (dropdown) {
          dropdown.innerHTML = '<li class="empty-result">검색 중 오류가 발생했습니다.</li>';
          dropdown.style.display = 'block';
        }
      }
    }, 300);
  });

  // 💡 수정: 모바일에서 클릭을 방해하던 blur 이벤트 삭제! 
  // 대신 아래 document.addEventListener('click')이 밖을 누를 때 닫아줍니다.

  // 포커스 시 기존 내용 있으면 다시 표시
  searchInput.addEventListener('focus', (e) => {
    const keyword = e.target.value.trim();
    if (keyword.length > 0 && !locationSelected && dropdown && dropdown.innerHTML !== '') {
      dropdown.style.display = 'block';
    }
  });
}

function selectLocation(loc) {
  if (searchInput) searchInput.value = loc.full_name;
  if (hiddenLocationId) hiddenLocationId.value = loc.id;
  if (dropdown) dropdown.style.display = 'none';
  locationSelected = true;
}

// 검색창 밖 또는 메뉴 밖 클릭 시 드롭다운 닫기
document.addEventListener('click', (e) => {
  // 1. 지역 검색 드롭다운 닫기
  if (searchInput && dropdown) {
    if (!searchInput.contains(e.target) && !dropdown.contains(e.target)) {
      dropdown.style.display = 'none';
    }
  }
  
  // 2. 게시물 우측 메뉴 드롭다운 닫기 (메뉴 버튼을 누른 게 아니라면)
  if (!e.target.closest('.post-region-wrapper')) {
    document.querySelectorAll('.post-dropdown').forEach(menu => {
      menu.classList.remove('active');
    });
  }
});

// ==========================================
// 12. 글 제출 로직
// ==========================================
document.getElementById('postForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const token = localStorage.getItem('stylescape_token');
  if (!token) return;

  // 지역 선택 유효성 검사
  const locationIdValue = document.getElementById('postLocation').value;
  if (!locationIdValue || locationIdValue.trim() === '') {
    alert("지역을 검색하고 목록에서 선택해주세요.");
    document.getElementById('locationSearchInput').focus();
    return;
  }

  const formData = new FormData();
  formData.append('location_id', locationIdValue);
  formData.append('content', document.getElementById('postContent').value);

  const tags = document.getElementById('postTags').value;
  if (tags) formData.append('user_tags', tags);

  if (postFileInput && postFileInput.files.length > 0) {
    formData.append('file', postFileInput.files[0]);
  }

  try {
    const res = await fetch(`${API_URL}/api/v1/posts/upload`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData
    });

    if (res.ok) {
      alert("성공적으로 게시되었습니다!");
      postModal.classList.remove('active');
      document.getElementById('postForm').reset();
      resetImagePreview();
      locationSelected = false;
      document.getElementById('locationSearchInput').value = '';
      document.getElementById('postLocation').value = '';
      menuHome.click();
    } else {
      const err = await res.json();
      alert(`업로드 실패: ${err.detail}`);
    }
  } catch (error) { alert("서버 통신 오류."); }
});

// ==========================================
// 13. 마우스 커서 인터랙션
// ==========================================
const cursor = document.getElementById('cursor');
const follower = document.getElementById('cursorFollower');
let mouseX = 0, mouseY = 0, followerX = 0, followerY = 0;

document.addEventListener('mousemove', (e) => {
  mouseX = e.clientX;
  mouseY = e.clientY;
  if (cursor) {
    cursor.style.left = mouseX + 'px';
    cursor.style.top = mouseY + 'px';
  }
});

function animateFollower() {
  followerX += (mouseX - followerX) * 0.1;
  followerY += (mouseY - followerY) * 0.1;
  if (follower) {
    follower.style.left = followerX + 'px';
    follower.style.top = followerY + 'px';
  }
  requestAnimationFrame(animateFollower);
}
animateFollower();

function bindCursorEventsToNewElements() {
  if (window.matchMedia("(pointer: fine)").matches) {
    document.querySelectorAll('a, button, .post-card, .grid-item, label, .post-hashtag').forEach(el => {
      el.onmouseenter = () => {
        if (cursor) {
          cursor.style.transform = 'translate(-50%, -50%) scale(1.6)';
          cursor.style.background = 'var(--gold)';
        }
      };
      el.onmouseleave = () => {
        if (cursor) {
          cursor.style.transform = 'translate(-50%, -50%) scale(1)';
          cursor.style.background = 'var(--rust)';
        }
      };
    });
  }
}

// ==========================================
// 14. 좋아요 기능
// ==========================================
async function toggleLike(postId, btnElement) {
  const token = localStorage.getItem('stylescape_token');
  if (!token) {
    alert("좋아요를 누르려면 로그인이 필요합니다.");
    openAuthModal('login');
    return;
  }

  try {
    const res = await fetch(`${API_URL}/api/v1/posts/${postId}/like`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (res.ok) {
      const data = await res.json();
      const icon = btnElement.querySelector('.icon');
      const cntElement = btnElement.querySelector('.like-cnt');
      let currentCnt = parseInt(cntElement.innerText);

      if (data.status === 'liked') {
        icon.innerText = '♥';
        btnElement.style.color = 'var(--rust)';
        btnElement.style.fontWeight = '600';
        cntElement.innerText = currentCnt + 1;
      } else {
        icon.innerText = '♡';
        btnElement.style.color = 'rgba(26,22,18,0.6)';
        btnElement.style.fontWeight = 'normal';
        cntElement.innerText = Math.max(0, currentCnt - 1);
      }
    }
  } catch (err) { console.error("좋아요 오류", err); }
}

// ==========================================
// 15. 댓글 모달
// ==========================================
const commentModal = document.getElementById('commentModal');
const commentList = document.getElementById('commentList');

async function openComments(postId) {
  document.getElementById('currentCommentPostId').value = postId;
  commentList.innerHTML = '<div style="text-align:center; color:#999; margin-top:20px;">댓글을 불러오는 중...</div>';
  commentModal.classList.add('active');

  try {
    const res = await fetch(`${API_URL}/api/v1/posts/${postId}/comments`);
    const comments = await res.json();

    commentList.innerHTML = '';
    if (comments.length === 0) {
      commentList.innerHTML = '<div style="text-align:center; color:#999; margin-top:20px;">아직 댓글이 없습니다. 첫 댓글을 남겨보세요!</div>';
      return;
    }

    comments.forEach(c => {
      const dateStr = new Date(c.created_at).toLocaleDateString('ko-KR');
      commentList.innerHTML += `
        <div style="margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px dashed rgba(0,0,0,0.05);">
          <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
            <strong style="color:var(--warm-black); font-size:13px;">${c.author}</strong>
            <span style="font-size:11px; color:#999;">${dateStr}</span>
          </div>
          <div style="font-size:14px; color:rgba(26,22,18,0.8); line-height:1.5;">${c.content}</div>
        </div>
      `;
    });
  } catch (err) { commentList.innerHTML = '댓글 로드 실패'; }
}

document.getElementById('closeCommentModal').addEventListener('click', () => {
  commentModal.classList.remove('active');
});

document.getElementById('commentForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const token = localStorage.getItem('stylescape_token');
  if (!token) {
    alert("댓글을 작성하려면 로그인이 필요합니다.");
    openAuthModal('login');
    return;
  }

  const postId = document.getElementById('currentCommentPostId').value;
  const contentInput = document.getElementById('commentInput');
  const content = contentInput.value;

  try {
    const res = await fetch(`${API_URL}/api/v1/posts/${postId}/comments`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ content: content })
    });

    if (res.ok) {
      contentInput.value = '';
      openComments(postId);

      const commentCntElement = document.querySelector(`.btn-comment[data-id="${postId}"] .comment-cnt`);
      if (commentCntElement) {
        commentCntElement.innerText = parseInt(commentCntElement.innerText) + 1;
      }
    } else { alert("댓글 작성에 실패했습니다."); }
  } catch (err) { console.error("댓글 작성 오류", err); }
});

// ==========================================
// 16. 검색 및 사이드바 필터
// ==========================================
const feedSearchInput = document.getElementById('feedSearchInput');

if (feedSearchInput) {
  feedSearchInput.addEventListener('input', (e) => {
    const newKeyword = e.target.value;

    if (currentSearchKeyword === newKeyword) return;

    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      currentSearchKeyword = newKeyword;
      resetFeed();
      loadCommunityFeed();
    }, 400);
  });
}

document.querySelectorAll('.sidebar-menu a').forEach(el => {
  if (el.innerText.includes('#')) {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      const tagText = e.target.innerText;
      searchByTag(tagText);
    });
  }
});

// ==========================================
// 17. DOMContentLoaded 초기화
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  checkAuthStatus();
  loadCommunityFeed();

  const sortLatestBtn = document.getElementById('head-sort-latest');
  const sortPopularBtn = document.getElementById('head-sort-popular');
  if (sortLatestBtn) sortLatestBtn.addEventListener('click', () => changeSort('latest'));
  if (sortPopularBtn) sortPopularBtn.addEventListener('click', () => changeSort('popular'));

  const sideLatest = document.getElementById('side-filter-latest');
  const sidePopular = document.getElementById('side-filter-popular');
  if (sideLatest) sideLatest.addEventListener('click', (e) => { e.preventDefault(); changeSort('latest'); });
  if (sidePopular) sidePopular.addEventListener('click', (e) => { e.preventDefault(); changeSort('popular'); });

  document.querySelectorAll('.modal-close').forEach(closeBtn => {
    closeBtn.addEventListener('click', function () {
      this.closest('.modal-overlay').classList.remove('active');
    });
  });

  const sideNearby = document.getElementById('side-filter-nearby');
  if (sideNearby) {
    sideNearby.onclick = (e) => {
      e.preventDefault();

      if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition((position) => {
          userLat = position.coords.latitude;
          userLng = position.coords.longitude;

          currentSort = 'nearby';
          resetFeed();

          document.querySelectorAll('.sidebar-menu a').forEach(el => el.classList.remove('active'));
          sideNearby.classList.add('active');

          loadCommunityFeed();
        }, (err) => {
          alert("위치 정보 권한이 거부되었습니다.");
          console.error(err);
        });
      } else {
        alert("이 브라우저는 위치 정보를 지원하지 않습니다.");
      }
    };
  }
});

// ==========================================
// 💡 18. 게시물 수정/삭제 메뉴 로직
// ==========================================
function togglePostMenu(postId) {
  // 1. 열려있는 다른 게시물의 메뉴를 모두 닫습니다.
  document.querySelectorAll('.post-dropdown').forEach(menu => {
    if (menu.id !== `post-menu-${postId}`) {
      menu.classList.remove('active');
    }
  });
  
  // 2. 클릭한 게시물의 메뉴만 엽니다/닫습니다.
  const menu = document.getElementById(`post-menu-${postId}`);
  if (menu) {
    menu.classList.toggle('active');
  }
}

// ==========================================
// 💡 18. 게시물 수정 로직 (UI 모달 적용 버전)
// ==========================================
function editPost(postId) {
  // 1. 열려있는 점 3개 메뉴 드롭다운 닫기
  const menu = document.getElementById(`post-menu-${postId}`);
  if (menu) menu.classList.remove('active');

  // 2. 화면에 있는 게시물 카드(DOM)를 찾아 기존 데이터를 싹 긁어옵니다.
  const btn = document.querySelector(`.action-btn.btn-like[data-id="${postId}"]`);
  if (!btn) return;
  const card = btn.closest('.post-card');

  const author = card.querySelector('.post-author').innerText.replace('By. ', '');
  const content = card.querySelector('.post-title').innerText;
  const imgEl = card.querySelector('.post-img');
  const tagEls = card.querySelectorAll('.post-hashtag');

  // 3. 긁어온 데이터를 수정 모달(Edit Modal) 안에 예쁘게 채워 넣습니다.
  document.getElementById('editPostId').value = postId;
  document.getElementById('editAuthorName').innerText = author;
  document.getElementById('editAuthorInitials').innerText = author.charAt(0).toUpperCase();
  document.getElementById('editContent').value = content;
  
  // 태그들을 추출해서 쉼표로 연결
  const tags = Array.from(tagEls).map(el => el.innerText.replace('#', '').trim()).join(', ');
  document.getElementById('editTags').value = tags;

  // 이미지가 있으면 보여주고, 없으면 숨깁니다.
  const editImageContainer = document.getElementById('editImageContainer');
  if (imgEl) {
    document.getElementById('editImagePreview').src = imgEl.src;
    editImageContainer.style.display = 'block';
  } else {
    editImageContainer.style.display = 'none';
  }

  // 4. 모달 띄우기!
  document.getElementById('editModal').classList.add('active');
}

// 모달 닫기 이벤트
document.getElementById('closeEditModal').addEventListener('click', () => {
  document.getElementById('editModal').classList.remove('active');
});

// 수정 완료 버튼 눌렀을 때 백엔드로 전송
document.getElementById('editForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const postId = document.getElementById('editPostId').value;
  const newContent = document.getElementById('editContent').value;
  const newTags = document.getElementById('editTags').value;
  const token = localStorage.getItem('stylescape_token');

  try {
    const res = await fetch(`${API_URL}/api/v1/posts/${postId}`, {
      method: 'PUT',
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      // 💡 백엔드로 본문(content)과 태그(user_tags)를 같이 보냅니다!
      body: JSON.stringify({ content: newContent, user_tags: newTags }) 
    });

    if (res.ok) {
      alert("게시물이 성공적으로 수정되었습니다. ✦");
      document.getElementById('editModal').classList.remove('active');
      resetFeed();
      loadCommunityFeed();
    } else {
      alert("수정 권한이 없거나 오류가 발생했습니다.");
    }
  } catch (err) {
    console.error("게시물 수정 오류", err);
    alert("서버 통신 오류.");
  }
});

// ==========================================
// 🗑️ 게시물 삭제 로직
// ==========================================
async function deletePost(postId) {
  const token = localStorage.getItem('stylescape_token');
  if (!token) {
    alert("로그인이 필요합니다.");
    openAuthModal('login');
    return;
  }

  // 1. 브라우저 기본 경고창을 띄워 삭제 여부를 한 번 더 묻습니다.
  const isConfirmed = confirm("정말로 이 게시물을 삭제하시겠습니까?\n삭제된 데이터는 복구할 수 없습니다.");
  
  // 사용자가 '취소'를 누르면 여기서 함수를 종료합니다.
  if (!isConfirmed) {
    return;
  }

  try {
    // 2. 백엔드로 DELETE 요청 보내기 (방금 만든 파이썬 API로 전달)
    const res = await fetch(`${API_URL}/api/v1/posts/${postId}`, {
      method: 'DELETE',
      headers: { 
        'Authorization': `Bearer ${token}`
      }
    });

    if (res.ok) {
      alert("게시물이 성공적으로 삭제되었습니다. ✦");
      
      // 혹시 열려있는 드롭다운 메뉴가 있다면 닫아줍니다.
      document.querySelectorAll('.post-dropdown').forEach(menu => {
        menu.classList.remove('active');
      });

      resetFeed(); // 피드 초기화
      loadCommunityFeed(); // 변경된 내용으로 피드 다시 불러오기
    } else {
      // 본인이 작성한 글이 아니거나 서버 에러일 경우
      alert("삭제 권한이 없거나 오류가 발생했습니다.");
    }
  } catch (err) {
    console.error("게시물 삭제 오류", err);
    alert("서버 통신 오류.");
  }
}

// ==========================================
// 💡 19. 게시물 공유 로직 (링크 미리보기 최적화 버전)
// ==========================================
async function sharePost(postId) {
  const btn = document.querySelector(`.action-btn.btn-like[data-id="${postId}"]`);
  if (!btn) return;
  const card = btn.closest('.post-card');
  const content = card.querySelector('.post-title').innerText;
  
  const shareUrl = `${API_URL}/share/${postId}`;
  const shortText = content.length > 40 ? content.substring(0, 40) + '...' : content;

  const shareData = {
    title: 'StyleScape Community',
    text: `[Fashion.2.Cation] 당신의 도시가 입는 것\n\n${shortText}`,
    url: shareUrl
  };

  // 1. 모바일 기기이면서 HTTPS(또는 로컬) 환경일 때 (가장 완벽한 공유창)
  if (navigator.share && window.isSecureContext) {
    try {
      await navigator.share(shareData);
    } catch (err) {
      console.log('공유 취소됨:', err);
    }
  } 
  // 2. HTTPS 환경에서 클립보드 복사 지원 시
  else if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(shareUrl);
      alert("게시물 링크가 클립보드에 복사되었습니다! ✦\n원하는 곳에 붙여넣기 하세요.");
    } catch (err) {
      alert("링크 복사에 실패했습니다.");
    }
  } 
  // 3. 💡 HTTP 환경 우회 (AWS 우분투에서 현재 작동할 부분)
  else {
    // 가상의 투명한 텍스트 입력창을 만들어 주소를 넣고 강제로 복사명령을 내립니다.
    const textArea = document.createElement("textarea");
    textArea.value = shareUrl;
    textArea.style.position = "fixed";
    textArea.style.left = "-9999px";
    document.body.appendChild(textArea);
    textArea.select();
    
    try {
      document.execCommand('copy');
      alert("게시물 링크가 클립보드에 복사되었습니다! ✦ (우회 복사)");
    } catch (err) {
      // 이마저도 막히면 수동으로 복사하도록 팝업을 띄웁니다.
      prompt("아래 링크를 길게 눌러 복사해 주세요:", shareUrl);
    } finally {
      document.body.removeChild(textArea);
    }
  }
}

// 초기 실행
checkAuthStatus();