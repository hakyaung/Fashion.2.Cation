import os
import pandas as pd
from PIL import Image
import torch
from transformers import pipeline

# 1. 하드웨어 설정 (Mac MPS 지원)
if torch.backends.mps.is_available():
    device = torch.device("mps")
elif torch.cuda.is_available():
    device = torch.device("cuda")
else:
    device = torch.device("cpu")

print(f"🔥 AI 비서가 일할 환경: {device}")
print("🤖 CLIP 비서를 불러오는 중... (처음엔 모델 다운로드로 몇 분 걸릴 수 있습니다)")

# 2. 제로샷 이미지 분류기 (CLIP) 소환!
# 후보 단어들 중에서 사진과 가장 잘 어울리는 단어를 골라주는 모델입니다.
classifier = pipeline("zero-shot-image-classification", model="openai/clip-vit-base-patch32", device=device)

# 3. 모델에게 물어볼 '선택지(후보)'를 미리 정해줍니다.
# 영어가 인식이 훨씬 잘 되므로 영어로 세팅합니다.
color_candidates = ["black", "white", "red", "blue", "green", "yellow", "gray", "brown", "pink", "navy"]
style_candidates = ["streetwear", "casual", "formal", "sportswear", "minimalist", "vintage"]

# 4. 기존 데이터셋 불러오기
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
OLD_CSV = os.path.join(BASE_DIR, "ai_dataset_large", "final_training_data.csv")
NEW_CSV = os.path.join(BASE_DIR, "ai_dataset_large", "final_multitask_data.csv")
IMG_DIR = os.path.join(BASE_DIR, "ai_dataset_large", "processed_images")

df = pd.read_csv(OLD_CSV)

# 새로운 결과를 담을 리스트
colors = []
styles = []

print(f"📊 총 {len(df)}장의 사진을 분석합니다. 커피 한잔하고 오세요! ☕️")
print("========================================")

# 5. 사진을 한 장씩 보면서 AI 비서에게 질문하기
for index, row in df.iterrows():
    img_name = row['filename']
    img_path = os.path.join(IMG_DIR, img_name)
    
    try:
        # 사진 열기
        image = Image.open(img_path).convert('RGB')
        
        # 비서야, 이 사진 무슨 색이 제일 유력해?
        color_result = classifier(image, candidate_labels=color_candidates)
        best_color = color_result[0]['label'] # 가장 확률이 높은 첫 번째 정답
        
        # 비서야, 이 사진은 어떤 스타일에 가까워?
        style_result = classifier(image, candidate_labels=style_candidates)
        best_style = style_result[0]['label']
        
        colors.append(best_color)
        styles.append(best_style)
        
        # 진행 상황 출력 (10장마다)
        if (index + 1) % 10 == 0:
            print(f"[{index + 1}/{len(df)}] 📸 {img_name} -> 색상: {best_color}, 스타일: {best_style}")
            
    except Exception as e:
        print(f"🚨 {img_name} 처리 중 에러 발생: {e}")
        # 에러 나면 임시로 unknown 처리
        colors.append("unknown")
        styles.append("unknown")

# 6. 원래 표에 새로운 컬럼 추가하고 저장하기!
df['color'] = colors
df['style'] = styles

df.to_csv(NEW_CSV, index=False)
print("========================================")
print(f"🎉 완벽합니다! 3개의 정답을 가진 새로운 데이터셋이 저장되었습니다: {NEW_CSV}")