// 전역 설정
//const API_URL = "http://127.0.0.1:8000";
let API_URL;
const currentHost = window.location.hostname;

if (
  currentHost === 'localhost' || 
  currentHost === '127.0.0.1' || 
  currentHost.startsWith('192.168.') || 
  currentHost.startsWith('10.') || 
  currentHost.startsWith('172.')
) {
  API_URL = `http://${currentHost}:8000`; // 로컬 연결
} else {    
  API_URL = "http://fashion2cation.co.kr"; // 우분투(AWS) 연결
}

const observerOptions = { threshold: 0.15, rootMargin: '0px 0px -50px 0px' };

// ==========================================
// 1. 백엔드 데이터 연동 로직
// ==========================================
async function initializePlatform() {
  try {
    const response = await fetch(`${API_URL}/api/v1/posts/`);
    const posts = await response.json();
    
    renderFeed(posts);
    renderRegions(posts);
    updateTopStats(posts);
    updateHeroCollage(posts);
  } catch (error) {
    console.error("데이터 연동 실패:", error);
    document.getElementById('dynamic-feed').innerHTML = '<p style="color:var(--charcoal); padding: 20px;">서버와 연결할 수 없습니다. FastAPI 서버가 켜져 있는지 확인하세요!</p>';
  }
}

function renderFeed(posts) {
  const feedGrid = document.getElementById('dynamic-feed');
  feedGrid.innerHTML = ''; 

  posts.forEach((post, index) => {
    const labelClass = post.ai_status === 'pending' ? 'rust-bg' : '';
    const labelText = post.ai_status === 'pending' ? '분석 중' : 'AI 분석완료';
    const labelPosition = index % 2 === 0 ? 'top-left' : 'top-right'; 

    const card = document.createElement('div');
    card.className = 'feed-card';
    
    card.innerHTML = `
      <img src="${API_URL}${post.image_url}" class="card-bg" style="min-height: 250px;">
      <div class="card-label ${labelPosition} ${labelClass}">${labelText}</div>
      <div class="card-overlay"></div>
      <div class="card-meta">
        <div class="card-region">📍 ${post.location}</div>
        <div style="font-size: 14px; font-weight: 500; color: white; margin-bottom: 4px;">By. ${post.author}</div>
        <div style="font-size: 11px; color: rgba(255,255,255,0.7); margin-bottom: 10px; line-height:1.4;">${post.content}</div>
        <div class="card-style-tags">
          <span class="card-tag">#StyleScape</span>
        </div>
      </div>
    `;
    feedGrid.appendChild(card);
  });

  bindCursorEventsToNewElements();
}

function renderRegions(posts) {
  const regionsGrid = document.getElementById('dynamic-regions');
  regionsGrid.innerHTML = '';

  const locationCounts = {};
  posts.forEach(post => {
    const loc = post.location;
    locationCounts[loc] = (locationCounts[loc] || 0) + 1;
  });

  const totalPosts = posts.length;
  let index = 1;

  for (const [locationName, count] of Object.entries(locationCounts)) {
    const percentage = Math.round((count / totalPosts) * 100) || 0;
    
    const regionCard = document.createElement('div');
    regionCard.className = 'region-card';
    
    regionCard.innerHTML = `
      <div class="region-number">0${index}</div>
      <div class="region-city">KOREA · LOCAL</div>
      <div class="region-name">${locationName}</div>
      <div class="region-bars">
        <div class="region-bar-item">
          <div class="bar-label"><span>트렌드 점유율</span><span>${percentage}%</span></div>
          <div class="bar-track"><div class="bar-fill" data-width="${percentage}"></div></div>
        </div>
      </div>
      <div class="region-count"><strong>${count}</strong> 스타일 업로드</div>
    `;
    regionsGrid.appendChild(regionCard);
    index++;
  }

  // 통계 바 애니메이션 적용
  const barObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const bars = entry.target.querySelectorAll('.bar-fill');
        bars.forEach(bar => {
          const w = bar.dataset.width;
          setTimeout(() => { bar.style.width = w + '%'; }, 300);
        });
      }
    });
  }, observerOptions);
  
  const regionsElement = document.getElementById('regions');
  if (regionsElement) barObserver.observe(regionsElement);
}

function updateTopStats(posts) {
  document.getElementById('stat-total-posts').innerText = posts.length;
  const uniqueLocations = new Set(posts.map(p => p.location));
  document.getElementById('stat-unique-locations').innerText = uniqueLocations.size;
}

// ==========================================
// 2. 권한 부여(Auth) 및 조건부 렌더링 로직
// ==========================================

