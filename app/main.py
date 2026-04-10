from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os

# 임포트 영역
from app.api import posts, users, locations 
from app.db.session import engine, Base
from app.core.config import settings

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
    allow_origins=["*"],
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

# 5. 정적 파일 설정
# 업로드된 이미지 서비스
app.mount("/static", StaticFiles(directory=UPLOAD_DIR), name="static")

# 💡 중요: 기존의 @app.get("/") 코드는 지우거나 주석 처리했습니다. 
# 그래야 아래의 마운트 코드가 루트(/) 주소를 차지해서 HTML을 보여줄 수 있습니다.
app.mount("/", StaticFiles(directory="frontend", html=True), name="frontend")

# (기존 @app.get("/")와 @app.get("/health")는 중복 및 충돌 방지를 위해 제거했습니다.)
