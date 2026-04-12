# app/core/config.py
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str
    PROJECT_NAME: str
    
    # 💡 JWT 토큰 보안을 위해 꼭 필요한 설정값들 추가!
    # 기본값을 넣어두면 .env에 없어도 서버가 일단 돌아갑니다.
    SECRET_KEY: str = "fashion-platform-secret-key-9988" 
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 일주일

    class Config:
        env_file = ".env"
        case_sensitive = True

settings = Settings()