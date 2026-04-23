-- 기존 테이블이 있다면 먼저 삭제 (순서 중요: 자식 테이블부터 삭제)
DROP TABLE IF EXISTS snap_tags;
DROP TABLE IF EXISTS snap_comments;
DROP TABLE IF EXISTS snap_likes;
DROP TABLE IF EXISTS snaps CASCADE;

-- 1. 메인 스냅 테이블 생성
CREATE TABLE snaps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    location_id INTEGER REFERENCES locations(id) ON DELETE SET NULL, -- 처음부터 추가
    video_url TEXT NOT NULL,
    content TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. 스냅 좋아요 테이블 생성
CREATE TABLE snap_likes (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    snap_id UUID REFERENCES snaps(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uix_user_snap_like UNIQUE (user_id, snap_id)
);

-- 3. 스냅 댓글 테이블 생성
CREATE TABLE snap_comments (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    snap_id UUID REFERENCES snaps(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. 스냅 태그 테이블 생성
CREATE TABLE snap_tags (
    snap_id UUID REFERENCES snaps(id) ON DELETE CASCADE,
    tag_name VARCHAR(255),
    PRIMARY KEY (snap_id, tag_name)
);