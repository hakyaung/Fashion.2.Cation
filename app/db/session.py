# app/db/session.py

import re

from sqlalchemy import create_engine, text
from sqlalchemy.engine.url import make_url
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

from app.core.config import settings

# ==========================================
# 💡 추가된 기능: PostgreSQL DB 자동 생성 로직
# ==========================================
def _ensure_postgres_database_exists(database_url: str) -> None:
    url = make_url(database_url)
    if "postgresql" not in url.drivername:
        return
    
    target_db = url.database
    if not target_db:
        return
    
    # 기본 관리자 DB인 'postgres'에 먼저 연결하여 DB 존재 여부를 확인합니다.
    admin_url = url.set(database="postgres")
    admin_engine = create_engine(admin_url, isolation_level="AUTOCOMMIT")
    
    try:
        with admin_engine.connect() as conn:
            exists = conn.execute(
                text("SELECT 1 FROM pg_database WHERE datname = :name"),
                {"name": target_db},
            ).scalar()
            
            # DB가 이미 있으면 그대로 종료
            if exists:
                return
            
            # DB 이름 유효성 검사 (안전성 확보)
            if not re.fullmatch(r"[A-Za-z0-9_]+", target_db):
                raise ValueError(
                    "DATABASE_URL database name must use only letters, digits, underscores."
                )
            
            # DB가 없으면 새로 생성
            conn.execute(text(f"CREATE DATABASE {target_db}"))
    finally:
        admin_engine.dispose()

# 앱 시작 시 DB가 있는지 확인하고 없으면 만듭니다.
_ensure_postgres_database_exists(settings.DATABASE_URL)

# ==========================================
# 💡 기존 기능: 엔진 및 세션 설정 (원형 유지)
# ==========================================
# 1. DB 연결 엔진 생성
engine = create_engine(settings.DATABASE_URL)

# 2. DB 작업을 위한 세션 생성기
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# 3. 모델 정의 시 상속받을 기본 클래스
Base = declarative_base()

# DB 세션을 가져오는 의존성 함수
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()