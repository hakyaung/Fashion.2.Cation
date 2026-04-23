# ─────────────────────────────────────────────
# Fashion.2.Cation — AI 서버 Dockerfile
# 빌드 명령 (프로젝트 루트에서 실행):
#   docker build -f Ai/deploy/Dockerfile -t f2c-ai ./Ai
# ─────────────────────────────────────────────

# 1. 베이스 이미지 (Python 3.10 slim)
FROM python:3.10-slim

# 2. 이미지 처리에 필요한 시스템 라이브러리
RUN apt-get update && apt-get install -y \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# 3. 작업 디렉토리
WORKDIR /app

# 4. 패키지 설치 (캐시 활용을 위해 먼저 복사)
COPY deploy/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 5. AI 서버 코드
COPY deploy/ai_server.py .
COPY deploy/products_table.sql .

# 6. 학습된 모델 (YOLO 디텍터 + 색상/스타일 분류기)
COPY deploy/fashion_yolo.pt .
COPY deploy/fashion_attr.pt .

# 7. 라벨 맵 (research 폴더에서 복사)
#    label_maps.json 이 없으면 모델 내장 클래스명을 사용합니다
COPY research/ai_dataset_large/label_maps.json . 2>/dev/null || true

# 8. 포트 오픈
EXPOSE 8001

# 9. 서버 실행
CMD ["uvicorn", "ai_server:app", "--host", "0.0.0.0", "--port", "8001"]
