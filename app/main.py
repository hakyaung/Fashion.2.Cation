from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os

# 임포트 영역
from app.api import posts, users, locations 
from app.db.session import engine, Base
from app.core.config import settings
from app.api import chat

# 1. DB 테이블 생성
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="지역 기반 패션 AI 플랫폼의 핵심 백엔드 서버",
    version="1.0.0"
)

# 2. CORS 설정
app.add_middleware(
    CORSMiddleware,
    #allow_origins=["*"], # 로컬 테스트 시 일단 모든 출처 허용
    allow_origins=["http://localhost:3000", "https://fashion2cation.co.kr"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 3. 폴더 설정
UPLOAD_DIR = "uploads"
if not os.path.exists(UPLOAD_DIR):
    os.makedirs(UPLOAD_DIR)

# 4. API 라우터 등록 (정적 파일 마운트보다 먼저 와야 합니다)
app.include_router(posts.router, prefix="/api/v1/posts", tags=["Posts"])
app.include_router(users.router, prefix="/api/v1/users", tags=["Users"])
app.include_router(locations.router, prefix="/api/v1/locations", tags=["Locations"])
app.include_router(chat.router, prefix="/api/v1/chat", tags=["Chat"])

# 5. 정적 파일 설정
# 업로드된 이미지 서비스
app.mount("/static", StaticFiles(directory=UPLOAD_DIR), name="static")

# 💡 [에러 해결!] 예전 바닐라 리액트 시절의 폴더를 찾는 코드를 주석 처리(비활성화) 했습니다.
# app.mount("/", StaticFiles(directory="frontend", html=True), name="frontend")


from fastapi.responses import HTMLResponse
from fastapi import Depends
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.models import Post

# ==========================================
# 💡 게시물 공유 전용 (Open Graph 메타태그 생성기)
# ==========================================
@app.get("/share/{post_id}", response_class=HTMLResponse)
def share_redirect(post_id: str, db: Session = Depends(get_db)):
    # 1. DB에서 공유된 게시물 찾기
    post = db.query(Post).filter(Post.id == post_id).first()
    
    # 게시물이 삭제됐거나 없으면 그냥 기본 메인 페이지로 보냅니다.
    if not post:
        return HTMLResponse("<script>window.location.href = '/';</script>")

    # 2. 내용과 이미지 다듬기
    short_content = post.content[:40] + "..." if len(post.content) > 40 else post.content
    # 이미지가 없으면 서비스 로고나 기본 이미지가 뜨도록 주소를 넣어주세요.
    image_url = post.image_url if post.image_url else "https://fashion2cation.co.kr/기본로고.jpg" 

    # 3. 로봇에게 보여줄 '오픈 그래프(OG)' HTML 껍데기 만들기
    html_content = f"""
    <!DOCTYPE html>
    <html lang="ko">
    <head>
        <meta charset="UTF-8">
        <meta property="og:title" content="StyleScape Community">
        <meta property="og:description" content="[StyleScape] {short_content}">
        <meta property="og:image" content="{image_url}">
        <meta property="og:url" content="http://fashion2cation.co.kr/share/{post_id}">
        
        <meta name="twitter:card" content="summary_large_image">
        
        <title>StyleScape - 당신의 도시가 입는 것</title>
        
        <script>
            // 💡 [리액트 맞춤 수정] 옛날 Community.html 대신 리액트의 루트 경로(/)로 이동하게 바꿨습니다.
            window.location.href = "/?post={post_id}"; 
        </script>
    </head>
    <body>
        <p>StyleScape로 이동 중입니다... ✦</p>
    </body>
    </html>
    """
    
    return HTMLResponse(content=html_content)