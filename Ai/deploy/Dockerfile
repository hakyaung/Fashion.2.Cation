# 1. 파이썬 3.10 슬림 버전을 베이스로 사용 (용량이 가벼움)
FROM python:3.10-slim

# 2. 우분투 시스템에서 이미지 처리에 필요한 라이브러리 설치
RUN apt-get update && apt-get install -y \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# 3. 서버 내 작업 폴더 설정
WORKDIR /app

# 4. 라이브러리 설치 (캐시를 사용해 속도를 높임)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 5. 현재 폴더의 모든 파일(모델, 코드)을 서버로 복사
COPY . .

# 6. AI 서버가 사용할 8001번 포트 열기
EXPOSE 8001

# 7. 서버 실행 명령
CMD ["uvicorn", "ai_server:app", "--host", "0.0.0.0", "--port", "8001"]