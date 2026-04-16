import torch
import torch.nn as nn
import torch.nn.functional as F
import torchvision.models as models
from torchvision import transforms
from PIL import Image
import os
import pandas as pd
import platform
import ssl

# 1. 하드웨어 세팅 (Mac/Windows 호환)
if platform.system() == 'Darwin':
    ssl._create_default_https_context = ssl._create_unverified_context
    device = torch.device("mps" if torch.backends.mps.is_available() else "cpu")
else:
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# 2. 정답지(카테고리 이름) 불러오기
# 훈련할 때 썼던 CSV 파일에서 카테고리 이름들을 똑같이 가져옵니다.
FINAL_CSV = os.path.join(BASE_DIR, "ai_dataset_large", "final_training_data.csv")
df = pd.read_csv(FINAL_CSV)
df['category'] = df['category'].astype('category')
class_names = df['category'].cat.categories.tolist()

# 3. 똑똑해진 AI 뇌 불러오기
model = models.resnet18()
model.fc = nn.Linear(model.fc.in_features, 7)
MODEL_PATH = os.path.join(BASE_DIR, "fashion_model.pth")

model.load_state_dict(torch.load(MODEL_PATH, map_location=device, weights_only=True))
model = model.to(device)
model.eval() # 📝 "실전 테스트 모드 가동!"

# 4. 이미지 변환기 (모의고사 때랑 똑같이 원본 유지)
val_transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
])

# 5. 🔍 실전 감정 함수
def predict_my_image(image_filename):
    image_path = os.path.join(BASE_DIR, image_filename)
    
    # 이미지가 없으면 에러 메시지 띄우기
    if not os.path.exists(image_path):
        print(f"🚨 앗! '{image_filename}' 파일을 찾을 수 없어. Ai 폴더 안에 사진이 있는지 확인해 줘!")
        return

    # 사진 열고 AI가 좋아하는 형태(Tensor)로 변환
    image = Image.open(image_path).convert('RGB')
    
    # 🌟 AI는 여러 장을 한 번에 보는데 익숙해서, 한 장만 줄 때도 [1, 3, 224, 224] 형태로 묶어줘야 해 (unsqueeze)
    image_tensor = val_transform(image).unsqueeze(0).to(device) 

    with torch.no_grad(): # 시험 중엔 학습 안 함
        outputs = model(image_tensor)
        
        # Softmax 마법: 점수들을 "0~100% 확률"로 변환해 줌!
        probabilities = F.softmax(outputs, dim=1)
        confidence, predicted_idx = torch.max(probabilities, 1)
        
    category_name = class_names[predicted_idx.item()]
    conf_score = confidence.item() * 100

    print("========================================")
    print(f"🤖 AI의 감정 결과:")
    print(f"📸 이 사진은 {conf_score:.1f}% 의 확신으로 [{category_name}] 입니다!")
    print("========================================")

# 🚀 실행해 보기! (다운로드한 사진 이름을 아래에 적어주세요)
predict_my_image("my_test.jpg")