// 현재 로그인 상태를 확인하고 화면 업데이트
function checkAuthStatus() {
  const token = localStorage.getItem('stylescape_token');
  const navLoginBtn = document.getElementById('navLoginBtn');
  const uploadLoggedOut = document.getElementById('uploadLoggedOut');
  const uploadForm = document.getElementById('uploadForm');

  if (token) {
    navLoginBtn.textContent = '로그아웃';
    uploadLoggedOut.style.display = 'none';
    uploadForm.style.display = 'flex';
  } else {
    navLoginBtn.textContent = '로그인';
    uploadLoggedOut.style.display = 'block';
    uploadForm.style.display = 'none';
  }
}

// 로그인/회원가입 모달 제어
const authModal = document.getElementById('authModal');
let isLoginMode = true; 

function openAuthModal(mode = 'login') {
  authModal.classList.add('active');
  isLoginMode = (mode === 'login');
  updateAuthUI();
}

function closeAuthModal() {
  authModal.classList.remove('active');
  document.getElementById('authForm').reset();
}

document.getElementById('closeAuthModal').addEventListener('click', closeAuthModal);

// 네비게이션 로그인/로그아웃 버튼 클릭 이벤트
document.getElementById('navLoginBtn').addEventListener('click', (e) => {
  e.preventDefault();
  if (localStorage.getItem('stylescape_token')) {
    if(confirm("로그아웃 하시겠습니까?")) {
      localStorage.removeItem('stylescape_token');
      checkAuthStatus();
      alert("로그아웃 되었습니다.");
    }
  } else {
    openAuthModal('login');
  }
});

// [메인 화면(Hero) 동적 이미지 & 태그 업데이트]
function updateHeroCollage(posts) {
  if (!posts || posts.length === 0) return;

  // 💡 핵심 해결책: 전체 게시글 중 '이미지가 있는 게시물'만 따로 골라냅니다.
  const imagePosts = posts.filter(post => post.image_url && post.image_url.trim() !== "");

  // 필터링된 이미지 게시글 중 가장 최신 3개만 화면에 그립니다.
  for (let i = 0; i < 3; i++) {
    const post = imagePosts[i];
    
    // 만약 이미지 게시글이 3개가 안 된다면, 남은 자리는 기본 디자인을 유지하기 위해 멈춥니다.
    if (!post) break; 

    const block = document.getElementById(`hero-block-${i}`);
    const tag = document.getElementById(`hero-tag-${i}`);

    if (block) {
      const locationShort = post.location.split(' ').pop(); // 예: "천안시 불당동" -> "불당동"
      
      block.innerHTML = `
        <img src="${API_URL}${post.image_url}" class="collage-img" style="width: 100%; height: 100%; object-fit: cover; transition: transform 0.6s ease;">
        <div style="position:absolute; inset:0; background: linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 50%); pointer-events: none;"></div>
        <div style="position:absolute; bottom: 20px; left: 24px; color: rgba(255,255,255,0.95); font-family: 'Playfair Display', serif; font-size: 26px; font-style: italic; text-shadow: 0 2px 4px rgba(0,0,0,0.5);">
          ${locationShort}
        </div>
      `;
    }

    if (tag) {
      const locationShort = post.location.split(' ').pop();
      let suffix = i === 0 ? "트렌딩" : i === 1 ? "스트릿" : "무드";
      tag.innerText = `#${locationShort}${suffix}`;
    }
  }
}

// 업로드 섹션 내 '로그인 후 업로드' 버튼 클릭 이벤트
document.getElementById('triggerLoginBtn').addEventListener('click', (e) => {
  e.preventDefault();
  openAuthModal('login');
});

// 로그인 <-> 회원가입 창 UI 전환
function updateAuthUI() {
  document.getElementById('authTitle').textContent = isLoginMode ? 'Login' : 'Register';
  document.getElementById('authDesc').textContent = isLoginMode ? 'StyleScape에 오신 것을 환영합니다.' : '천안 패션 생태계에 합류하세요.';
  document.getElementById('authSubmitBtn').textContent = isLoginMode ? '로그인 ✦' : '회원가입 ✦';
  document.getElementById('authToggleText').textContent = isLoginMode ? '계정이 없으신가요? ' : '이미 계정이 있으신가요? ';
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

// 회원가입 / 로그인 폼 전송
document.getElementById('authForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const email = document.getElementById('authEmail').value;
  const password = document.getElementById('authPassword').value;
  
  if (isLoginMode) {
    // 로그인 API 호출 (OAuth2 규격 - Form Data)
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
        closeAuthModal();
        checkAuthStatus(); 
      } else {
        alert("이메일이나 비밀번호가 틀렸습니다.");
      }
    } catch (error) {
      alert("서버 연결 실패. 백엔드가 켜져 있는지 확인하세요.");
    }
  } else {
    // 회원가입 API 호출 (JSON 규격)
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
      } else {
        const err = await res.json();
        alert(`가입 실패: ${err.detail}`);
      }
    } catch (error) {
      alert("서버 연결 실패");
    }
  }
});


