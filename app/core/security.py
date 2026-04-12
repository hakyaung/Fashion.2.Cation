# app/core/security.py
from passlib.context import CryptContext
from datetime import datetime, timedelta
from jose import jwt
from typing import Optional
from app.core.config import settings  # 💡 설정 파일 임포트

# 비밀번호 해싱 설정
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# 💡 하드코딩된 변수들을 지우고 settings에서 가져옵니다.
# 이렇게 해야 모든 파일이 같은 열쇠를 공유합니다.

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict):
    to_encode = data.copy()
    # 💡 settings에 정의된 만료 시간을 사용합니다.
    expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    
    # 💡 가장 중요한 부분: settings의 SECRET_KEY와 ALGORITHM을 사용!
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)