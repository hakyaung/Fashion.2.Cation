"""
이미지 파일명 한글 → 영문 변환
================================
남성_상의_p01_3276485.jpg → M_top_p01_3276485.jpg

변환 후 metadata.csv의 filename 컬럼도 자동 업데이트
"""

import os
import pandas as pd

# ────────────────────────────────────────────────
# 경로 설정
# ────────────────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
IMG_DIR  = os.path.join(BASE_DIR, "ai_dataset_large", "images")
CSV_PATH = os.path.join(BASE_DIR, "ai_dataset_large", "metadata.csv")

# ────────────────────────────────────────────────
# 한글 → 영문 매핑
# ────────────────────────────────────────────────
GENDER_MAP = {
    "남성": "M",
    "여성": "F",
    "공용": "U",
}
CATEGORY_MAP = {
    "상의":   "top",
    "하의":   "bottom",
    "아우터": "outer",
    "원피스": "onepiece",
    "스커트": "skirt",
    "신발":   "shoes",
}

def korean_to_eng(filename: str) -> str:
    """남성_상의_p01_3276485.jpg → M_top_p01_3276485.jpg"""
    parts = filename.split("_")
    if len(parts) < 2:
        return filename

    gender   = GENDER_MAP.get(parts[0], parts[0])
    category = CATEGORY_MAP.get(parts[1], parts[1])
    rest     = "_".join(parts[2:])  # p01_3276485.jpg

    return f"{gender}_{category}_{rest}"

# ────────────────────────────────────────────────
# 파일 이름 변환
# ────────────────────────────────────────────────
all_files = [f for f in os.listdir(IMG_DIR) if f.lower().endswith((".jpg", ".jpeg", ".png"))]
print(f"📂 총 {len(all_files)}개 파일 변환 시작...")
print("=" * 50)

rename_map = {}  # {old_name: new_name}
skip = 0

for old_name in all_files:
    new_name = korean_to_eng(old_name)
    if old_name == new_name:
        skip += 1
        continue

    old_path = os.path.join(IMG_DIR, old_name)
    new_path = os.path.join(IMG_DIR, new_name)

    if os.path.exists(new_path):
        print(f"  ⚠️  이미 존재: {new_name} (건너뜀)")
        skip += 1
        continue

    os.rename(old_path, new_path)
    rename_map[old_name] = new_name

print(f"  ✅ 변환 완료: {len(rename_map)}개")
print(f"  ⏭️  건너뜀: {skip}개")

# ────────────────────────────────────────────────
# metadata.csv filename 컬럼 업데이트
# ────────────────────────────────────────────────
print()
print("📝 metadata.csv 업데이트 중...")
df = pd.read_csv(CSV_PATH)
df["filename"] = df["filename"].map(lambda x: rename_map.get(x, x))
df.to_csv(CSV_PATH, index=False, encoding="utf-8-sig")
print(f"  ✅ metadata.csv 저장 완료")

# ────────────────────────────────────────────────
# 변환 샘플 출력
# ────────────────────────────────────────────────
print()
print("📋 변환 샘플:")
for old, new in list(rename_map.items())[:5]:
    print(f"  {old}  →  {new}")

print()
print("=" * 50)
print("🎉 완료! 이제 파이프라인 Step 2~4를 다시 실행하세요:")
print("   python run_pipeline.py --step 2")
print("   python run_pipeline.py --step 3")
print("   python run_pipeline.py --step 4")
