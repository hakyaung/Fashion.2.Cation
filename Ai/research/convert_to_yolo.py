"""
metadata.csv → YOLOv8 Detection 포맷 변환
==========================================
출력 구조:
  ai_dataset_yolo/
    images/
      train/   *.jpg
      val/     *.jpg
    labels/
      train/   *.txt   (YOLO 포맷: class_id cx cy w h)
    dataset.yaml         (YOLOv8 학습 설정 파일)
    classes.txt          (클래스 이름 목록)

상품 이미지 특성상 바운딩 박스 = 이미지 전체 (cx=0.5, cy=0.5, w=1.0, h=1.0)
클래스 = category (상의, 하의, 아우터 등 9개)
"""

import os
import shutil
import pandas as pd
from sklearn.model_selection import train_test_split

# ────────────────────────────────────────────────
# 경로 설정
# ────────────────────────────────────────────────
BASE_DIR    = os.path.dirname(os.path.abspath(__file__))
SRC_IMG_DIR = os.path.join(BASE_DIR, "ai_dataset_large", "processed_images")
CSV_PATH    = os.path.join(BASE_DIR, "ai_dataset_large", "final_multitask_data.csv")
YOLO_DIR    = os.path.join(BASE_DIR, "ai_dataset_yolo")

# ────────────────────────────────────────────────
# 폴더 생성
# ────────────────────────────────────────────────
for split in ["train", "val"]:
    os.makedirs(os.path.join(YOLO_DIR, "images", split), exist_ok=True)
    os.makedirs(os.path.join(YOLO_DIR, "labels", split), exist_ok=True)

# ────────────────────────────────────────────────
# 데이터 로드 및 클래스 매핑
# ────────────────────────────────────────────────
df = pd.read_csv(CSV_PATH)

# class_label(gender+category) 기준 9개 클래스 사용
# clean_metadata.py 에서 이미 class_label 컬럼이 생성되어 있음
if "class_label" not in df.columns:
    df["class_label"] = df["gender"] + "_" + df["category"]

categories = sorted(df["class_label"].unique().tolist())
cat2id = {cat: i for i, cat in enumerate(categories)}

print(f"📦 총 데이터: {len(df)}장")
print(f"🏷️  클래스 {len(categories)}개: {categories}")
print()

# ────────────────────────────────────────────────
# Train / Val 분할 (80:20, category 비율 유지)
# ────────────────────────────────────────────────
train_df, val_df = train_test_split(
    df, test_size=0.2, random_state=42, stratify=df["class_label"]
)
train_df = train_df.reset_index(drop=True)
val_df   = val_df.reset_index(drop=True)

print(f"📚 Train: {len(train_df)}장  |  📝 Val: {len(val_df)}장")
print()

# ────────────────────────────────────────────────
# 이미지 복사 + 라벨 .txt 생성
# ────────────────────────────────────────────────
def process_split(split_df, split_name):
    ok, skip = 0, 0
    for _, row in split_df.iterrows():
        filename   = row["filename"]
        class_id   = cat2id[row["class_label"]]
        src_img    = os.path.join(SRC_IMG_DIR, filename)

        if not os.path.exists(src_img):
            skip += 1
            continue

        # 이미지 복사
        dst_img = os.path.join(YOLO_DIR, "images", split_name, filename)
        shutil.copy2(src_img, dst_img)

        # 라벨 파일 생성 (바운딩 박스 = 이미지 전체)
        label_name = os.path.splitext(filename)[0] + ".txt"
        dst_lbl    = os.path.join(YOLO_DIR, "labels", split_name, label_name)
        with open(dst_lbl, "w") as f:
            # YOLO 포맷: class_id cx cy w h (모두 0~1 정규화)
            f.write(f"{class_id} 0.5 0.5 1.0 1.0\n")

        ok += 1

    print(f"  {split_name}: {ok}장 처리 완료 / {skip}장 이미지 없어서 건너뜀")

print("🔄 이미지 복사 및 라벨 생성 중...")
process_split(train_df, "train")
process_split(val_df,   "val")

# ────────────────────────────────────────────────
# dataset.yaml 생성 (YOLOv8 학습 설정)
# ────────────────────────────────────────────────
yaml_path = os.path.join(YOLO_DIR, "dataset.yaml")
names_str  = "\n".join([f"  {i}: {cat}" for i, cat in enumerate(categories)])

yaml_content = f"""# Fashion.2.Cation YOLOv8 Dataset
path: {YOLO_DIR}
train: images/train
val:   images/val

nc: {len(categories)}
names:
{names_str}
"""
with open(yaml_path, "w", encoding="utf-8") as f:
    f.write(yaml_content)

# classes.txt 생성
classes_path = os.path.join(YOLO_DIR, "classes.txt")
with open(classes_path, "w", encoding="utf-8") as f:
    for cat in categories:
        f.write(cat + "\n")

print()
print("=" * 50)
print(f"🎉 YOLO 데이터셋 변환 완료!")
print(f"   저장 위치: {YOLO_DIR}")
print(f"   dataset.yaml: {yaml_path}")
print()
print("  다음 단계: python train.py")
print("=" * 50)
