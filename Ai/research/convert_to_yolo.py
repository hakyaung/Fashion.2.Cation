"""
metadata.csv → YOLOv8 Detection 포맷 변환 (패션 사전학습 자동 라벨링)
==================================================================
출력 구조:
  ai_dataset_yolo/
    images/{train,val}/   *.jpg
    labels/{train,val}/   *.txt   (multi-bbox per image)
    dataset.yaml
    classes.txt

이번 버전의 핵심
----------------
- HuggingFace 의 패션 사전학습 detector (`yainage90/fashion-object-detection`,
  Conditional DETR / transformers) 로 각 이미지에서
  **모든 옷 항목을 multi-class · multi-bbox 로 자동 라벨링**.
- 패션 모델 클래스(top/bottom/dress/outer/skirt/shoes/...) →
  CSV 의 gender 와 결합해 우리 9-클래스 (예: 여성_상의, 공용_신발) 로 매핑.
- detection 0개인 사진은 fallback 으로 이미지 전체 + CSV primary class 사용.
- train.py 학습은 yolov8n.pt (COCO-pretrained) 에서 시작.
  (DETR weight 는 Ultralytics YOLO 와 호환되지 않으므로 라벨링 단계에만 사용)

기존 문제와의 차이
- 이전: 모든 이미지의 라벨이 (0.5 0.5 1.0 1.0) 또는 person bbox 1개
        → 모델이 항상 "전체 영역 = 한 클래스" 로 학습
- 신규: 한 사진에 상의·하의·가방·신발 등을 **각각 다른 bbox** 로 학습
        → 거리 사진/가방·신발/multi-item 사진 정상 detection
"""

import os
import shutil
import platform
import ssl
from collections import Counter

import pandas as pd
from sklearn.model_selection import train_test_split

# Mac SSL 우회 (ultralytics 가중치 다운로드)
if platform.system() == "Darwin":
    ssl._create_default_https_context = ssl._create_unverified_context

# ────────────────────────────────────────────────
# 패션 모델 클래스 → 우리 카테고리 매핑
# 우리 9-클래스: ['공용_신발', '남성_상의', '남성_아우터', '남성_하의',
#               '여성_상의', '여성_아우터', '여성_원피스', '여성_치마', '여성_하의']
# → 카테고리: 신발(공용), 상의, 아우터, 하의, 원피스, 치마
# (가방·모자 클래스는 우리 분류에 없으니 skip)
# ────────────────────────────────────────────────
FASHION_TO_CATEGORY = {
    # yainage90/fashion-object-detection 표준 클래스
    "top":     "상의",
    "bottom":  "하의",
    "dress":   "원피스",     # 우리 분류에 별도 카테고리 있음 (여성_원피스)
    "outer":   "아우터",
    "skirt":   "치마",       # 우리 분류에 별도 카테고리 있음 (여성_치마)
    "shoes":   "신발",       # gender 무시, 항상 공용_신발 로 매핑
    "bag":     None,         # 우리 분류에 없음
    "hat":     None,         # 우리 분류에 없음
    # DeepFashion2 호환 클래스 (다른 모델 swap 시 자동 호환)
    "short_sleeve_top":      "상의",
    "long_sleeve_top":       "상의",
    "short_sleeve_outwear":  "아우터",
    "long_sleeve_outwear":   "아우터",
    "vest":                  "상의",
    "sling":                 "상의",
    "shorts":                "하의",
    "trousers":              "하의",
    "short_sleeve_dress":    "원피스",
    "long_sleeve_dress":     "원피스",
    "vest_dress":            "원피스",
    "sling_dress":           "원피스",
}

# 신뢰도 임계값 (낮으면 false positive 늘어남, 높으면 누락)
DETECTION_CONF = 0.30

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
if "class_label" not in df.columns:
    df["class_label"] = df["gender"] + "_" + df["category"]

# CSV 에 gender 컬럼이 없을 수 있음 (class_label 에 이미 합쳐진 경우)
# class_label = "여성_상의" / "공용_신발" → 첫 토큰을 gender 로 사용
if "gender" not in df.columns:
    df["gender"] = df["class_label"].apply(lambda s: str(s).split("_", 1)[0])

categories = sorted(df["class_label"].unique().tolist())
cat2id = {cat: i for i, cat in enumerate(categories)}

print(f"📦 총 데이터: {len(df)}장")
print(f"🏷️  우리 9-클래스 ({len(categories)}개): {categories}")
print(f"   gender 종류: {sorted(df['gender'].unique().tolist())}")
print()

