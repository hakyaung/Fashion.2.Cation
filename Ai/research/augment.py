"""
오프라인 데이터 증폭 (Offline Augmentation)
=============================================
ai_dataset_yolo/images/train/ 의 이미지를 증폭해서
클래스당 ~1,800장으로 늘립니다 (약 3배).

적용 변환:
  - 좌우 반전 (Horizontal Flip)
  - 밝기 / 대비 조정
  - 색조 / 채도 조정
  - 소폭 회전 (±15°)
  - 랜덤 줌 (0.85~1.0)
  - 가우시안 블러

※ 라벨 파일(바운딩박스 = 이미지 전체)은 변환 후에도 동일하게 유지됩니다.
"""

import os
import random
import numpy as np
from PIL import Image, ImageEnhance, ImageFilter

# ────────────────────────────────────────────────
# 경로 설정
# ────────────────────────────────────────────────
BASE_DIR    = os.path.dirname(os.path.abspath(__file__))
YOLO_DIR    = os.path.join(BASE_DIR, "ai_dataset_yolo")
IMG_DIR     = os.path.join(YOLO_DIR, "images", "train")
LABEL_DIR   = os.path.join(YOLO_DIR, "labels", "train")

TARGET_PER_CLASS = 1800   # 클래스당 목표 이미지 수
SEED             = 42
random.seed(SEED)

# ────────────────────────────────────────────────
# 현재 클래스별 파일 목록 파악
# ────────────────────────────────────────────────
all_images = [f for f in os.listdir(IMG_DIR) if f.lower().endswith((".jpg", ".jpeg", ".png"))]

# 클래스별로 그룹핑 (라벨 파일에서 class_id 읽기)
from collections import defaultdict
class_files = defaultdict(list)

for img_file in all_images:
    label_file = os.path.splitext(img_file)[0] + ".txt"
    label_path = os.path.join(LABEL_DIR, label_file)
    if os.path.exists(label_path):
        with open(label_path) as f:
            line = f.readline().strip()
            if line:
                class_id = int(line.split()[0])
                class_files[class_id].append(img_file)

print("📊 현재 클래스별 이미지 수:")
for cls_id in sorted(class_files.keys()):
    print(f"  클래스 {cls_id}: {len(class_files[cls_id])}장")
print(f"  총합: {sum(len(v) for v in class_files.values())}장")
print()

# ────────────────────────────────────────────────
# 증폭 변환 함수들
# ────────────────────────────────────────────────
def aug_hflip(img):
    """좌우 반전"""
    return img.transpose(Image.FLIP_LEFT_RIGHT)

def aug_brightness(img):
    """밝기 랜덤 조정 (0.7 ~ 1.4)"""
    factor = random.uniform(0.7, 1.4)
    return ImageEnhance.Brightness(img).enhance(factor)

def aug_contrast(img):
    """대비 랜덤 조정 (0.7 ~ 1.4)"""
    factor = random.uniform(0.7, 1.4)
    return ImageEnhance.Contrast(img).enhance(factor)

def aug_color(img):
    """채도 랜덤 조정 (0.6 ~ 1.5)"""
    factor = random.uniform(0.6, 1.5)
    return ImageEnhance.Color(img).enhance(factor)

def aug_rotate(img):
    """소폭 랜덤 회전 (±15°), 흰 배경 채움"""
    angle = random.uniform(-15, 15)
    return img.rotate(angle, fillcolor=(255, 255, 255), expand=False)

def aug_zoom(img):
    """랜덤 줌 크롭 (0.85~1.0 비율 유지)"""
    w, h = img.size
    scale = random.uniform(0.85, 1.0)
    new_w, new_h = int(w * scale), int(h * scale)
    left  = random.randint(0, w - new_w)
    top   = random.randint(0, h - new_h)
    img   = img.crop((left, top, left + new_w, top + new_h))
    return img.resize((w, h), Image.LANCZOS)

