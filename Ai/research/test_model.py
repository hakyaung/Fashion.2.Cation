import torch
import torch.nn as nn
import torchvision.models as models
from torch.utils.data import DataLoader
import os
import platform

# 🌟 방금 만든 '시험용 정직한 변환기' 가져오기
from Ai.depoly.custom_dataset import FashionDataset, val_transform

# 1. 하드웨어 자동 감지
device = torch.device("mps" if torch.backends.mps.is_available() else "cuda" if torch.cuda.is_available() else "cpu")

# 2. 빈 뇌(모델 뼈대) 준비하기
model = models.resnet18()
model.fc = nn.Linear(model.fc.in_features, 7)

# 3. 🌟 저장된 뇌(가중치) 불러와서 이식하기!
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "fashion_model.pth")

model.load_state_dict(torch.load(MODEL_PATH, map_location=device, weights_only=True))
model = model.to(device)
model.eval() # "지금은 시험 모드!" 선언

# 4. 모의고사 데이터 배식 (🌟 시험용 val_transform 적용!)
VAL_CSV = os.path.join(BASE_DIR, "ai_dataset_large", "val_data.csv") 
IMG_DIR = os.path.join(BASE_DIR, "ai_dataset_large", "processed_images")

val_dataset = FashionDataset(csv_file=VAL_CSV, img_dir=IMG_DIR, transform=val_transform)
val_loader = DataLoader(val_dataset, batch_size=32, shuffle=False)

# 5. 📝 시험 시작!
correct = 0
total = 0

print("📝 한 번도 안 본 사진 600장으로 깐깐한 모의고사를 시작합니다...")
with torch.no_grad(): 
    for images, labels in val_loader:
        images, labels = images.to(device), labels.to(device)
        outputs = model(images)
        _, predicted = torch.max(outputs.data, 1)
        total += labels.size(0)
        correct += (predicted == labels).sum().item()

final_score = 100 * correct / total
print("========================================")
print(f"🎯 모의고사 최종 점수: {final_score:.2f}%")
print("========================================")