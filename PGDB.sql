
-- 1. 지역 정보 (검색 성능을 위해 full_name에 인덱스 권장)
CREATE TABLE locations (
    id SERIAL PRIMARY KEY,
    city VARCHAR(50) NOT NULL,
    district VARCHAR(50) NOT NULL,
    full_name VARCHAR(100) UNIQUE NOT NULL
);

-- 2. 사용자 (이메일 인증 및 보안 강화 대비)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(100) UNIQUE NOT NULL,
    nickname VARCHAR(50) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. 게시글 (AI 분석 레이어를 위한 상태값 세분화)
CREATE TABLE posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    location_id INTEGER REFERENCES locations(id) ON DELETE SET NULL,
    content TEXT,
    
    -- AI 분석 파이프라인용 상태 필드
    ai_status VARCHAR(20) DEFAULT 'pending', -- pending, processing, completed, failed
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- 성능 최적화를 위한 인덱스 생성용
    CONSTRAINT fk_user FOREIGN KEY(user_id) REFERENCES users(id)
);

-- 4. 스타일 태그 (AI 분석 결과 및 검색용)
CREATE TABLE post_tags (
    post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
    tag_name VARCHAR(50) NOT NULL,
    confidence_score FLOAT DEFAULT 0.0, -- AI의 확신도
    is_ai_generated BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (post_id, tag_name)
);

-- 1. 좋아요(Likes) 테이블
CREATE TABLE likes (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, post_id) -- 한 사람이 한 글에 한 번만 좋아요 가능
);