def aug_blur(img):
    """가우시안 블러 (약하게)"""
    return img.filter(ImageFilter.GaussianBlur(radius=random.uniform(0.5, 1.2)))

# 변환 조합 목록 (각 조합으로 새 이미지 생성)
AUGMENTATIONS = [
    ("hflip",              lambda img: aug_hflip(img)),
    ("bright",             lambda img: aug_brightness(img)),
    ("contrast",           lambda img: aug_contrast(img)),
    ("color",              lambda img: aug_color(img)),
    ("rotate",             lambda img: aug_rotate(img)),
    ("zoom",               lambda img: aug_zoom(img)),
    ("hflip_bright",       lambda img: aug_brightness(aug_hflip(img))),
    ("hflip_color",        lambda img: aug_color(aug_hflip(img))),
    ("rotate_bright",      lambda img: aug_brightness(aug_rotate(img))),
    ("zoom_contrast",      lambda img: aug_contrast(aug_zoom(img))),
    ("blur_bright",        lambda img: aug_brightness(aug_blur(img))),
    ("hflip_zoom",         lambda img: aug_zoom(aug_hflip(img))),
]

# ────────────────────────────────────────────────
# 클래스별 증폭 수행
# ────────────────────────────────────────────────
total_created = 0

for cls_id, files in sorted(class_files.items()):
    current = len(files)
    needed  = max(0, TARGET_PER_CLASS - current)

    if needed == 0:
        print(f"  클래스 {cls_id}: 이미 {current}장 ≥ {TARGET_PER_CLASS}장, 건너뜀")
        continue

    print(f"  클래스 {cls_id}: {current}장 → {TARGET_PER_CLASS}장 ({needed}장 생성 중...)")

    # 원본 파일을 반복 사용해서 needed 만큼 생성
    aug_pool = AUGMENTATIONS.copy()
    created  = 0

    while created < needed:
        # 원본 파일 랜덤 선택
        src_file = random.choice(files)
        src_path = os.path.join(IMG_DIR, src_file)

        # 변환 선택 (aug_pool 소진되면 다시 채움)
        if not aug_pool:
            aug_pool = AUGMENTATIONS.copy()
        aug_name, aug_fn = random.choice(aug_pool)

        try:
            img = Image.open(src_path).convert("RGB")
            aug_img = aug_fn(img)

            # 저장 파일명: 원본명_aug_변환명_순번.jpg
            base  = os.path.splitext(src_file)[0]
            new_name  = f"{base}_aug_{aug_name}_{created:04d}.jpg"
            new_img_path   = os.path.join(IMG_DIR, new_name)
            new_label_path = os.path.join(LABEL_DIR, os.path.splitext(new_name)[0] + ".txt")

            # 이미 존재하면 건너뜀
            if os.path.exists(new_img_path):
                created += 1
                continue

            aug_img.save(new_img_path, quality=90)

            # 라벨 파일 복사 (바운딩박스 = 이미지 전체이므로 동일)
            src_label = os.path.join(LABEL_DIR, os.path.splitext(src_file)[0] + ".txt")
            with open(src_label) as lf:
                label_content = lf.read()
            with open(new_label_path, "w") as lf:
                lf.write(label_content)

            created += 1
            total_created += 1

        except Exception as e:
            print(f"    ⚠️ {src_file} 처리 중 오류: {e}")

    print(f"    ✅ {created}장 생성 완료")

# ────────────────────────────────────────────────
# 최종 결과
# ────────────────────────────────────────────────
final_count = len([f for f in os.listdir(IMG_DIR) if f.lower().endswith((".jpg", ".jpeg", ".png"))])

print()
print("=" * 50)
print(f"🎉 증폭 완료!")
print(f"   생성된 이미지: {total_created}장")
print(f"   최종 학습 이미지: {final_count}장")
print()
print("  다음 단계: python train.py")
print("=" * 50)
