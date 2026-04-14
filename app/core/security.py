# app/core/security.py
from datetime import datetime, timedelta
from typing import Optional
import bcrypt
from jose import jwt

from app.core.config import settings  # 💡 설정 파일 임포트

# 💡 하드코딩된 변수들을 지우고 settings에서 가져옵니다.
# 이렇게 해야 모든 파일이 같은 열쇠를 공유합니다.

# 💡 추가된 기능: passlib 대신 순수 bcrypt를 사용하여 의존성을 줄이고 안전성을 높였습니다.
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8"),
            hashed_password.encode("utf-8"),
        )
    except (ValueError, TypeError):
        # 형식이 잘못된 비밀번호가 들어와도 에러를 내뿜지 않고 안전하게 False를 반환합니다.
        return False

def create_access_token(data: dict):
    to_encode = data.copy()
    # 💡 settings에 정의된 만료 시간을 사용합니다.
    expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    
    # 💡 가장 중요한 부분: settings의 SECRET_KEY와 ALGORITHM을 사용!
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)