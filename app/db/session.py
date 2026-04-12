# app/db/session.py 수정본

# 'create_all'을 제거하고 'create_engine'만 남깁니다.
from sqlalchemy import create_engine 
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

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
