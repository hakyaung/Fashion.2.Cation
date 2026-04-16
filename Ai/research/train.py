import torch
import torch.nn as nn
import torch.optim as optim
import time
import platform
import ssl
import os
import pandas as pd
import torchvision.models as models
from sklearn.model_selection import train_test_split
from torch.utils.data import DataLoader

from Ai.depoly.custom_dataset import train_transform, val_transform, FashionDataset

# 1. 하드웨어 자동 감지
if platform.system() == 'Darwin':
    ssl._create_default_https_context = ssl._create_unverified_context
    device = torch.device("mps" if torch.backends.mps.is_available() else "cpu")
else:
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

print(f"🔥 현재 AI가 훈련받을 훈련장(하드웨어): {device}")

# ==========================================
# 2. 데이터 배식기 세팅 (새로운 정답지 파일 적용!)
# ==========================================
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
# 👉 우리가 방금 만든 '3가지 정답(멀티태스크)'이 있는 파일로 변경!
FINAL_CSV = os.path.join(BASE_DIR, "ai_dataset_large", "final_multitask_data.csv")
IMG_DIR = os.path.join(BASE_DIR, "ai_dataset_large", "processed_images")

df = pd.read_csv(FINAL_CSV)

# 🌟 데이터 분할 전에 미리 문자를 숫자로 다 바꿔둡니다. (인덱스 꼬임 방지)
df['category_code'] = df['category'].astype('category').cat.codes
df['color_code'] = df['color'].astype('category').cat.codes
df['style_code'] = df['style'].astype('category').cat.codes

train_df, val_df = train_test_split(df, test_size=0.2, random_state=42, stratify=df['category'])

# 🏋️‍♂️ 훈련용 배식기
train_dataset = FashionDataset(csv_file=FINAL_CSV, img_dir=IMG_DIR, transform=train_transform) 
train_dataset.data_frame = train_df.reset_index(drop=True)
train_dataset.labels_category = train_dataset.data_frame['category_code'].tolist()
train_dataset.labels_color = train_dataset.data_frame['color_code'].tolist()
train_dataset.labels_style = train_dataset.data_frame['style_code'].tolist()
train_loader = DataLoader(train_dataset, batch_size=32, shuffle=True)

# 📝 검증용 배식기
val_dataset = FashionDataset(csv_file=FINAL_CSV, img_dir=IMG_DIR, transform=val_transform) 
val_dataset.data_frame = val_df.reset_index(drop=True)
val_dataset.labels_category = val_dataset.data_frame['category_code'].tolist()
val_dataset.labels_color = val_dataset.data_frame['color_code'].tolist()
val_dataset.labels_style = val_dataset.data_frame['style_code'].tolist()
val_loader = DataLoader(val_dataset, batch_size=32, shuffle=False)

# ==========================================
# 3. 🌟 머리 3개 달린 멀티태스크 모델 정의 🌟
# ==========================================
class FashionMultiTaskModel(nn.Module):
    def __init__(self, num_categories, num_colors, num_styles):
        super(FashionMultiTaskModel, self).__init__()
        # 기존 ResNet18을 가져와서 몸통으로 씁니다.
        self.backbone = models.resnet18(weights=models.ResNet18_Weights.DEFAULT)
        num_features = self.backbone.fc.in_features
        # 원래 있던 1개짜리 입(출력층)을 막아버립니다.
        self.backbone.fc = nn.Identity() 

        # 3개의 입(Head)을 새로 만들어 붙입니다.
        self.category_head = nn.Linear(num_features, num_categories)
        self.color_head = nn.Linear(num_features, num_colors)
        self.style_head = nn.Linear(num_features, num_styles)

    def forward(self, x):
        features = self.backbone(x)
        # 사진 1장을 보고 3개의 대답을 동시에 뱉어냅니다!
        return self.category_head(features), self.color_head(features), self.style_head(features)

# 데이터셋에서 정답 종류가 총 몇 개인지 파악합니다.
num_categories = len(df['category'].unique())
num_colors = len(df['color'].unique())
num_styles = len(df['style'].unique())

model = FashionMultiTaskModel(num_categories, num_colors, num_styles).to(device)

# ==========================================
# 4. 교관(Optimizer), 비서(Scheduler), 그리고 3개의 채점기
# ==========================================
criterion = nn.CrossEntropyLoss() 
optimizer = optim.Adam(model.parameters(), lr=0.001) 
scheduler = optim.lr_scheduler.StepLR(optimizer, step_size=4, gamma=0.5)

epochs = 12 

print("========================================")
print(f"🏁 1타 3피! 머리 3개 달린 돌연변이(?) 모델 훈련 시작 (총 {epochs} Epoch)")
print(f"🎯 훈련 목표 - 카테고리: {num_categories}개, 색상: {num_colors}개, 스타일: {num_styles}개")
print("========================================")

for epoch in range(epochs):
    model.train() 
    running_loss = 0.0
    
    # 3가지 각각의 정답률을 따로 기록하기 위한 변수
    correct_cat, correct_color, correct_style = 0, 0, 0
    total = 0
    
    start_time = time.time()
    
    # 🌟 라벨이 3개 묶음(튜플)으로 들어옵니다!
    for images, (labels_cat, labels_color, labels_style) in train_loader:
        images = images.to(device)
        labels_cat = labels_cat.to(device)
        labels_color = labels_color.to(device)
        labels_style = labels_style.to(device)
        
        optimizer.zero_grad() 
        
        # 모델이 3개의 답을 내놓음
        out_cat, out_color, out_style = model(images) 
        
        # 🌟 3개의 오차(Loss)를 각각 구해서 하나로 합치기! (멀티태스킹의 핵심)
        loss_cat = criterion(out_cat, labels_cat)
        loss_color = criterion(out_color, labels_color)
        loss_style = criterion(out_style, labels_style)
        
        total_loss = loss_cat + loss_color + loss_style 
        
        total_loss.backward() 
        optimizer.step() 
        
        running_loss += total_loss.item()
        total += labels_cat.size(0)
        
        # 각각 얼마나 맞췄는지 채점
        _, pred_cat = torch.max(out_cat.data, 1)
        _, pred_color = torch.max(out_color.data, 1)
        _, pred_style = torch.max(out_style.data, 1)
        
        correct_cat += (pred_cat == labels_cat).sum().item()
        correct_color += (pred_color == labels_color).sum().item()
        correct_style += (pred_style == labels_style).sum().item()
        
    scheduler.step()
    
    epoch_time = time.time() - start_time
    epoch_loss = running_loss / len(train_loader)
    
    acc_cat = 100 * correct_cat / total
    acc_color = 100 * correct_color / total
    acc_style = 100 * correct_style / total
    current_lr = optimizer.param_groups[0]['lr']
    
    print(f"🔥 [Epoch {epoch+1}/{epochs}] {epoch_time:.0f}초 | 합산 오차: {epoch_loss:.4f} | 보폭(LR): {current_lr:.6f}")
    print(f"   ┣ 👕종류 정답률: {acc_cat:.1f}% | 🎨색상 정답률: {acc_color:.1f}% | 🕶️스타일 정답률: {acc_style:.1f}%")

# ==========================================
# 5. 새로운 멀티태스크 모델 저장
# ==========================================
# 👉 나중에 FastAPI에서 헷갈리지 않게 파일 이름을 바꿨습니다.
SAVE_PATH = os.path.join(BASE_DIR, "fashion_multitask_model.pth")
torch.save(model.state_dict(), SAVE_PATH)

print("========================================")
print(f"✅ 정밀 훈련 완료 및 멀티태스크 모델 저장 성공! ('{SAVE_PATH}')")