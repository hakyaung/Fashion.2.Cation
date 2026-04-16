import torch
import torch.nn as nn
import torchvision.models as models
import ssl
import platform

print("⏳ 유학파 천재 AI 'ResNet-18' 비행기 타고 오는 중...")

# === 🚨 맥(Mac) & 윈도우(Windows) 팀플 평화 협정 세팅 ===
if platform.system() == 'Darwin':  # 파이썬에서 맥(macOS)은 'Darwin'이라고 불러!
    ssl._create_default_https_context = ssl._create_unverified_context
    print("🍎 [Mac 유저 감지] 맥북용 SSL 우회 모드로 다운로드를 시작합니다.")
else:
    print("🪟 [Windows/Linux 유저 감지] 윈도우용 기본 보안 모드로 다운로드를 시작합니다.")
# =========================================================

# 1. 이미 똑똑하게 학습된(pretrained) ResNet-18 모델 불러오기
model = models.resnet18(weights=models.ResNet18_Weights.DEFAULT)

# 2. 우리 프로젝트에 맞게 '마지막 뇌세포' 개조하기!
num_features = model.fc.in_features 
model.fc = nn.Linear(num_features, 7) # 7개의 정답만 내뱉도록 개조!

print("🧠 천재 AI 영입 및 패션 맞춤형 뇌 개조 완료!")
print(f"👉 이 AI는 이제 사진을 보면 딱 {model.fc.out_features}개의 카테고리 중 하나로 대답할 거야!")