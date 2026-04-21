"""
메타데이터 정리 & 인코딩
===========================
1. processed_images/ 에 실제 존재하는 파일만 필터링
2. gender + category 합쳐서 class_label 생성 (남성_상의, 여성_하의 등 9개)
3. 한글 컬럼 → 숫자 인코딩
   - gender        : 남성→0, 여성→1, 공용→2
   - category      : 상의→0, 하의→1, 아우터→2, 원피스→3, 스커트→4, 신발→5
   - class_label   : 9개 조합 클래스 → 숫자
   - color / style : 영어 그대로 → 숫자
4. 결과 저장 → final_multitask_data.csv
"""

import os
import re
import json
import pandas as pd

# ────────────────────────────────────────────────
# 경로 설정
# ────────────────────────────────────────────────
BASE_DIR           = os.path.dirname(os.path.abspath(__file__))
DATA_DIR           = os.path.join(BASE_DIR, "ai_dataset_large")
PROCESSED_IMG_DIR  = os.path.join(DATA_DIR, "processed_images")
ORIGINAL_CSV       = os.path.join(DATA_DIR, "metadata.csv")
FINAL_CSV          = os.path.join(DATA_DIR, "final_multitask_data.csv")
LABEL_MAP_PATH     = os.path.join(DATA_DIR, "label_maps.json")  # 인코딩 맵 저장

# ────────────────────────────────────────────────
# 제품명 클리닝 함수
# ────────────────────────────────────────────────
def clean_product_name(name: str) -> str:
    if not isinstance(name, str):
        return name

    # 1. 대괄호 안 내용 제거 — [2PACK], [한삐우 PICK], [3차 예약출고], [29CM 단독] 등
    name = re.sub(r'\[.*?\]', '', name)

    # 2. 앞의 1+1, 2+1 번들 표기 제거
    name = re.sub(r'^\d+\+\d+\s*', '', name)

    # 3. 소괄호 안 내용 제거
    def remove_paren(m):
        content = m.group(1).strip()
        # 색상 개수 표기: "12 Color", "7 Colors"
        if re.match(r'^\d+\s*colors?$', content, re.IGNORECASE):
            return ''
        # 홍보/옵션성 슬래시 포함: "WEDDING/빅사이즈 추가/바로배송"
        if '/' in content:
            return ''
        # 숫자로 시작: "260mm까지", "2color"
        if re.match(r'^\d+', content):
            return ''
        # 한글 포함 홍보 문구: "신상컬러 입고", "빅사이즈 추가"
        if re.search(r'[가-힣]', content) and len(content.split()) >= 2:
            return ''
        # 전체 대문자 색상 표기: "CHARCOAL", "MELANGE GRAY", "LIGHT BLUE"
        if re.match(r'^[A-Z][A-Z\s]+$', content):
            return ''
        # 소문자 약어 한 단어: "(uni)", "(new)"
        if re.match(r'^[a-z]{1,5}$', content):
            return ''
        # 단어 3개 이상 홍보 문구
        if len(content.split()) >= 3:
            return ''
        return m.group(0)

    name = re.sub(r'\(([^)]*)\)', remove_paren, name)

    # 4. 언더스코어 뒤 색상/사이즈/코드 제거 — _7COLOR, _CREAM WHITE, _260mm까지
    name = re.sub(r'_[A-Za-z0-9가-힣][A-Za-z0-9가-힣\s]*$', '', name)

    # 5. 앞부분 영문+숫자 제품 코드 제거 — "TF5-SH07 ", "TG2-TS05 "
    name = re.sub(r'^[A-Z]{1,4}\d{1,2}-[A-Z]{1,4}\d{2,5}\s+', '', name)

    # 6. 뒤에 붙은 영문+숫자 제품 코드 제거 — "NTS4786MGZ", "atb1251u", "MDKT076"
    name = re.sub(r'\s+[A-Za-z]{1,4}\d{3,}[A-Za-z0-9]*$', '', name)

    # 7. 앞뒤 공백, 남은 특수문자(- / ,) 정리
    name = re.sub(r'^[\s\-,/]+|[\s\-,/]+$', '', name)
    name = re.sub(r'\s{2,}', ' ', name)

    return name.strip()

# ────────────────────────────────────────────────
# 데이터 로드
# ────────────────────────────────────────────────
df = pd.read_csv(ORIGINAL_CSV)
print(f"📊 원본 데이터: {len(df)}행")