# ────────────────────────────────────────────────
# Train / Val 분할 (80:20, class_label 비율 유지)
# ────────────────────────────────────────────────
train_df, val_df = train_test_split(
    df, test_size=0.2, random_state=42, stratify=df["class_label"]
)
train_df = train_df.reset_index(drop=True)
val_df   = val_df.reset_index(drop=True)
print(f"📚 Train: {len(train_df)}장  |  📝 Val: {len(val_df)}장")
print()


# ────────────────────────────────────────────────
# 패션 사전학습 detector 로드 (Conditional DETR via transformers)
#
# yainage90/fashion-object-detection 은 Ultralytics YOLO 가 아니라
# HuggingFace transformers 기반 Conditional DETR 임.
#   클래스: bag, bottom, dress, hat, outer, shoes, top
# → 자동 라벨링 단계만 이 모델로 수행하고,
#   train.py 의 시작 weight 는 yolov8n.pt (COCO) 폴백.
# ────────────────────────────────────────────────
print("🤖 패션 사전학습 detector 로드 중 (최초 1회만, 이후 ~/.cache 캐시 사용)...")
try:
    import torch
    from PIL import Image
    from transformers import (
        AutoImageProcessor,
        AutoModelForObjectDetection,
    )
except ImportError as e:
    raise SystemExit(
        f"\n❌ 필요한 패키지가 없습니다 ({e.name}).\n"
        "   설치: pip install transformers torch pillow timm\n"
    )

HF_REPO = "yainage90/fashion-object-detection"
try:
    processor = AutoImageProcessor.from_pretrained(HF_REPO)
    detector  = AutoModelForObjectDetection.from_pretrained(HF_REPO)
except ImportError as e:
    # timm 같은 의존성 누락 — 네트워크 문제 아님
    raise SystemExit(
        f"\n❌ 의존성 누락: {e}\n"
        "   설치: pip install timm transformers torch pillow\n"
        "   (DETR backbone 이 timm 라이브러리를 필요로 합니다)\n"
    )
except Exception as e:
    raise SystemExit(
        f"\n❌ 패션 detector 다운로드 실패: {type(e).__name__}: {e}\n"
        "   네트워크 확인 후 재시도하세요.\n"
    )

# 디바이스 (MPS / CUDA / CPU)
if torch.cuda.is_available():
    DET_DEVICE = torch.device("cuda")
elif platform.system() == "Darwin" and torch.backends.mps.is_available():
    DET_DEVICE = torch.device("mps")
else:
    DET_DEVICE = torch.device("cpu")
detector = detector.to(DET_DEVICE).eval()

id2label = detector.config.id2label
fashion_classes = [id2label[i] for i in sorted(id2label.keys(), key=int)]
print(f"   ✓ 모델: {HF_REPO}  (device={DET_DEVICE})")
print(f"   ✓ 모델 클래스 ({len(fashion_classes)}개): {fashion_classes}")
print()

# 매핑 검증
mapped   = [c for c in fashion_classes if FASHION_TO_CATEGORY.get(c.lower())]
unmapped = [c for c in fashion_classes if not FASHION_TO_CATEGORY.get(c.lower())]
print("🔍 클래스 매핑 검증:")
print(f"   매핑 OK ({len(mapped)}): {mapped}")
print(f"   skip ({len(unmapped)}): {unmapped}")
if not mapped:
    raise SystemExit("\n❌ 매핑되는 클래스가 없습니다 — FASHION_TO_CATEGORY 확인.\n")
print()


@torch.inference_mode()
def detect_boxes(pil_image):
    """이미지 1장 → [(class_name, cx, cy, w, h), ...] (정규화된 xywh)."""
    inputs = processor(images=pil_image, return_tensors="pt").to(DET_DEVICE)
    outputs = detector(**inputs)
    target_sizes = torch.tensor([pil_image.size[::-1]], device=DET_DEVICE)  # (H, W)
    results = processor.post_process_object_detection(
        outputs, threshold=DETECTION_CONF, target_sizes=target_sizes
    )[0]

    W, H = pil_image.size
    out = []
    for score, label, box in zip(results["scores"], results["labels"], results["boxes"]):
        cls_name = id2label[int(label)]
        x1, y1, x2, y2 = box.tolist()
        cx = ((x1 + x2) / 2.0) / W
        cy = ((y1 + y2) / 2.0) / H
        w  = (x2 - x1) / W
        h  = (y2 - y1) / H
        out.append((cls_name, cx, cy, w, h))
    return out


