"""
Fashion.2.Cation — 색상/스타일 속성 분류기 학습
===============================================
YOLOv8이 예측하지 못하는 color·style 을 ResNet18 멀티헤드로 분류한다.

입력:  processed_images/*.jpg  +  final_multitask_data.csv
       (preprocess.py 로 processed_images 가 준비돼 있어야 함)

출력:  deploy/fashion_attr.pt
       state_dict 만 저장 — ai_server.py 에서 같은 모델 클래스로 로드.

이번 버전의 개선점
-------------------
1. 시드 완전 고정 (random / numpy / torch / cuda / cudnn)
2. 백본(1e-4) 과 헤드(1e-3) LR 분리 — 사전학습 특성 보존
3. EarlyStopping (patience=5) — 과적합 방지 + 시간 절약
4. Class-weighted CrossEntropy — color/style 불균형 보정
5. FashionDataset 1회 생성 + Subset 으로 train/val 분할 — 정합성 보장
6. val_metrics.json 저장 — 발표/리포트 자동화
"""

import os
import sys
import json
import random
import platform
import ssl
from collections import Counter

import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, Dataset, Subset
from torchvision import models

# custom_dataset.py 는 deploy/ 에 있으므로 경로 추가
_DEPLOY = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "deploy")
sys.path.insert(0, os.path.abspath(_DEPLOY))
from custom_dataset import FashionDataset, train_transform, val_transform  # noqa: E402

# Mac SSL 우회 (torchvision 사전학습 가중치 다운로드용)
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
    torch.backends.cudnn.deterministic = True
    torch.backends.cudnn.benchmark = False

# ────────────────────────────────────────────────
# 경로
# ────────────────────────────────────────────────
BASE_DIR   = os.path.dirname(os.path.abspath(__file__))
DATA_DIR   = os.path.join(BASE_DIR, "ai_dataset_large")
IMG_DIR    = os.path.join(DATA_DIR, "processed_images")
CSV_PATH   = os.path.join(DATA_DIR, "final_multitask_data.csv")
LABEL_MAPS = os.path.join(DATA_DIR, "label_maps.json")

DEPLOY_DIR = os.path.join(os.path.dirname(BASE_DIR), "deploy")
SAVE_PATH  = os.path.join(DEPLOY_DIR, "fashion_attr.pt")
METRICS_PATH = os.path.join(BASE_DIR, "runs", "attribute", "val_metrics.json")

# 하이퍼파라미터
BATCH_SIZE      = 32
EPOCHS          = 30           # EarlyStopping 있으니 조금 늘림
LR_HEAD         = 1e-3
LR_BACKBONE     = 1e-4
WEIGHT_DECAY    = 1e-4
VAL_SPLIT       = 0.15
EARLY_STOP_PATIENCE = 5


# ────────────────────────────────────────────────
# 모델: ResNet18 + 2-head (color, style)
# ai_server.py 가 같은 클래스를 import 해서 state_dict 를 올림
# ────────────────────────────────────────────────
class FashionAttributeNet(nn.Module):
    def __init__(self, num_colors: int, num_styles: int, pretrained: bool = True):
        super().__init__()
        weights = models.ResNet18_Weights.DEFAULT if pretrained else None
        backbone = models.resnet18(weights=weights)
        in_features = backbone.fc.in_features
        backbone.fc = nn.Identity()
        self.backbone = backbone
        self.color_head = nn.Linear(in_features, num_colors)
        self.style_head = nn.Linear(in_features, num_styles)

    def forward(self, x):
        features = self.backbone(x)
        return self.color_head(features), self.style_head(features)


def _resolve_device() -> str:
    if torch.cuda.is_available():
        return "cuda"
    if torch.backends.mps.is_available():
        return "mps"
    return "cpu"