# ────────────────────────────────────────────────
# Step 1. 실제 처리된 이미지만 필터링
# ────────────────────────────────────────────────
processed_files = set(os.listdir(PROCESSED_IMG_DIR))
before = len(df)
df = df[df["filename"].isin(processed_files)].copy()
print(f"🖼️  이미지 필터링: {before}행 → {len(df)}행 ({before - len(df)}개 제거)")

# ────────────────────────────────────────────────
# Step 2. 제품명 클리닝
# ────────────────────────────────────────────────
print(f"\n🧹 제품명 클리닝 중...")
df["product_name"] = df["product_name"].apply(clean_product_name)

# 클리닝 결과 샘플 출력
print("  클리닝 샘플 (before → after):")
sample_before = pd.read_csv(ORIGINAL_CSV)["product_name"].head(5).tolist()
sample_after  = df["product_name"].head(5).tolist()
for b, a in zip(sample_before, sample_after):
    if b != a:
        print(f"  ✂️  {b}")
        print(f"     → {a}")

# ────────────────────────────────────────────────
# Step 3. gender + category 합쳐서 class_label 생성
# ────────────────────────────────────────────────
df["class_label"] = df["gender"] + "_" + df["category"]

print(f"\n🏷️  클래스 분포:")
print(df["class_label"].value_counts().to_string())

# ────────────────────────────────────────────────
# Step 4. 한글 컬럼 인코딩
# ────────────────────────────────────────────────

# gender 인코딩
gender_map = {"남성": 0, "여성": 1, "공용": 2}
df["gender_code"] = df["gender"].map(gender_map).fillna(-1).astype(int)

# category 인코딩
category_map = {"상의": 0, "하의": 1, "아우터": 2, "원피스": 3, "스커트": 4, "신발": 5}
df["category_code"] = df["category"].map(category_map).fillna(-1).astype(int)

# class_label 인코딩 (gender_category 9개 조합)
class_labels = sorted(df["class_label"].unique().tolist())
class_map = {label: i for i, label in enumerate(class_labels)}
df["class_code"] = df["class_label"].map(class_map)

# color 인코딩
color_labels = sorted(df["color"].dropna().unique().tolist())
color_map = {c: i for i, c in enumerate(color_labels)}
df["color_code"] = df["color"].map(color_map).fillna(-1).astype(int)

# style 인코딩
style_labels = sorted(df["style"].dropna().unique().tolist())
style_map = {s: i for i, s in enumerate(style_labels)}
df["style_code"] = df["style"].map(style_map).fillna(-1).astype(int)

# ────────────────────────────────────────────────
# Step 5. 인코딩 맵 저장 (ai_server.py 에서 역변환용)
# ────────────────────────────────────────────────
label_maps = {
    "gender":     {str(v): k for k, v in gender_map.items()},
    "category":   {str(v): k for k, v in category_map.items()},
    "class_label":{str(v): k for k, v in class_map.items()},
    "color":      {str(v): k for k, v in color_map.items()},
    "style":      {str(v): k for k, v in style_map.items()},
}
with open(LABEL_MAP_PATH, "w", encoding="utf-8") as f:
    json.dump(label_maps, f, ensure_ascii=False, indent=2)

print(f"\n🗺️  인코딩 맵 저장: {LABEL_MAP_PATH}")
print(f"   gender   : {gender_map}")
print(f"   category : {category_map}")
print(f"   class    : {class_map}")
print(f"   color    : {color_map}")
print(f"   style    : {style_map}")

# ────────────────────────────────────────────────
# Step 6. 학습 전용 CSV 저장 (한글 컬럼 제거)
# ────────────────────────────────────────────────
train_cols = [
    "filename",
    "brand",         # 브랜드명
    "product_name",  # 클리닝된 제품명
    "class_label",   # 역변환용 (남성_상의 등)
    "gender_code",
    "category_code",
    "class_code",
    "color_code",
    "style_code",
    "price",
    "discount_rate",
    "review_count",
    "heart_count",
    "color_score",
    "style_score",
]
# 실제 존재하는 컬럼만 선택
train_cols = [c for c in train_cols if c in df.columns]
df_train = df[train_cols].reset_index(drop=True)
df_train.to_csv(FINAL_CSV, index=False, encoding="utf-8-sig")

print(f"\n{'='*50}")
print(f"✅ 완료! 최종 데이터: {len(df_train)}행")
print(f"   저장 위치: {FINAL_CSV}")
print(f"\n   컬럼 목록: {list(df_train.columns)}")
