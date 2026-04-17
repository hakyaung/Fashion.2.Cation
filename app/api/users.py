import os
import shutil
from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile
from fastapi.security import OAuth2PasswordRequestForm, OAuth2PasswordBearer
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from uuid import UUID
from jose import JWTError, jwt

from app.db.session import get_db
# 💡 Post 모델을 추가로 임포트했습니다.
from app.models.models import User, Follow, Post 
from app.core import security
from app.core.config import settings
from sqlalchemy import or_

router = APIRouter()

# 프로필 이미지 저장 경로 설정
UPLOAD_DIR = "uploads/profiles"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# JWT 토큰 추출 설정
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/users/login")

# ==========================================
# 1. 요청 데이터 규격 (Schema)
# ==========================================
class UserCreate(BaseModel):
    email: str
    nickname: str
    password: str

class UserLogin(BaseModel):
    email: str
    password: str

class UserProfileUpdate(BaseModel):
    nickname: Optional[str] = None
    bio: Optional[str] = None
    profile_image_url: Optional[str] = None

# 💡 [새로 추가] FCM 토큰 요청 규격
class FCMTokenRequest(BaseModel):
    fcm_token: str

# ==========================================
# 💡 인증 의존성 함수
# ==========================================
def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="로그인이 만료되었거나 유효하지 않은 토큰입니다.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
        
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise credentials_exception
    return user

def get_current_user_optional(token: str = Depends(OAuth2PasswordBearer(tokenUrl="/api/v1/users/login", auto_error=False)), db: Session = Depends(get_db)):
    if not token:
        return None
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id:
            return db.query(User).filter(User.id == user_id).first()
    except JWTError:
        return None
    return None

# ==========================================
# 2. 기존 인증 API
# ==========================================
@router.post("/register")
def register(user_in: UserCreate, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == user_in.email).first():
        raise HTTPException(status_code=400, detail="이미 존재하는 이메일입니다.")
    if db.query(User).filter(User.nickname == user_in.nickname).first():
        raise HTTPException(status_code=400, detail="이미 존재하는 닉네임입니다.")
    
    new_user = User(
        email=user_in.email,
        nickname=user_in.nickname,
        password_hash=security.hash_password(user_in.password)
    )
    db.add(new_user)
    db.commit()
    return {"message": "회원가입 성공!"}

@router.post("/login")
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == form_data.username).first()
    if not user or not security.verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="이메일 또는 비밀번호가 틀렸습니다.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token = security.create_access_token(data={"sub": str(user.id)})
    return {"access_token": access_token, "token_type": "bearer"}

# ==========================================
# 3. 신규 프로필 및 팔로우 API
# ==========================================
@router.get("/{user_id}/profile")
def get_user_profile(
    user_id: UUID, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user_optional)
):
    """특정 유저의 프로필 정보, 게시물 수, 팔로우 통계 조회"""
    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")
    
    # 해당 유저의 전체 게시물 개수를 DB에서 직접 셉니다.
    posts_count = db.query(Post).filter(Post.user_id == user_id).count()

    followers_count = db.query(Follow).filter(Follow.following_id == user_id).count()
    following_count = db.query(Follow).filter(Follow.follower_id == user_id).count()
    
    is_following = False
    if current_user:
        follow_record = db.query(Follow).filter(
            Follow.follower_id == current_user.id,
            Follow.following_id == user_id
        ).first()
        is_following = follow_record is not None
        
    return {
        "id": target_user.id,
        "nickname": target_user.nickname,
        "bio": target_user.bio,
        "profile_image_url": target_user.profile_image_url,
        "posts_count": posts_count,    
        "followers_count": followers_count,
        "following_count": following_count,
        "is_following": is_following
    }

@router.put("/me/profile")
def update_profile(update_data: UserProfileUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if update_data.nickname:
        existing_user = db.query(User).filter(User.nickname == update_data.nickname).first()
        if existing_user and existing_user.id != current_user.id:
            raise HTTPException(status_code=400, detail="이미 사용 중인 닉네임입니다.")
        current_user.nickname = update_data.nickname
        
    if update_data.bio is not None:
        current_user.bio = update_data.bio
        
    if update_data.profile_image_url is not None:
        current_user.profile_image_url = update_data.profile_image_url
        
    db.commit()
    db.refresh(current_user)
    return {
        "message": "프로필 업데이트 성공", 
        "bio": current_user.bio,
        "nickname": current_user.nickname,
        "profile_image_url": current_user.profile_image_url
    }

@router.post("/me/profile-image")
async def upload_profile_image(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    extension = file.filename.split(".")[-1]
    file_name = f"{current_user.id}_profile.{extension}"
    file_path = os.path.join(UPLOAD_DIR, file_name)

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    image_url = f"/static/profiles/{file_name}"
    current_user.profile_image_url = image_url
    db.commit()

    return {"profile_image_url": image_url}

@router.post("/{target_user_id}/follow")
def toggle_follow(target_user_id: UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.id == target_user_id:
        raise HTTPException(status_code=400, detail="자기 자신을 팔로우할 수 없습니다.")
        
    target_user = db.query(User).filter(User.id == target_user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="대상 사용자를 찾을 수 없습니다.")
        
    existing_follow = db.query(Follow).filter(
        Follow.follower_id == current_user.id,
        Follow.following_id == target_user_id
    ).first()
    
    if existing_follow:
        db.delete(existing_follow)
        db.commit()
        return {"status": "unfollowed"}
    else:
        new_follow = Follow(follower_id=current_user.id, following_id=target_user_id)
        db.add(new_follow)
        db.commit()
        return {"status": "followed"}

# ==========================================
# 🔍 유저 검색 API (@ 검색용)
# ==========================================
@router.get("/search")
def search_users(q: str, db: Session = Depends(get_db)):
    # 1. 만약 검색어에 @가 섞여있다면 제거하고 순수 키워드만 추출
    search_query = q.replace("@", "").strip()
    
    if not search_query:
        return []

    # 2. 닉네임이나 이메일에 검색어가 포함된 유저 최대 10명 찾기 (대소문자 구분 없음)
    users = db.query(User).filter(
        or_(
            User.nickname.ilike(f"%{search_query}%"),
            User.email.ilike(f"%{search_query}%")
        )
    ).limit(10).all()

    # 3. 필요한 정보만 포장해서 반환
    return [
        {
            "id": str(u.id), 
            "nickname": u.nickname, 
            "email": u.email, 
            "profile_image_url": u.profile_image_url
        } 
        for u in users
    ]

# ==========================================
# 🔔 [새로 추가] FCM 토큰 저장 API
# ==========================================
@router.post("/fcm-token")
async def update_fcm_token(
    request: FCMTokenRequest, 
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    current_user.fcm_token = request.fcm_token
    db.commit()
    return {"status": "success", "message": "FCM 토큰이 성공적으로 저장되었습니다."}