# ────────────────────────────────────────────────
# Subset 에 transform 을 따로 주입하기 위한 얇은 래퍼
# (FashionDataset 을 한 번만 만들고, train/val 에 다른 증강 적용)
# ────────────────────────────────────────────────
class _TransformSubset(Dataset):
    def __init__(self, base: FashionDataset, indices, transform):
        self.base = base
        self.indices = list(indices)
        self.transform = transform

    def __len__(self):
        return len(self.indices)

    def __getitem__(self, i):
        # base.__getitem__ 은 transform 적용 후 반환하므로,
        # base 는 transform=None 상태로 만들어 PIL 을 받고 여기서 적용
        img, labels = self.base[self.indices[i]]
        if self.transform:
            img = self.transform(img)
        return img, labels


def _class_weights(labels, num_classes: int, device: str) -> torch.Tensor:
    """빈도 역수 기반 class weight. 미등장 클래스는 평균치로 보정."""
    counts = Counter()
    for l in labels:
        try:
            li = int(l)
        except (TypeError, ValueError):
            continue
        if li >= 0:
            counts[li] += 1
    mean_count = max(1.0, sum(counts.values()) / max(1, len(counts)))
    weights = torch.tensor(
        [1.0 / counts.get(i, mean_count) for i in range(num_classes)],
        dtype=torch.float32,
    )
    # 평균이 1이 되도록 정규화 — loss scale 이 기존과 비슷하게 유지됨
    weights = weights / weights.mean()
    return weights.to(device)