-- 2. 댓글(Comments) 테이블
CREATE TABLE comments (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE locations ADD COLUMN latitude FLOAT;
ALTER TABLE locations ADD COLUMN longitude FLOAT;

-- 테스트를 위해 천안 주요 지역 좌표 예시 데이터 (실제 서비스 시에는 API 등으로 채워야 함)
UPDATE locations SET latitude = 36.8151, longitude = 127.1139 WHERE district = '불당동';
UPDATE locations SET latitude = 36.8197, longitude = 127.1565 WHERE district = '신부동';

-- 1. 유저 테이블에 프로필 필드 추가
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_image_url TEXT;

DROP TABLE IF EXISTS follows CASCADE;

CREATE TABLE follows (
    id SERIAL PRIMARY KEY,
    follower_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    following_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(follower_id, following_id)
);

-- locations 테이블 지금까지 넣었던거 정리
TRUNCATE TABLE locations RESTART IDENTITY CASCADE;


-- 지역 데이터 삽입
-- 서울
INSERT INTO locations (city, district, full_name) VALUES 
('서울특별시', '강남구', '서울특별시 강남구'),
('서울특별시', '강동구', '서울특별시 강동구'),
('서울특별시', '강북구', '서울특별시 강북구'),
('서울특별시', '강서구', '서울특별시 강서구'),
('서울특별시', '관악구', '서울특별시 관악구'),
('서울특별시', '광진구', '서울특별시 광진구'),
('서울특별시', '구로구', '서울특별시 구로구'),
('서울특별시', '금천구', '서울특별시 금천구'),
('서울특별시', '노원구', '서울특별시 노원구'),
('서울특별시', '도봉구', '서울특별시 도봉구'),
('서울특별시', '동대문구', '서울특별시 동대문구'),
('서울특별시', '동작구', '서울특별시 동작구'),
('서울특별시', '마포구', '서울특별시 마포구'),
('서울특별시', '서대문구', '서울특별시 서대문구'),
('서울특별시', '서초구', '서울특별시 서초구'),
('서울특별시', '성동구', '서울특별시 성동구'),
('서울특별시', '성북구', '서울특별시 성북구'),
('서울특별시', '송파구', '서울특별시 송파구'),
('서울특별시', '양천구', '서울특별시 양천구'),
('서울특별시', '영등포구', '서울특별시 영등포구'),
('서울특별시', '용산구', '서울특별시 용산구'),
('서울특별시', '은평구', '서울특별시 은평구'),
('서울특별시', '종로구', '서울특별시 종로구'),
('서울특별시', '중구', '서울특별시 중구'),
('서울특별시', '중랑구', '서울특별시 중랑구');

-- 부산
INSERT INTO locations (city, district, full_name) VALUES 
('부산광역시', '중구', '부산광역시 중구'),
('부산광역시', '서구', '부산광역시 서구'),
('부산광역시', '동구', '부산광역시 동구'),
('부산광역시', '영도구', '부산광역시 영도구'),
('부산광역시', '부산진구', '부산광역시 부산진구'),
('부산광역시', '동래구', '부산광역시 동래구'),
('부산광역시', '남구', '부산광역시 남구'),
('부산광역시', '북구', '부산광역시 북구'),
('부산광역시', '해운대구', '부산광역시 해운대구'),
('부산광역시', '사하구', '부산광역시 사하구'),
('부산광역시', '금정구', '부산광역시 금정구'),
('부산광역시', '강서구', '부산광역시 강서구'),
('부산광역시', '연제구', '부산광역시 연제구'),
('부산광역시', '수영구', '부산광역시 수영구'),
('부산광역시', '사상구', '부산광역시 사상구'),
('부산광역시', '기장군', '부산광역시 기장군');

-- 대구광역시
INSERT INTO locations (city, district, full_name) VALUES 
('대구광역시', '중구', '대구광역시 중구'),
('대구광역시', '동구', '대구광역시 동구'),
('대구광역시', '서구', '대구광역시 서구'),
('대구광역시', '남구', '대구광역시 남구'),
('대구광역시', '북구', '대구광역시 북구'),
('대구광역시', '수성구', '대구광역시 수성구'),
('대구광역시', '달서구', '대구광역시 달서구'),
('대구광역시', '달성군', '대구광역시 달성군'),
('대구광역시', '군위군', '대구광역시 군위군');

-- 인천
INSERT INTO locations (city, district, full_name) VALUES 
('인천광역시', '중구', '인천광역시 중구'),
('인천광역시', '동구', '인천광역시 동구'),
('인천광역시', '미추홀구', '인천광역시 미추홀구'),
('인천광역시', '연수구', '인천광역시 연수구'),
('인천광역시', '남동구', '인천광역시 남동구'),
('인천광역시', '부평구', '인천광역시 부평구'),
('인천광역시', '계양구', '인천광역시 계양구'),
('인천광역시', '서구', '인천광역시 서구'),
('인천광역시', '강화군', '인천광역시 강화군'),
('인천광역시', '옹진군', '인천광역시 옹진군');

-- 광주
INSERT INTO locations (city, district, full_name) VALUES 
('광주광역시', '동구', '광주광역시 동구'),
('광주광역시', '서구', '광주광역시 서구'),
('광주광역시', '남구', '광주광역시 남구'),
('광주광역시', '북구', '광주광역시 북구'),
('광주광역시', '광산구', '광주광역시 광산구');

-- 대전
INSERT INTO locations (city, district, full_name) VALUES 
('대전광역시', '동구', '대전광역시 동구'),
('대전광역시', '중구', '대전광역시 중구'),
('대전광역시', '서구', '대전광역시 서구'),
('대전광역시', '유성구', '대전광역시 유성구'),
('대전광역시', '대덕구', '대전광역시 대덕구');

-- 울산
INSERT INTO locations (city, district, full_name) VALUES 
('울산광역시', '중구', '울산광역시 중구'),
('울산광역시', '남구', '울산광역시 남구'),
('울산광역시', '동구', '울산광역시 동구'),
('울산광역시', '북구', '울산광역시 북구'),
('울산광역시', '울주군', '울산광역시 울주군');

-- 세종시
INSERT INTO locations (city, district, full_name) VALUES 
('세종특별자치시', '조치원읍', '세종특별자치시 조치원읍'),
('세종특별자치시', '연기면', '세종특별자치시 연기면'),
('세종특별자치시', '연동면', '세종특별자치시 연동면'),
('세종특별자치시', '부강면', '세종특별자치시 부강면'),
('세종특별자치시', '금남면', '세종특별자치시 금남면'),
('세종특별자치시', '장군면', '세종특별자치시 장군면'),
('세종특별자치시', '연서면', '세종특별자치시 연서면'),
('세종특별자치시', '전의면', '세종특별자치시 전의면'),
('세종특별자치시', '전동면', '세종특별자치시 전동면'),
('세종특별자치시', '소정면', '세종특별자치시 소정면'),
('세종특별자치시', '한솔동', '세종특별자치시 한솔동'),
('세종특별자치시', '새롬동', '세종특별자치시 새롬동'),
('세종특별자치시', '나성동', '세종특별자치시 나성동'),
('세종특별자치시', '다정동', '세종특별자치시 다정동'),
('세종특별자치시', '도담동', '세종특별자치시 도담동'),
('세종특별자치시', '어진동', '세종특별자치시 어진동'),
('세종특별자치시', '해밀동', '세종특별자치시 해밀동'),
('세종특별자치시', '아름동', '세종특별자치시 아름동'),
('세종특별자치시', '종촌동', '세종특별자치시 종촌동'),
('세종특별자치시', '고운동', '세종특별자치시 고운동'),
('세종특별자치시', '보람동', '세종특별자치시 보람동'),
('세종특별자치시', '대평동', '세종특별자치시 대평동'),
('세종특별자치시', '소담동', '세종특별자치시 소담동'),
('세종특별자치시', '반곡동', '세종특별자치시 반곡동');

-- 경기도
INSERT INTO locations (city, district, full_name) VALUES 
('경기도', '수원시', '경기도 수원시'),
('경기도', '성남시', '경기도 성남시'),
('경기도', '의정부시', '경기도 의정부시'),
('경기도', '안양시', '경기도 안양시'),
('경기도', '부천시', '경기도 부천시'),
('경기도', '광명시', '경기도 광명시'),
('경기도', '평택시', '경기도 평택시'),
('경기도', '동두천시', '경기도 동두천시'),
('경기도', '안산시', '경기도 안산시'),
('경기도', '고양시', '경기도 고양시'),
('경기도', '구리시', '경기도 구리시'),
('경기도', '남양주시', '경기도 남양주시'),
('경기도', '오산시', '경기도 오산시'),
('경기도', '시흥시', '경기도 시흥시'),
('경기도', '군포시', '경기도 군포시'),
('경기도', '과천시', '경기도 과천시'),
('경기도', '의왕시', '경기도 의왕시'),
('경기도', '하남시', '경기도 하남시'),
('경기도', '용인시', '경기도 용인시'),
('경기도', '파주시', '경기도 파주시'),
('경기도', '이천시', '경기도 이천시'),
('경기도', '안성시', '경기도 안성시'),
('경기도', '김포시', '경기도 김포시'),
('경기도', '화성시', '경기도 화성시'),
('경기도', '광주시', '경기도 광주시'),
('경기도', '양주시', '경기도 양주시'),
('경기도', '포천시', '경기도 포천시'),
('경기도', '여주시', '경기도 여주시');

-- 강원도
INSERT INTO locations (city, district, full_name) VALUES
('강원도', '춘천시', '강원도 춘천시'),
('강원도', '원주시', '강원도 원주시'),
('강원도', '강릉시', '강원도 강릉시'),
('강원도', '동해시', '강원도 동해시'),
('강원도', '태백시', '강원도 태백시'),
('강원도', '속초시', '강원도 속초시'),
('강원도', '삼척시', '강원도 삼척시');

-- 충청북도
INSERT INTO locations (city, district, full_name) VALUES
('충청북도', '청주시', '충청북도 청주시'),
('충청북도', '충주시', '충청북도 충주시'),
('충청북도', '제천시', '충청북도 제천시');

-- 충청남도
INSERT INTO locations (city, district, full_name) VALUES
('충청남도', '천안시', '충청남도 천안시'),
('충청남도', '공주시', '충청남도 공주시'),
('충청남도', '보령시', '충청남도 보령시'),
('충청남도', '아산시', '충청남도 아산시'),
('충청남도', '서산시', '충청남도 서산시'),
('충청남도', '논산시', '충청남도 논산시'),
('충청남도', '계룡시', '충청남도 계룡시'),
('충청남도', '당진시', '충청남도 당진시');

-- 전북특별자치도
INSERT INTO locations (city, district, full_name) VALUES
('전북특별자치도', '전주시', '전북특별자치도 전주시'),
('전북특별자치도', '군산시', '전북특별자치도 군산시'),
('전북특별자치도', '익산시', '전북특별자치도 익산시'),
('전북특별자치도', '정읍시', '전북특별자치도 정읍시'),
('전북특별자치도', '남원시', '전북특별자치도 남원시'),
('전북특별자치도', '김제시', '전북특별자치도 김제시');

-- 전라남도
INSERT INTO locations (city, district, full_name) VALUES
('전라남도', '목포시', '전라남도 목포시'),
('전라남도', '여수시', '전라남도 여수시'),
('전라남도', '순천시', '전라남도 순천시'),
('전라남도', '나주시', '전라남도 나주시'),
('전라남도', '광양시', '전라남도 광양시');

-- 경상북도
INSERT INTO locations (city, district, full_name) VALUES
('경상북도', '포항시', '경상북도 포항시'),
('경상북도', '경주시', '경상북도 경주시'),
('경상북도', '김천시', '경상북도 김천시'),
('경상북도', '안동시', '경상북도 안동시'),
('경상북도', '구미시', '경상북도 구미시'),
('경상북도', '영주시', '경상북도 영주시'),
('경상북도', '영천시', '경상북도 영천시'),
('경상북도', '상주시', '경상북도 상주시'),
('경상북도', '문경시', '경상북도 문경시'),
('경상북도', '경산시', '경상북도 경산시');

-- 경상남도
INSERT INTO locations (city, district, full_name) VALUES
('경상남도', '창원시', '경상남도 창원시'),
('경상남도', '진주시', '경상남도 진주시'),
('경상남도', '통영시', '경상남도 통영시'),
('경상남도', '사천시', '경상남도 사천시'),
('경상남도', '김해시', '경상남도 김해시'),
('경상남도', '밀양시', '경상남도 밀양시'),
('경상남도', '거제시', '경상남도 거제시'),
('경상남도', '양산시', '경상남도 양산시');

-- 제주특별자치도
INSERT INTO locations (city, district, full_name) VALUES
('제주특별자치도', '제주시', '제주특별자치도 제주시'),
('제주특별자치도', '서귀포시', '제주특별자치도 서귀포시');