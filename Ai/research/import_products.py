"""
final_multitask_data.csv → PostgreSQL products 테이블 임포트
=============================================================
사용법:
  python Ai/research/import_products.py

환경변수 DATABASE_URL 이 설정되어 있어야 합니다.
없으면 .env 파일 또는 app/core/config.py 의 값을 사용합니다.
"""

import os
import sys
import math
import pandas as pd
from dotenv import load_dotenv

# ── 프로젝트 루트를 sys.path 에 추가 ──────────────────────
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
AI_DIR   = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT_DIR)

# .env 탐색: Ai/.env → 프로젝트 루트/.env 순서
load_dotenv(os.path.join(AI_DIR, ".env")) or load_dotenv(os.path.join(ROOT_DIR, ".env"))

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# ── 경로 설정 ─────────────────────────────────────────────
BASE_DIR    = os.path.dirname(os.path.abspath(__file__))
CSV_PATH    = os.path.join(BASE_DIR, "ai_dataset_large", "final_multitask_data.csv")
LABEL_MAP   = os.path.join(BASE_DIR, "ai_dataset_large", "label_maps.json")

# ── DB 연결 ───────────────────────────────────────────────
try:
    from app.core.config import settings
    DATABASE_URL = settings.DATABASE_URL
except Exception:
    DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:password@localhost:5432/fashion2cation")

print(f"📡 DB 연결: {DATABASE_URL[:40]}...")
engine  = create_engine(DATABASE_URL)
Session = sessionmaker(bind=engine)

# ── CSV 로드 ──────────────────────────────────────────────
if not os.path.exists(CSV_PATH):
    print(f"❌ CSV 파일 없음: {CSV_PATH}")
    print("   먼저 python Ai/research/clean_metadata.py 를 실행하세요.")
    sys.exit(1)

import json
label_maps = {}
if os.path.exists(LABEL_MAP):
    with open(LABEL_MAP, "r", encoding="utf-8") as f:
        label_maps = json.load(f)

# 역맵: 코드 → 한글 이름
gender_inv   = label_maps.get("gender",   {})  # {"0": "남성", ...}
category_inv = label_maps.get("category", {})
class_inv    = label_maps.get("class_label", {})
color_inv    = label_maps.get("color", {})
style_inv    = label_maps.get("style", {})

df = pd.read_csv(CSV_PATH)
print(f"📊 CSV 로드: {len(df)}행")
print(f"   컬럼: {list(df.columns)}")

# ── NaN 처리 헬퍼 ─────────────────────────────────────────
def safe_int(val):
    if val is None or (isinstance(val, float) and math.isnan(val)):
        return None
    return int(val)

def safe_float(val):
    if val is None or (isinstance(val, float) and math.isnan(val)):
        return None
    return float(val)

def safe_str(val):
    if val is None or (isinstance(val, float) and math.isnan(val)):
        return None
    return str(val).strip()

# ── 임포트 실행 ───────────────────────────────────────────
BATCH = 500
inserted = 0
skipped  = 0

with Session() as session:
    # 기존 데이터 초기화 여부 확인
    existing = session.execute(text("SELECT COUNT(*) FROM products")).scalar()
    if existing > 0:
        ans = input(f"⚠️  products 테이블에 이미 {existing}건이 있습니다. 초기화하고 다시 임포트할까요? [y/N] ").strip().lower()
        if ans == "y":
            session.execute(text("TRUNCATE TABLE products RESTART IDENTITY"))
            session.commit()
            print("🗑️  테이블 초기화 완료")
        else:
            print("⏩ 기존 데이터 유지하고 추가 임포트합니다.")

    rows = []
    for idx, row in df.iterrows():
        gender_code   = safe_int(row.get("gender_code"))
        category_code = safe_int(row.get("category_code"))
        class_code    = safe_int(row.get("class_code"))
        color_code    = safe_int(row.get("color_code"))
        style_code    = safe_int(row.get("style_code"))

        # 코드 → 한글 이름 역변환
        gender   = gender_inv.get(str(gender_code))   if gender_code   is not None else None
        category = category_inv.get(str(category_code)) if category_code is not None else None
        color    = color_inv.get(str(color_code))     if color_code    is not None else None
        style    = style_inv.get(str(style_code))     if style_code    is not None else None

        # class_label 은 CSV 에 직접 있음
        class_label = safe_str(row.get("class_label"))
        if not class_label:
            skipped += 1
            continue

        rows.append({
            "filename":        safe_str(row.get("filename")),
            "brand":           safe_str(row.get("brand")),
            "product_name":    safe_str(row.get("product_name")),
            "class_label":     class_label,
            "gender":          gender,
            "category":        category,
            "gender_code":     gender_code,
            "category_code":   category_code,
            "class_code":      class_code,
            "color":           color,
            "style":           style,
            "color_code":      color_code,
            "style_code":      style_code,
            "price":           safe_float(row.get("price")),
            "discount_rate":   safe_float(row.get("discount_rate")),
            "review_count":    safe_int(row.get("review_count")),
            "heart_count":     safe_int(row.get("heart_count")),
            "color_score":     safe_float(row.get("color_score")),
            "style_score":     safe_float(row.get("style_score")),
            "image_url":       None,  # 나중에 S3/CDN URL 로 채울 예정
        })

        # 배치 INSERT
        if len(rows) >= BATCH:
            session.execute(
                text("""
                    INSERT INTO products
                        (filename, brand, product_name, class_label, gender, category,
                         gender_code, category_code, class_code,
                         color, style, color_code, style_code,
                         price, discount_rate, review_count, heart_count,
                         color_score, style_score, image_url)
                    VALUES
                        (:filename, :brand, :product_name, :class_label, :gender, :category,
                         :gender_code, :category_code, :class_code,
                         :color, :style, :color_code, :style_code,
                         :price, :discount_rate, :review_count, :heart_count,
                         :color_score, :style_score, :image_url)
                """),
                rows
            )
            session.commit()
            inserted += len(rows)
            print(f"  📥 {inserted}건 삽입 완료...")
            rows = []

    # 나머지 플러시
    if rows:
        session.execute(
            text("""
                INSERT INTO products
                    (filename, brand, product_name, class_label, gender, category,
                     gender_code, category_code, class_code,
                     color, style, color_code, style_code,
                     price, discount_rate, review_count, heart_count,
                     color_score, style_score, image_url)
                VALUES
                    (:filename, :brand, :product_name, :class_label, :gender, :category,
                     :gender_code, :category_code, :class_code,
                     :color, :style, :color_code, :style_code,
                     :price, :discount_rate, :review_count, :heart_count,
                     :color_score, :style_score, :image_url)
            """),
            rows
        )
        session.commit()
        inserted += len(rows)

print()
print("=" * 50)
print(f"✅ 임포트 완료!")
print(f"   삽입: {inserted}건 | 건너뜀: {skipped}건")
print(f"   테이블: products")
print("=" * 50)