def main():
    # 데이터 존재 확인
    if not os.path.exists(CSV_PATH):
        raise FileNotFoundError(f"❌ CSV 없음: {CSV_PATH}")
    if not os.path.isdir(IMG_DIR):
        raise FileNotFoundError(
            f"❌ 이미지 폴더 없음: {IMG_DIR}\n"
            "   먼저 python Ai/research/preprocess.py 를 실행하세요."
        )

    device = _resolve_device()
    print(f"🖥️  디바이스: {device}  |  SEED={SEED}")

    # 데이터셋 — transform=None 으로 1회만 생성, Subset 단계에서 증강 주입
    base_ds = FashionDataset(CSV_PATH, IMG_DIR, transform=None,
                             label_maps_path=LABEL_MAPS)

    num_colors = base_ds.num_colors
    num_styles = base_ds.num_styles
    n_total    = len(base_ds)
    print(f"🏷️  color {num_colors}개 / style {num_styles}개 / 총 샘플 {n_total}")

    # 동일 시드 permutation 으로 train/val 인덱스 분할
    g = torch.Generator().manual_seed(SEED)
    perm = torch.randperm(n_total, generator=g).tolist()
    n_val   = int(n_total * VAL_SPLIT)
    val_idx = perm[:n_val]
    train_idx = perm[n_val:]

    train_set = _TransformSubset(base_ds, train_idx, train_transform)
    val_set   = _TransformSubset(base_ds, val_idx,   val_transform)

    train_loader = DataLoader(train_set, batch_size=BATCH_SIZE, shuffle=True,
                              num_workers=2, pin_memory=(device == "cuda"))
    val_loader   = DataLoader(val_set,   batch_size=BATCH_SIZE, shuffle=False,
                              num_workers=2, pin_memory=(device == "cuda"))

    # 모델
    model = FashionAttributeNet(num_colors, num_styles, pretrained=True).to(device)

    # 옵티마이저 — 백본/헤드 LR 분리
    optimizer = optim.Adam(
        [
            {"params": model.backbone.parameters(),   "lr": LR_BACKBONE},
            {"params": model.color_head.parameters(), "lr": LR_HEAD},
            {"params": model.style_head.parameters(), "lr": LR_HEAD},
        ],
        weight_decay=WEIGHT_DECAY,
    )
    scheduler = optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=EPOCHS)

    # 클래스 가중치 — train split 기준으로만 계산 (val 누수 방지)
    train_color_labels = [base_ds.labels_color[i] for i in train_idx]
    train_style_labels = [base_ds.labels_style[i] for i in train_idx]
    color_weights = _class_weights(train_color_labels, num_colors, device)
    style_weights = _class_weights(train_style_labels, num_styles, device)
    print(f"⚖️  color weight range: [{color_weights.min():.3f}, {color_weights.max():.3f}]")
    print(f"⚖️  style weight range: [{style_weights.min():.3f}, {style_weights.max():.3f}]")

    color_criterion = nn.CrossEntropyLoss(weight=color_weights, ignore_index=-1)
    style_criterion = nn.CrossEntropyLoss(weight=style_weights, ignore_index=-1)

    best_val_acc = 0.0
    best_epoch   = 0
    best_color_acc = 0.0
    best_style_acc = 0.0
    patience_left = EARLY_STOP_PATIENCE

    for epoch in range(1, EPOCHS + 1):
        # ── train ──
        model.train()
        running_loss = 0.0
        for images, (_, color_lbl, style_lbl) in train_loader:
            images    = images.to(device)
            color_lbl = color_lbl.to(device)
            style_lbl = style_lbl.to(device)

            out_color, out_style = model(images)
            loss = color_criterion(out_color, color_lbl) + style_criterion(out_style, style_lbl)

            optimizer.zero_grad()
            loss.backward()
            optimizer.step()
            running_loss += loss.item() * images.size(0)
        scheduler.step()
        train_loss = running_loss / max(1, len(train_loader.dataset))

        # ── val ──
        model.eval()
        color_correct = style_correct = total = 0
        with torch.no_grad():
            for images, (_, color_lbl, style_lbl) in val_loader:
                images    = images.to(device)
                color_lbl = color_lbl.to(device)
                style_lbl = style_lbl.to(device)

                out_color, out_style = model(images)
                color_correct += (out_color.argmax(1) == color_lbl).sum().item()
                style_correct += (out_style.argmax(1) == style_lbl).sum().item()
                total += images.size(0)
        color_acc = color_correct / max(1, total)
        style_acc = style_correct / max(1, total)
        combined  = (color_acc + style_acc) / 2

        lr_now = optimizer.param_groups[0]["lr"]
        print(f"[{epoch:02d}/{EPOCHS}] loss={train_loss:.4f}  "
              f"val color={color_acc:.3f}  style={style_acc:.3f}  "
              f"avg={combined:.3f}  lr={lr_now:.2e}")

        if combined > best_val_acc:
            best_val_acc   = combined
            best_color_acc = color_acc
            best_style_acc = style_acc
            best_epoch     = epoch
            patience_left  = EARLY_STOP_PATIENCE
            torch.save({
                "state_dict":  model.state_dict(),
                "num_colors":  num_colors,
                "num_styles":  num_styles,
                "label_maps":  LABEL_MAPS,
            }, SAVE_PATH)
            print(f"   ✅ best 갱신 → {SAVE_PATH}")
        else:
            patience_left -= 1
            if patience_left <= 0:
                print(f"   ⏹  EarlyStopping (best @ epoch {best_epoch}, avg={best_val_acc:.3f})")
                break

    # ── metrics JSON 저장 ──
    try:
        os.makedirs(os.path.dirname(METRICS_PATH), exist_ok=True)
        with open(METRICS_PATH, "w", encoding="utf-8") as f:
            json.dump(
                {
                    "best_epoch":     best_epoch,
                    "best_val_color": best_color_acc,
                    "best_val_style": best_style_acc,
                    "best_val_avg":   best_val_acc,
                    "num_colors":     num_colors,
                    "num_styles":     num_styles,
                    "seed":           SEED,
                    "device":         device,
                    "epochs_run":     epoch,
                    "lr_backbone":    LR_BACKBONE,
                    "lr_head":        LR_HEAD,
                },
                f, ensure_ascii=False, indent=2,
            )
        print(f"📝 검증 지표 저장: {METRICS_PATH}")
    except Exception as e:
        print(f"⚠️  지표 저장 실패: {e}")

    print()
    print("=" * 55)
    print(f"🎉 학습 완료! best @ epoch {best_epoch}")
    print(f"   color acc = {best_color_acc:.3f}")
    print(f"   style acc = {best_style_acc:.3f}")
    print(f"   avg       = {best_val_acc:.3f}")
    print(f"   저장 경로: {SAVE_PATH}")
    print("   AI 서버를 재기동하면 color/style 필드가 자동 채워집니다.")
    print("=" * 55)


if __name__ == "__main__":
    main()
