from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.models import User
from app.core import security
from pydantic import BaseModel

router = APIRouter()

# 1. 요청 데이터 규격 (Schema)
class UserCreate(BaseModel):
    email: str
    nickname: str
    password: str

# Swagger가 아닌 일반 프론트엔드(Next.js 등)에서 JSON으로 로그인할 때 대비
class UserLogin(BaseModel):
    email: str
    password: str

# 2. 회원가입 API
@router.post("/register")
def register(user_in: UserCreate, db: Session = Depends(get_db)):
    # 중복 이메일 체크
    if db.query(User).filter(User.email == user_in.email).first():
        raise HTTPException(status_code=400, detail="이미 존재하는 이메일입니다.")
    
    # 중복 닉네임 체크
    if db.query(User).filter(User.nickname == user_in.nickname).first():
        raise HTTPException(status_code=400, detail="이미 존재하는 닉네임입니다.")
    
    # 유저 생성 (비밀번호 해싱)
    new_user = User(
        email=user_in.email,
        nickname=user_in.nickname,
        password_hash=security.hash_password(user_in.password)
    )
    db.add(new_user)
    db.commit()
    return {"message": "회원가입 성공!"}

# 3. 로그인 API (Swagger Authorize 버튼과 호환)
@router.post("/login")
def login(
    # OAuth2PasswordRequestForm을 사용하면 Swagger의 username/password 필드와 연동됩니다.
    form_data: OAuth2PasswordRequestForm = Depends(), 
    db: Session = Depends(get_db)
):
    # OAuth2 표준상 'username' 필드에 이메일을 넣어서 보냅니다.
    user = db.query(User).filter(User.email == form_data.username).first()
    
    # 유저가 없거나 비밀번호가 틀린 경우
    if not user or not security.verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="이메일 또는 비밀번호가 틀렸습니다.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # 입장권(JWT) 발급 - 유저의 UUID를 'sub' 필드에 담습니다.
    access_token = security.create_access_token(data={"sub": str(user.id)})
    
    # Swagger UI가 인식할 수 있는 표준 형식으로 반환
    return {"access_token": access_token, "token_type": "bearer"}
