-- ==========================================
-- 👗 AI 추천용 products 테이블
-- ==========================================
-- 팀원에게: 아래 SQL을 PostgreSQL에서 실행해 주세요.
-- 실행 후 import_products.py 로 데이터를 채울 예정입니다.
-- ==========================================

CREATE TABLE IF NOT EXISTS products (
    id              SERIAL PRIMARY KEY,
    filename        VARCHAR(255) NOT NULL,
    brand           VARCHAR(100),
    product_name    TEXT,

    -- 카테고리
    class_label     VARCHAR(50) NOT NULL,   -- 남성_상의, 여성_하의 등 9개
    gender          VARCHAR(20),            -- 남성 / 여성 / 공용
    category        VARCHAR(20),            -- 상의 / 하의 / 아우터 / 원피스 / 스커트 / 신발

    -- 인코딩 코드 (빠른 필터링용)
    gender_code     SMALLINT,
    category_code   SMALLINT,
    class_code      SMALLINT,

    -- 스타일
    color           VARCHAR(50),
    style           VARCHAR(50),
    color_code      SMALLINT,
    style_code      SMALLINT,

    -- 통계 (인기 추천용)
    price           FLOAT,
    discount_rate   FLOAT,
    review_count    INTEGER,
    heart_count     INTEGER,
    color_score     FLOAT,
    style_score     FLOAT,

    image_url       TEXT,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_class_label ON products(class_label);
CREATE INDEX IF NOT EXISTS idx_products_class_code  ON products(class_code);
CREATE INDEX IF NOT EXISTS idx_products_category    ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_gender      ON products(gender);

-- ==========================================
-- 🎯 유저 선호도 테이블 (추천 필터링용)
-- ==========================================
CREATE TABLE IF NOT EXISTS user_preferences (
    id                   SERIAL PRIMARY KEY,
    user_id              UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    preferred_categories TEXT,    -- 예: "상의,아우터"
    preferred_styles     TEXT,    -- 예: "casual,street"
    preferred_colors     TEXT,    -- 예: "black,white"
    preferred_gender     VARCHAR(20),
    updated_at           TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

SELECT COUNT(*) FROM user_preferences;

SELECT * FROM user_preferences;

SELECT * FROM users;

SELECT * FROM post_tags;

SELECT * FROM posts, comment;

-- 테스트를 위한 카테고리 비우기
UPDATE user_preferences SET preferred_categories = NULL WHERE id = '2';
UPDATE user_preferences SET preferred_styles = NULL WHERE id = '2';