def _resolve_our_class_id(fashion_class_name: str, gender: str):
    """패션 클래스 + gender → 우리 class_id. 매핑 안 되면 None.

    - 신발: 우리 체계에서 항상 '공용_신발' 하나뿐 → gender 무시
    - 그 외: '{gender}_{category}' 조합으로 매핑 (예: 여성_상의)
    - 조합이 우리 9-클래스에 없으면 None (예: 남성_원피스, 남성_치마)
    """
    category = FASHION_TO_CATEGORY.get(fashion_class_name.lower())
    if category is None:
        return None
    if category == "신발":
        return cat2id.get("공용_신발")
    our_class = f"{gender}_{category}"
    return cat2id.get(our_class)


# ────────────────────────────────────────────────
# 이미지 복사 + multi-bbox 라벨 .txt 생성
# ────────────────────────────────────────────────
def process_split(split_df, split_name):
    ok = skip = no_det = 0
    cls_counter = Counter()
    n = len(split_df)

    for i, (_, row) in enumerate(split_df.iterrows()):
        filename = row["filename"]
        gender   = row["gender"]
        primary_cls_id = cat2id[row["class_label"]]
        src_img  = os.path.join(SRC_IMG_DIR, filename)

        if not os.path.exists(src_img):
            skip += 1
            continue

        # 패션 detector 로 모든 옷 항목 detection
        labels = []
        try:
            with Image.open(src_img) as im:
                pil = im.convert("RGB")
            for cls_name, cx, cy, w, h in detect_boxes(pil):
                cls_id = _resolve_our_class_id(cls_name, gender)
                if cls_id is None:
                    continue
                # [0,1] clamp (안전장치)
                cx = max(0.0, min(1.0, cx))
                cy = max(0.0, min(1.0, cy))
                w  = max(0.01, min(1.0, w))
                h  = max(0.01, min(1.0, h))
                labels.append((cls_id, cx, cy, w, h))
                cls_counter[cls_name] += 1
        except Exception as e:
            print(f"  ⚠️  detection 에러 {filename}: {e}")

        # detection 0개면 fallback (이미지 전체 + CSV primary class)
        if not labels:
            labels.append((primary_cls_id, 0.5, 0.5, 1.0, 1.0))
            no_det += 1

        # 이미지 복사
        dst_img = os.path.join(YOLO_DIR, "images", split_name, filename)
        shutil.copy2(src_img, dst_img)

        # 라벨 파일 생성 (multi-bbox)
        label_name = os.path.splitext(filename)[0] + ".txt"
        dst_lbl    = os.path.join(YOLO_DIR, "labels", split_name, label_name)
        with open(dst_lbl, "w") as f:
            for cls_id, cx, cy, w, h in labels:
                f.write(f"{cls_id} {cx:.6f} {cy:.6f} {w:.6f} {h:.6f}\n")

        ok += 1
        if (i + 1) % 200 == 0 or (i + 1) == n:
            print(f"  [{split_name}] {i+1}/{n}  fallback={no_det}  skip={skip}")

    print(f"  ✅ {split_name} 완료: {ok}장 (정상 detection={ok-no_det}, fallback={no_det}, skip={skip})")
    print(f"     클래스별 detection 횟수: {dict(cls_counter)}")


print("🔄 이미지 복사 + 패션 사전학습 모델 자동 라벨링 중...")
process_split(train_df, "train")
process_split(val_df,   "val")

# ────────────────────────────────────────────────
# dataset.yaml 생성
# ────────────────────────────────────────────────
yaml_path = os.path.join(YOLO_DIR, "dataset.yaml")
names_str = "\n".join([f"  {i}: {cat}" for i, cat in enumerate(categories)])
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

# 패션 detector(transformers DETR) 는 Ultralytics YOLO weight 로 못 씀.
# → train.py 의 시작 weight 는 yolov8n.pt 폴백을 쓴다 (marker 파일 생성하지 않음).
# 혹시 이전에 잘못된 marker 가 있다면 정리.
marker_path = os.path.join(YOLO_DIR, "fashion_pretrained_path.txt")
if os.path.exists(marker_path):
    try:
        os.remove(marker_path)
    except OSError:
        pass

# classes.txt
classes_path = os.path.join(YOLO_DIR, "classes.txt")
with open(classes_path, "w", encoding="utf-8") as f:
    for cat in categories:
        f.write(cat + "\n")

print()
print("=" * 60)
print(f"🎉 YOLO 데이터셋 변환 완료!")
print(f"   저장 위치: {YOLO_DIR}")
print(f"   dataset.yaml: {yaml_path}")
print(f"   학습 시작 weight: yolov8n.pt (COCO-pretrained, train.py 폴백)")
print()
print("  다음 단계: python train.py")
print("            → 패션 사전학습 weight 자동으로 시작점 사용")
print("=" * 60)
