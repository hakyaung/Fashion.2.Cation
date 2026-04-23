"""
Fashion.2.Cation — YOLOv8 Detection 학습
==========================================
사전 준비: python convert_to_yolo.py 먼저 실행

학습된 모델은 runs/detect/fashion_yolo/weights/best.pt 에 저장됩니다.
배포용으로는 deploy/ 폴더에 복사합니다.
"""

import os
import json
import random
import shutil
import platform
import ssl

import numpy as np
import torch

# Mac SSL 인증 우회
if platform.system() == "Darwin":
    ssl._create_default_https_context = ssl._create_unverified_context

# ────────────────────────────────────────────────
# 재현성을 위한 시드 고정
# ────────────────────────────────────────────────
SEED = 42
random.seed(SEED)
np.random.seed(SEED)
torch.manual_seed(SEED)
if torch.cuda.is_available():
    torch.cuda.manual_seed_all(SEED)


# ────────────────────────────────────────────────
# 디바이스 자동 감지 (CUDA → MPS → CPU 순 폴백)
# ────────────────────────────────────────────────
def _resolve_device():
    if torch.cuda.is_available():
        return 0  # CUDA GPU 인덱스
    if platform.system() == "Darwin" and torch.backends.mps.is_available():
        return "mps"
    return "cpu"

# ────────────────────────────────────────────────
# 경로 설정
# ────────────────────────────────────────────────
BASE_DIR    = os.path.dirname(os.path.abspath(__file__))
YOLO_DIR    = os.path.join(BASE_DIR, "ai_dataset_yolo")
YAML_PATH   = os.path.join(YOLO_DIR, "dataset.yaml")
DEPLOY_DIR  = os.path.join(os.path.dirname(BASE_DIR), "deploy")
SAVE_PATH   = os.path.join(DEPLOY_DIR, "fashion_yolo.pt")

# ────────────────────────────────────────────────
# 데이터셋 존재 확인
# ────────────────────────────────────────────────
if not os.path.exists(YAML_PATH):
    print("❌ dataset.yaml 이 없습니다. 먼저 convert_to_yolo.py 를 실행해 주세요.")
    print("   python convert_to_yolo.py")
    exit(1)

# ────────────────────────────────────────────────
# YOLOv8 학습
# ────────────────────────────────────────────────
from ultralytics import YOLO

print("=" * 55)
print("  🚀 Fashion.2.Cation — YOLOv8 Detection 학습 시작")
print("=" * 55)

# YOLOv8n (nano) — 가볍고 빠름 / 더 높은 정확도 원하면 yolov8s.pt, yolov8m.pt 사용
model = YOLO("yolov8n.pt")

results = model.train(
    data      = YAML_PATH,
    epochs    = 50,           # 에폭 수 (데이터 적으면 30~50 권장)
    imgsz     = 640,           # 입력 이미지 크기 — 작은 객체/전신 샷까지 잡으려면 640 필수
    batch     = 16,            # imgsz 가 224→640 으로 커진 만큼 배치 축소
    patience  = 10,            # Early stopping (10 에폭 동안 개선 없으면 중단)
    device    = _resolve_device(),  # CUDA → MPS → CPU 자동 폴백
    project   = os.path.join(BASE_DIR, "runs", "detect"),
    name      = "fashion_yolo",
    exist_ok  = True,
    verbose   = True,
    seed      = SEED,          # ultralytics 내부 시드도 고정
)

# ────────────────────────────────────────────────
# 검증 (Validation) + 결과를 JSON 으로 저장
# ────────────────────────────────────────────────
print()
print("📊 검증 중...")
metrics = model.val()
print(f"  mAP50   : {metrics.box.map50:.4f}")
print(f"  mAP50-95: {metrics.box.map:.4f}")

metrics_path = os.path.join(BASE_DIR, "runs", "detect", "fashion_yolo", "val_metrics.json")
try:
    with open(metrics_path, "w", encoding="utf-8") as f:
        json.dump(
            {
                "mAP50":    float(metrics.box.map50),
                "mAP50_95": float(metrics.box.map),
                "seed":     SEED,
                "device":   str(_resolve_device()),
            },
            f, ensure_ascii=False, indent=2,
        )
    print(f"  📝 검증 지표 저장: {metrics_path}")
except Exception as e:
    print(f"  ⚠️  지표 저장 실패: {e}")

# ────────────────────────────────────────────────
# 배포 폴더에 모델 복사
# ────────────────────────────────────────────────
best_pt = os.path.join(BASE_DIR, "runs", "detect", "fashion_yolo", "weights", "best.pt")
if os.path.exists(best_pt):
    shutil.copy2(best_pt, SAVE_PATH)
    print()
    print(f"✅ 최고 모델을 배포 폴더에 복사했습니다: {SAVE_PATH}")
else:
    print(f"⚠️  best.pt 를 찾지 못했습니다. 수동으로 복사해 주세요: {best_pt}")

print()
print("=" * 55)
print("  🎉 학습 완료!")
print(f"  모델 경로: {SAVE_PATH}")
print("  다음 단계: deploy/ai_server.py 실행")
print("=" * 55)