// ==========================================
// 3. 업로드 폼 전송 (로그인 된 상태에서만)
// ==========================================
document.getElementById('uploadForm').addEventListener('submit', async (e) => {
  e.preventDefault(); 
  
  const token = localStorage.getItem('stylescape_token');
  if (!token) {
    alert("로그인이 만료되었습니다.");
    checkAuthStatus();
    return;
  }

  const formData = new FormData();
  formData.append('file', document.getElementById('uploadFile').files[0]);
  formData.append('location_id', document.getElementById('uploadLocation').value);
  formData.append('content', document.getElementById('uploadContent').value);
  
  const tags = document.getElementById('uploadTags').value;
  if (tags) formData.append('user_tags', tags);

  try {
    const res = await fetch(`${API_URL}/api/v1/posts/upload`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData
    });

    if (res.ok) {
      alert("성공적으로 업로드되었습니다! 📸");
      document.getElementById('uploadForm').reset();
      initializePlatform(); 
      document.getElementById('explore').scrollIntoView({ behavior: 'smooth' });
    } else {
      if (res.status === 401) {
        alert("인증이 만료되었습니다. 다시 로그인해 주세요.");
        localStorage.removeItem('stylescape_token');
        checkAuthStatus();
      } else {
        alert("업로드 실패");
      }
    }
  } catch (error) {
    alert("서버 통신 중 오류가 발생했습니다.");
  }
});


// ==========================================
// 4. 디자인 및 마우스 인터랙션 스크립트
// ==========================================
const cursor = document.getElementById('cursor');
const follower = document.getElementById('cursorFollower');
let mouseX = 0, mouseY = 0, followerX = 0, followerY = 0;

document.addEventListener('mousemove', (e) => {
  mouseX = e.clientX;
  mouseY = e.clientY;
  cursor.style.left = mouseX + 'px';
  cursor.style.top = mouseY + 'px';
});

function animateFollower() {
  followerX += (mouseX - followerX) * 0.1;
  followerY += (mouseY - followerY) * 0.1;
  follower.style.left = followerX + 'px';
  follower.style.top = followerY + 'px';
  requestAnimationFrame(animateFollower);
}
animateFollower();

function bindCursorEventsToNewElements() {
  document.querySelectorAll('a, button, .feed-card, .region-card, .event-item').forEach(el => {
    el.addEventListener('mouseenter', () => {
      cursor.style.transform = 'translate(-50%, -50%) scale(2)';
      cursor.style.background = 'var(--gold)';
      follower.style.opacity = '0.2';
    });
    el.addEventListener('mouseleave', () => {
      cursor.style.transform = 'translate(-50%, -50%) scale(1)';
      cursor.style.background = 'var(--rust)';
      follower.style.opacity = '0.5';
    });
  });
}
bindCursorEventsToNewElements();

const statsObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry, i) => {
    if (entry.isIntersecting) {
      const items = entry.target.querySelectorAll('.stat-item');
      items.forEach((item, idx) => {
        setTimeout(() => item.classList.add('visible'), idx * 120);
      });
    }
  });
}, observerOptions);
const statsBand = document.querySelector('.stats-band');
if (statsBand) statsObserver.observe(statsBand);

const aiObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.querySelectorAll('.ai-bubble').forEach(b => b.classList.add('visible'));
      entry.target.querySelectorAll('.ai-feature').forEach((f, i) => {
        setTimeout(() => f.classList.add('visible'), i * 150);
      });
    }
  });
}, observerOptions);
const aiSection = document.querySelector('.section-ai');
if (aiSection) aiObserver.observe(aiSection);

const btn = document.querySelector('.subscribe-form button');
const input = document.querySelector('.subscribe-form input');
if (btn) {
  btn.addEventListener('click', () => {
    if (input.value && input.value.includes('@')) {
      btn.textContent = '✦ 구독 완료';
      btn.style.background = 'var(--sage)';
      input.value = '';
    } else {
      input.style.borderColor = 'var(--rust)';
      setTimeout(() => { input.style.borderColor = ''; }, 1500);
    }
  });
}

document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    e.preventDefault();
    const id = a.getAttribute('href');
    if (id !== '#') {
      document.querySelector(id)?.scrollIntoView({ behavior: 'smooth' });
    }
  });
});

// 페이지 로드 시 1. 데이터 불러오기 2. 로그인 상태 확인
initializePlatform();
checkAuthStatus();