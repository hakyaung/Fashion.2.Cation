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

바운딩 박스 전략
---------------
- 1차: 사전학습 YOLOv8n (COCO, person 클래스) 로 person 탐지 →
       그 bbox 를 옷 라벨로 사용 (옷이 사람보다 살짝 넓을 수 있어 10% 확장)
- 2차: person 이 안 잡히는 플랫 레이/상품 컷은 이미지 전체(0.5 0.5 1 1) fallback

이렇게 해야 거리 있는 사진/전신 샷에서도 YOLO 가 정확한 영역을 잡을 수 있음.
(기존: 모든 라벨이 전체 이미지 → 모델이 항상 전체만 반환하는 문제)
"""

import os
import shutil
import platform
import ssl

import pandas as pd
from sklearn.model_selection import train_test_split

# Mac SSL 우회 (ultralytics 가중치 다운로드)
if platform.system() == "Darwin":
    ssl._create_default_https_context = ssl._create_unverified_context

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
# Auto-labeling 모델 로드 (COCO 사전학습 YOLOv8n)
# person(class 0) 탐지만 사용
# ────────────────────────────────────────────────
print("🤖 Auto-labeling 모델 로드 중 (COCO 사전학습 YOLOv8n)...")
from ultralytics import YOLO  # noqa: E402
_auto_labeler = YOLO("yolov8n.pt")
print()

# person bbox expansion 비율 (옷이 사람 외곽선보다 살짝 더 크기 때문)
BBOX_EXPAND = 1.10


def _bbox_for(src_img: str):
    """사전학습 YOLO 로 person bbox 탐지.
    성공하면 (cx, cy, w, h, True), 실패 시 (0.5, 0.5, 1.0, 1.0, False)."""
    try:
        res = _auto_labeler(src_img, classes=[0], conf=0.25, verbose=False)
        if res and len(res) > 0 and res[0].boxes is not None and len(res[0].boxes) > 0:
            xywhn = res[0].boxes.xywhn  # normalized cx, cy, w, h
            areas = xywhn[:, 2] * xywhn[:, 3]
            idx = int(areas.argmax())
            cx, cy, w, h = xywhn[idx].tolist()
            # 옷이 사람 외곽선보다 살짝 더 클 수 있으니 10% 확장 후 [0,1] clamp
            w = max(0.05, min(1.0, w * BBOX_EXPAND))
            h = max(0.05, min(1.0, h * BBOX_EXPAND))
            cx = max(0.0, min(1.0, cx))
            cy = max(0.0, min(1.0, cy))
            return cx, cy, w, h, True
    except Exception as e:
        print(f"  ⚠️  bbox 탐지 실패 ({os.path.basename(src_img)}): {e}")
    return 0.5, 0.5, 1.0, 1.0, False


# ────────────────────────────────────────────────
# 이미지 복사 + 라벨 .txt 생성
# ────────────────────────────────────────────────
def process_split(split_df, split_name):
    ok = skip = auto_hit = auto_miss = 0
    n = len(split_df)
    for i, (_, row) in enumerate(split_df.iterrows()):
        filename   = row["filename"]
        class_id   = cat2id[row["class_label"]]
        src_img    = os.path.join(SRC_IMG_DIR, filename)

        if not os.path.exists(src_img):
            skip += 1
            continue

        # bbox 추출 (실패 시 이미지 전체로 fallback)
        cx, cy, w, h, hit = _bbox_for(src_img)
        if hit:
            auto_hit  += 1
        else:
            auto_miss += 1

        # 이미지 복사
        dst_img = os.path.join(YOLO_DIR, "images", split_name, filename)
        shutil.copy2(src_img, dst_img)

        # 라벨 파일 생성
        label_name = os.path.splitext(filename)[0] + ".txt"
        dst_lbl    = os.path.join(YOLO_DIR, "labels", split_name, label_name)
        with open(dst_lbl, "w") as f:
            # YOLO 포맷: class_id cx cy w h (모두 0~1 정규화)
            f.write(f"{class_id} {cx:.6f} {cy:.6f} {w:.6f} {h:.6f}\n")

        ok += 1
        if (i + 1) % 200 == 0 or (i + 1) == n:
            print(f"  [{split_name}] {i+1}/{n}  auto_hit={auto_hit}  fallback={auto_miss}  skip={skip}")

    print(f"  ✅ {split_name} 완료: {ok}장 (auto={auto_hit}, fallback={auto_miss}) / skip={skip}")


print("🔄 이미지 복사 + auto-labeling 라벨 생성 중...")
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
