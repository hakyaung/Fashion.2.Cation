# app/api/deps.py
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.models import User
# 💡 기존 security에서 직접 가져오던 방식을 settings에서 가져오는 방식으로 변경!
from app.core.config import settings 

# Swagger UI에서 토큰 입력을 도와주는 도구
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/users/login")

def get_current_user(db: Session = Depends(get_db), token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="인증 정보가 유효하지 않습니다.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        # 💡 1. 토큰 복호화 (settings.SECRET_KEY와 settings.ALGORITHM 사용)
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id: str = payload.get("sub") # 우리가 로그인할 때 넣은 UUID
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    # 2. DB에서 실제 유저 확인
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise credentials_exception
    return user