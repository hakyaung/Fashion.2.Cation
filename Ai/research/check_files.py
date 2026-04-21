"""
데이터셋 파일 검사 & 정리
===========================
1. 손상된(열 수 없는) 이미지 탐지 → bad_images.txt 목록 저장
2. 중복 파일명 제거
3. metadata.csv 에서 손상/없는 이미지 행 제거 → 정리된 CSV 저장
"""

import os
import pandas as pd
from PIL import Image, UnidentifiedImageError

# ────────────────────────────────────────────────
# 경로 설정
# ────────────────────────────────────────────────
BASE_DIR    = os.path.dirname(os.path.abspath(__file__))
IMG_DIR     = os.path.join(BASE_DIR, "ai_dataset_large", "images")
CSV_PATH    = os.path.join(BASE_DIR, "ai_dataset_large", "metadata.csv")
BAD_LOG     = os.path.join(BASE_DIR, "ai_dataset_large", "bad_images.txt")

# ────────────────────────────────────────────────
# Step 1. 이미지 폴더 전체 유효성 검사
# ────────────────────────────────────────────────
print("🔍 이미지 유효성 검사 중...")
print("=" * 50)

all_files = [
    f for f in os.listdir(IMG_DIR)
    if f.lower().endswith((".jpg", ".jpeg", ".png"))
]

bad_files  = []
good_count = 0

for i, filename in enumerate(all_files, 1):
    img_path = os.path.join(IMG_DIR, filename)
    try:
        with Image.open(img_path) as img:
            img.verify()          # 파일 헤더 검증
        good_count += 1
    except (UnidentifiedImageError, Exception):
        bad_files.append(filename)
        print(f"  ❌ 손상 파일: {filename}")

    if i % 500 == 0:
        print(f"  ... {i}/{len(all_files)} 검사 완료")

print()
print(f"✅ 정상 이미지: {good_count}장")
print(f"❌ 손상 이미지: {len(bad_files)}장")

# 손상 파일 목록 저장
if bad_files:
    with open(BAD_LOG, "w", encoding="utf-8") as f:
        for name in bad_files:
            f.write(name + "\n")
    print(f"📝 손상 파일 목록 저장: {BAD_LOG}")

# ────────────────────────────────────────────────
# Step 2. metadata.csv 정리
#   - 손상된 이미지 행 제거
#   - 실제 파일이 없는 행 제거
#   - 중복 파일명 제거
# ────────────────────────────────────────────────
print()
print("🧹 metadata.csv 정리 중...")
print("=" * 50)

df = pd.read_csv(CSV_PATH)
original_count = len(df)
print(f"원본 데이터: {original_count}행")

# 실제 폴더에 있는 파일 목록
existing_files = set(os.listdir(IMG_DIR))
bad_set        = set(bad_files)

# 없는 파일 제거
missing_mask = ~df["filename"].isin(existing_files)
missing_count = missing_mask.sum()
if missing_count > 0:
    print(f"  🗑️  파일 없는 행 제거: {missing_count}개")
    df = df[~missing_mask]

# 손상 파일 제거
bad_mask = df["filename"].isin(bad_set)
bad_count = bad_mask.sum()
if bad_count > 0:
    print(f"  🗑️  손상 이미지 행 제거: {bad_count}개")
    df = df[~bad_mask]

# 중복 파일명 제거
dup_count = df.duplicated(subset=["filename"]).sum()
if dup_count > 0:
    print(f"  🗑️  중복 행 제거: {dup_count}개")
    df = df.drop_duplicates(subset=["filename"])

# 인덱스 재정렬 후 저장
df = df.reset_index(drop=True)
df.to_csv(CSV_PATH, index=False, encoding="utf-8-sig")

removed_total = original_count - len(df)
print()
print("=" * 50)
print(f"🎉 정리 완료!")
print(f"   원본: {original_count}행  →  최종: {len(df)}행  (제거: {removed_total}행)")
print(f"   저장 위치: {CSV_PATH}")

if bad_files:
    print()
    print("⚠️  손상된 이미지 파일들은 images/ 폴더에 그대로 남아 있습니다.")
    print("   필요하면 아래 명령어로 한 번에 삭제할 수 있어요:")
    print(f"   -> bad_images.txt 목록 참고: {BAD_LOG}")
