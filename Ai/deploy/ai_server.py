import torch
import torch.nn as nn
import torch.nn.functional as F
import torchvision.models as models
from torchvision import transforms
from PIL import Image
import os
import io
from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware

# ==========================================
# 💡 1. API 서버 생성 (반드시 미들웨어 추가보다 먼저 와야 합니다!)
# ==========================================
app = FastAPI(title="패션 멀티태스크 감정 AI")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # 실무에선 특정 주소만 허용하지만, 개발 중엔 "*"로 열어둬
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 2. 하드웨어 & 환경 세팅 (Mac MPS 지원 추가)
device = torch.device("cuda" if torch.cuda.is_available() else "mps" if torch.backends.mps.is_available() else "cpu")
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# ==========================================
# 🌟 3. 머리 3개 달린 멀티태스크 모델 구조 정의
# ==========================================
class FashionMultiTaskModel(nn.Module):
    def __init__(self, num_categories, num_colors, num_styles):
        super(FashionMultiTaskModel, self).__init__()
        self.backbone = models.resnet18()
        num_features = self.backbone.fc.in_features
        self.backbone.fc = nn.Identity() 

        self.category_head = nn.Linear(num_features, num_categories)
        self.color_head = nn.Linear(num_features, num_colors)
        self.style_head = nn.Linear(num_features, num_styles)

    def forward(self, x):
        features = self.backbone(x)
        return self.category_head(features), self.color_head(features), self.style_head(features)

# ==========================================
# 🌟 4. 모델을 '서버 켜질 때 딱 한 번만' 불러오기
# ==========================================
# 훈련 로그 기준: 카테고리 7개, 색상 10개, 스타일 6개
model = FashionMultiTaskModel(7, 10, 6)
# 👉 우리가 방금 만든 '새로운 모델' 파일명으로 변경!
MODEL_PATH = os.path.join(BASE_DIR, "fashion_multitask_model.pth") 

# 서버(EC2)가 CPU만 있을 수도 있으니 map_location 추가
model.load_state_dict(torch.load(MODEL_PATH, map_location=device, weights_only=True))
model = model.to(device)
model.eval()

# ==========================================
# 5. 이미지 변환기 및 정답지 (CSV 대신 딕셔너리로 가볍게!)
# ==========================================
val_transform = transforms.Compose([
    transforms.Resize(256),
    transforms.CenterCrop(224), 
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
])

category_map = {0: "가방", 1: "모자", 2: "바지", 3: "상의", 4: "스커트", 5: "신발", 6: "아우터"}
color_map = {0: "black", 1: "blue", 2: "brown", 3: "gray", 4: "green", 5: "navy", 6: "pink", 7: "red", 8: "white", 9: "yellow"}
style_map = {0: "casual", 1: "formal", 2: "minimalist", 3: "sportswear", 4: "streetwear", 5: "vintage"}

# ==========================================
# 6. 🚀 사진을 받는 API 창구 (Endpoint)
# ==========================================
@app.post("/predict")
async def predict_image(file: UploadFile = File(...)):
    # 1. 들어온 사진 파일 읽기
    image_bytes = await file.read()
    image = Image.open(io.BytesIO(image_bytes)).convert('RGB')
    
    # 2. AI가 먹기 좋게 변환
    image_tensor = val_transform(image).unsqueeze(0).to(device)
    
    # 3. AI 감정 시작!
    with torch.no_grad():
        out_cat, out_color, out_style = model(image_tensor)
        
        # 카테고리 신뢰도(확률) 계산
        probabilities = F.softmax(out_cat, dim=1)
        confidence, pred_cat = torch.max(probabilities, 1)
        conf_score = round(confidence.item() * 100, 2)
        
        # 색상, 스타일 예측
        _, pred_color = torch.max(out_color, 1)
        _, pred_style = torch.max(out_style, 1)
        
    # 🚨 4. 신뢰도 70% 미만 방어막 컷!
    if conf_score < 70.0:
        return {
            "status": "failed",
            "message": f"옷이 아니거나 사진이 너무 흐립니다. (신뢰도: {conf_score}%)"
        }
    
    # 5. 백엔드가 읽기 편한 JSON 형태로 3가지 결과 쏴주기
    return {
        "status": "success",
        "category": category_map.get(pred_cat.item(), "unknown"),
        "color": color_map.get(pred_color.item(), "unknown"),
        "style": style_map.get(pred_style.item(), "unknown"),
        "confidence": conf_score
    }

# 서버 실행용 시동 버튼 코드
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("ai_server:app", host="0.0.0.0", port=8001, reload=True)