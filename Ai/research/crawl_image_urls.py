"""
29CM 상품 이미지 URL 크롤링
============================
파일명에서 상품 ID 추출 → 29CM 상품 페이지 접근 → 이미지 URL 수집
결과를 metadata.csv의 image_url 컬럼에 저장하고
PostgreSQL products 테이블 image_url 도 업데이트합니다.

사용법:
  python Ai/research/crawl_image_urls.py
"""

import os
import re
import time
import random
import pandas as pd
import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv

# ── 환경 설정 ─────────────────────────────────────
BASE_DIR  = os.path.dirname(os.path.abspath(__file__))
AI_DIR    = os.path.dirname(BASE_DIR)
ROOT_DIR  = os.path.dirname(AI_DIR)
load_dotenv(os.path.join(AI_DIR, ".env"))
load_dotenv(os.path.join(ROOT_DIR, ".env"))

CSV_PATH = os.path.join(BASE_DIR, "ai_dataset_large", "metadata.csv")

# ── 요청 헤더 (봇 차단 우회) ─────────────────────
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8",
    "Referer": "https://www.29cm.co.kr/",
}

def extract_product_id(filename: str) -> str | None:
    """M_top_p01_3276485.jpg → 3276485"""
    name = os.path.splitext(filename)[0]  # 확장자 제거
    parts = name.split("_")
    # 마지막 숫자 부분이 상품 ID
    for part in reversed(parts):
        if part.isdigit():
            return part
    return None

def get_image_url(product_id: str) -> str | None:
    """29CM 상품 페이지에서 대표 이미지 URL 추출"""
    url = f"https://www.29cm.co.kr/products/{product_id}"
    try:
        resp = requests.get(url, headers=HEADERS, timeout=10)
        if resp.status_code != 200:
            return None

        soup = BeautifulSoup(resp.text, "html.parser")

        # og:image 메타태그에서 대표 이미지 추출 (가장 안정적)
        og_image = soup.find("meta", property="og:image")
        if og_image and og_image.get("content"):
            return og_image["content"]

        # 대안: 상품 이미지 태그 직접 탐색
        img = soup.select_one("img.product-image, img[class*='product'], img[class*='main']")
        if img and img.get("src"):
            src = img["src"]
            if src.startswith("//"):
                src = "https:" + src
            return src

        return None

    except Exception as e:
        print(f"  ⚠️  {product_id} 오류: {e}")
        return None

# ── CSV 로드 ──────────────────────────────────────
df = pd.read_csv(CSV_PATH)
print(f"📊 총 {len(df)}개 상품")

# image_url 컬럼 없으면 추가
if "image_url" not in df.columns:
    df["image_url"] = None

# 이미 크롤링된 건 건너뜀
todo = df[df["image_url"].isna()].index.tolist()
print(f"🔍 크롤링 필요: {len(todo)}개 (이미 완료: {len(df) - len(todo)}개)")
print("=" * 50)

# ── 크롤링 실행 ───────────────────────────────────
SAVE_EVERY = 50
success = 0
failed  = 0

for count, idx in enumerate(todo, start=1):
    filename   = df.at[idx, "filename"]
    product_id = extract_product_id(filename)

    if not product_id:
        print(f"  ⚠️  ID 추출 실패: {filename}")
        failed += 1
        continue

    image_url = get_image_url(product_id)

    if image_url:
        df.at[idx, "image_url"] = image_url
        success += 1
    else:
        failed += 1

    # 진행 상황 출력
    if count % 10 == 0 or count == len(todo):
        print(f"  [{count}/{len(todo)}] {filename} → {image_url or '실패'}")

    # 중간 저장
    if count % SAVE_EVERY == 0:
        df.to_csv(CSV_PATH, index=False, encoding="utf-8-sig")
        print(f"  💾 중간 저장 ({count}개 처리)")

    # 요청 간격 (차단 방지: 0.5~1.5초 랜덤)
    time.sleep(random.uniform(0.5, 1.5))

# ── 최종 저장 ─────────────────────────────────────
df.to_csv(CSV_PATH, index=False, encoding="utf-8-sig")

print()
print("=" * 50)
print(f"✅ 크롤링 완료!")
print(f"   성공: {success}개 | 실패: {failed}개")
print(f"   저장: {CSV_PATH}")

# ── DB products 테이블 image_url 업데이트 ─────────
ans = input("\nDB products 테이블도 업데이트할까요? [y/N] ").strip().lower()
if ans == "y":
    from sqlalchemy import create_engine, text
    DATABASE_URL = os.getenv(
        "DATABASE_URL",
        "postgresql://postgres:password@localhost:5432/fashion2cation"
    )
    engine = create_engine(DATABASE_URL)
    updated = 0
    with engine.begin() as conn:
        for _, row in df[df["image_url"].notna()].iterrows():
            conn.execute(
                text("UPDATE products SET image_url = :url WHERE filename = :fn"),
                {"url": row["image_url"], "fn": row["filename"]}
            )
            updated += 1
    print(f"✅ DB 업데이트 완료: {updated}건")
