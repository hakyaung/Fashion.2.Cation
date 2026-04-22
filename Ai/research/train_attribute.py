"""
Fashion.2.Cation — 색상/스타일 속성 분류기 학습
===============================================
YOLOv8이 예측하지 못하는 color·style 을 ResNet18 멀티헤드로 분류한다.

입력:  processed_images/*.jpg  +  final_multitask_data.csv
       (preprocess.py 로 processed_images 가 준비돼 있어야 함)

출력:  deploy/fashion_attr.pt
       state_dict 만 저장 — ai_server.py 에서 같은 모델 클래스로 로드.
"""

import os
import sys
import platform
import ssl

import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, random_split
from torchvision import models

# custom_dataset.py 는 deploy/ 에 있으므로 경로 추가
_DEPLOY = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "deploy")
sys.path.insert(0, os.path.abspath(_DEPLOY))
from custom_dataset import FashionDataset, train_transform, val_transform  # noqa: E402

# Mac SSL 우회 (torchvision 사전학습 가중치 다운로드용)
if platform.system() == "Darwin":
    ssl._create_default_https_context = ssl._create_unverified_context

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

# 하이퍼파라미터
BATCH_SIZE = 32
EPOCHS     = 20
LR         = 1e-3
VAL_SPLIT  = 0.15


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
    print(f"🖥️  디바이스: {device}")

    # 데이터셋
    full_train = FashionDataset(CSV_PATH, IMG_DIR, transform=train_transform,
                                label_maps_path=LABEL_MAPS)
    full_val   = FashionDataset(CSV_PATH, IMG_DIR, transform=val_transform,
                                label_maps_path=LABEL_MAPS)

    num_colors = full_train.num_colors
    num_styles = full_train.num_styles
    print(f"🏷️  color 클래스 {num_colors}개 / style 클래스 {num_styles}개 / 총 샘플 {len(full_train)}")

    # train/val split — 같은 시드로 분할 후 transform 만 다른 두 subset 생성
    n_total = len(full_train)
    n_val   = int(n_total * VAL_SPLIT)
    n_train = n_total - n_val
    train_set, _ = random_split(full_train, [n_train, n_val],
                                generator=torch.Generator().manual_seed(42))
    _, val_set   = random_split(full_val,   [n_train, n_val],
                                generator=torch.Generator().manual_seed(42))

    train_loader = DataLoader(train_set, batch_size=BATCH_SIZE, shuffle=True,
                              num_workers=2, pin_memory=(device == "cuda"))
    val_loader   = DataLoader(val_set,   batch_size=BATCH_SIZE, shuffle=False,
                              num_workers=2, pin_memory=(device == "cuda"))

    # 모델 / 옵티마이저 / 손실
    model = FashionAttributeNet(num_colors, num_styles, pretrained=True).to(device)
    optimizer = optim.Adam(model.parameters(), lr=LR)
    scheduler = optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=EPOCHS)
    criterion = nn.CrossEntropyLoss(ignore_index=-1)  # -1 은 라벨 없음

    best_val_acc = 0.0
    for epoch in range(1, EPOCHS + 1):
        # ── train ──
        model.train()
        running_loss = 0.0
        for images, (_, color_lbl, style_lbl) in train_loader:
            images    = images.to(device)
            color_lbl = color_lbl.to(device)
            style_lbl = style_lbl.to(device)

            out_color, out_style = model(images)
            loss = criterion(out_color, color_lbl) + criterion(out_style, style_lbl)

            optimizer.zero_grad()
            loss.backward()
            optimizer.step()
            running_loss += loss.item() * images.size(0)
        scheduler.step()
        train_loss = running_loss / len(train_loader.dataset)

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
        color_acc = color_correct / total
        style_acc = style_correct / total
        combined  = (color_acc + style_acc) / 2

        print(f"[{epoch:02d}/{EPOCHS}] loss={train_loss:.4f}  "
              f"val color acc={color_acc:.3f}  style acc={style_acc:.3f}")

        if combined > best_val_acc:
            best_val_acc = combined
            torch.save({
                "state_dict":  model.state_dict(),
                "num_colors":  num_colors,
                "num_styles":  num_styles,
                "label_maps":  LABEL_MAPS,
            }, SAVE_PATH)
            print(f"   ✅ 최고 정확도 갱신 → {SAVE_PATH}")

    print()
    print("=" * 55)
    print(f"🎉 학습 완료! 최고 평균 val acc = {best_val_acc:.3f}")
    print(f"   저장 경로: {SAVE_PATH}")
    print("   AI 서버를 재기동하면 color/style 필드가 자동 채워집니다.")
    print("=" * 55)


if __name__ == "__main__":
    main()
