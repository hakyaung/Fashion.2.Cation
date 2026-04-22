import os
import shutil
import uuid
from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile
from fastapi.security import OAuth2PasswordRequestForm, OAuth2PasswordBearer
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from uuid import UUID
from jose import JWTError, jwt

from app.db.session import get_db
from app.models.models import User, Follow, Post, UserPreference 
from app.core import security
from app.core.config import settings
from sqlalchemy import or_

from app.core.security import create_access_token
from firebase_admin import auth as firebase_auth

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

class FCMTokenRequest(BaseModel):
    fcm_token: str

class FirebaseTokenRequest(BaseModel):
    id_token: str

class UserPreferenceUpdate(BaseModel):
    preferred_categories: Optional[str] = None
    preferred_styles: Optional[str] = None
    preferred_colors: Optional[str] = None
    preferred_gender: Optional[str] = None

# ==========================================
# 인증 의존성 함수
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
# 3. 프로필 및 팔로우 API
# ==========================================
@router.get("/{user_id}/profile")
def get_user_profile(
    user_id: UUID, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user_optional)
):
    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")
    
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
# 4. 검색 및 알림 API
# ==========================================
@router.get("/search")
def search_users(q: str, db: Session = Depends(get_db)):
    search_query = q.replace("@", "").strip()
    if not search_query:
        return []
    users = db.query(User).filter(
        or_(User.nickname.ilike(f"%{search_query}%"), User.email.ilike(f"%{search_query}%"))
    ).limit(10).all()
    return [{"id": str(u.id), "nickname": u.nickname, "email": u.email, "profile_image_url": u.profile_image_url} for u in users]

@router.post("/fcm-token")
async def update_fcm_token(request: FCMTokenRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    current_user.fcm_token = request.fcm_token
    db.commit()
    return {"status": "success", "message": "FCM 토큰 저장 완료"}

# ==========================================
# 5. 소셜 로그인 API
# ==========================================
@router.post("/firebase-login")
def login_with_firebase(request: FirebaseTokenRequest, db: Session = Depends(get_db)):
    try:
        decoded_token = firebase_auth.verify_id_token(request.id_token, clock_skew_seconds=10)
        email = decoded_token.get('email')
        name = decoded_token.get('name', '구글유저')
        picture = decoded_token.get('picture', '')
        if not email:
            raise HTTPException(status_code=400, detail="이메일 정보가 없습니다.")
        user = db.query(User).filter(User.email == email).first()
        if not user:
            unique_suffix = str(uuid.uuid4())[:6]
            user = User(
                email=email,
                nickname=f"{name}_{unique_suffix}", 
                profile_image_url=picture,
                password_hash="SOCIAL_LOGIN", 
                bio="Fashion.2.Cation에 오신 것을 환영합니다!"
            )
            db.add(user)
            db.commit()
            db.refresh(user)
        access_token = create_access_token(data={"sub": str(user.id)})
        return {"access_token": access_token, "token_type": "bearer"}
    except Exception as e:
        raise HTTPException(status_code=401, detail="유효하지 않은 구글 로그인입니다.")

# ==========================================
# 🎯 6. 유저 취향 설정 (조회 및 수정)
# ==========================================

# [신규] 내 취향 정보 가져오기 (설정 화면 로딩용)
@router.get("/me/preferences")
def get_my_preferences(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """현재 로그인한 유저의 저장된 취향을 반환합니다."""
    pref = db.query(UserPreference).filter(UserPreference.user_id == current_user.id).first()
    
    # 데이터가 없으면 프론트엔드 에러 방지를 위해 기본값 반환
    if not pref:
        return {
            "preferred_categories": "",
            "preferred_styles": "",
            "preferred_colors": "",
            "preferred_gender": ""
        }
    return pref

# [유지/수정] 취향 정보 저장 및 업데이트
@router.put("/me/preferences")
async def update_my_preferences(
    pref_data: UserPreferenceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """유저의 취향 정보를 생성하거나 갱신합니다."""
    pref = db.query(UserPreference).filter(UserPreference.user_id == current_user.id).first()
    
    if not pref:
        pref = UserPreference(user_id=current_user.id)
        db.add(pref)

    # 필드가 전달된 경우에만 업데이트 (상태 유지)
    if pref_data.preferred_categories is not None: 
        pref.preferred_categories = pref_data.preferred_categories
    if pref_data.preferred_styles is not None: 
        pref.preferred_styles = pref_data.preferred_styles
    if pref_data.preferred_colors is not None: 
        pref.preferred_colors = pref_data.preferred_colors
    if pref_data.preferred_gender is not None: 
        pref.preferred_gender = pref_data.preferred_gender
    
    db.commit()
    return {"status": "success", "message": "취향 설정이 저장되었습니다."}