import os
import pandas as pd
from PIL import Image
import torch
from transformers import pipeline

# ────────────────────────────────────────────────
# 1. 경로 설정
# ────────────────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
IMG_DIR  = os.path.join(BASE_DIR, "ai_dataset_large", "images")
CSV_PATH = os.path.join(BASE_DIR, "ai_dataset_large", "metadata.csv")

# ────────────────────────────────────────────────
# 2. 하드웨어 설정 (Mac MPS / CUDA / CPU)
# ────────────────────────────────────────────────
if torch.backends.mps.is_available():
    device = torch.device("mps")
elif torch.cuda.is_available():
    device = torch.device("cuda")
else:
    device = torch.device("cpu")

print(f"🔥 실행 환경: {device}")
print("🤖 CLIP 모델 로딩 중... (처음엔 다운로드로 몇 분 걸릴 수 있어요)")

# ────────────────────────────────────────────────
# 3. CLIP 제로샷 분류기
# ────────────────────────────────────────────────
classifier = pipeline(
    "zero-shot-image-classification",
    model="openai/clip-vit-base-patch32",
    device=device
)

# 라벨 후보
color_candidates = [
    "black", "white", "gray", "navy", "blue",
    "red", "pink", "green", "yellow", "brown", "beige", "purple"
]
style_candidates = [
    "casual", "formal", "streetwear", "sportswear",
    "minimalist", "vintage", "preppy", "bohemian"
]

# ────────────────────────────────────────────────
# 4. 데이터셋 로드
# ────────────────────────────────────────────────
df = pd.read_csv(CSV_PATH)

# 이미 라벨링된 행은 건너뜀 (재실행 시 이어서 처리)
if "color" not in df.columns:
    df["color"] = None
if "color_score" not in df.columns:
    df["color_score"] = None
if "style" not in df.columns:
    df["style"] = None
if "style_score" not in df.columns:
    df["style_score"] = None

# color와 style 둘 다 없는 행만 처리
todo = df[df["color"].isna() | df["style"].isna()].index.tolist()
total = len(todo)
print(f"📊 총 {len(df)}장 중 라벨링 필요: {total}장")
if total == 0:
    print("✅ 이미 모두 라벨링 완료!")
    exit()

print("=" * 50)

# ────────────────────────────────────────────────
# 5. 이미지별 color + style 라벨링
# ────────────────────────────────────────────────
SAVE_EVERY = 50  # 50장마다 중간 저장

for count, idx in enumerate(todo, start=1):
    img_name = df.at[idx, "filename"]
    img_path = os.path.join(IMG_DIR, img_name)

    try:
        image = Image.open(img_path).convert("RGB")

        # 색상 분류
        color_result = classifier(image, candidate_labels=color_candidates)
        best_color = color_result[0]
        df.at[idx, "color"]       = best_color["label"]
        df.at[idx, "color_score"] = round(best_color["score"], 4)

        # 스타일 분류
        style_result = classifier(image, candidate_labels=style_candidates)
        best_style = style_result[0]
        df.at[idx, "style"]       = best_style["label"]
        df.at[idx, "style_score"] = round(best_style["score"], 4)

    except FileNotFoundError:
        print(f"  ⚠️  파일 없음: {img_name}")
        df.at[idx, "color"] = "unknown"
        df.at[idx, "color_score"] = 0.0
        df.at[idx, "style"] = "unknown"
        df.at[idx, "style_score"] = 0.0
    except Exception as e:
        print(f"  🚨 에러 ({img_name}): {e}")
        df.at[idx, "color"] = "unknown"
        df.at[idx, "color_score"] = 0.0
        df.at[idx, "style"] = "unknown"
        df.at[idx, "style_score"] = 0.0

    # 진행 상황 출력 (10장마다)
    if count % 10 == 0 or count == total:
        c = df.at[idx, "color"]
        s = df.at[idx, "style"]
        print(f"  [{count}/{total}] {img_name}  →  색상: {c} / 스타일: {s}")

    # 중간 저장 (50장마다)
    if count % SAVE_EVERY == 0:
        df.to_csv(CSV_PATH, index=False)
        print(f"  💾 중간 저장 완료 ({count}장)")

# ────────────────────────────────────────────────
# 6. 최종 저장
# ────────────────────────────────────────────────
df.to_csv(CSV_PATH, index=False)
print("=" * 50)
print(f"🎉 라벨링 완료! metadata.csv에 color / style 컬럼이 추가되었습니다.")
print(f"   저장 위치: {CSV_PATH}")
print()
print("📈 색상 분포:")
print(df["color"].value_counts().to_string())
print()
print("📈 스타일 분포:")
print(df["style"].value_counts().to_string())
