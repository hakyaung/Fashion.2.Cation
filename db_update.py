from app.db.session import engine
from sqlalchemy import text

print("데이터베이스 강제 업데이트를 시작합니다...")

try:
    with engine.connect() as conn:
        # 1. users 테이블에 bio, profile_image_url 칸 뚫기 (이미 있으면 무시)
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT;"))
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_image_url TEXT;"))
        
        # 2. 꼬여있는 follows 테이블 삭제 후 완벽한 형태로 재현
        conn.execute(text("DROP TABLE IF EXISTS follows CASCADE;"))
        conn.execute(text("""
            CREATE TABLE follows (
                id SERIAL PRIMARY KEY,
                follower_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                following_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                UNIQUE(follower_id, following_id)
            );
        """))
        
        # 3. 변경사항 저장
        conn.commit()
        print("✅ DB 업데이트 완벽하게 성공했습니다! 이제 서버를 켜도 됩니다.")
except Exception as e:
    print(f"❌ 에러 발생: {e}")