import os
from PIL import Image

# 1. 완벽한 경로 설정 (Ai 폴더 안에 있는 데이터를 바로 찾도록 수정!)
BASE_DIR = os.path.dirname(os.path.abspath(__file__)) 
# ".." 을 지워서 Ai 폴더 바로 아래에서 찾게 만들었어!
source_dir = os.path.join(BASE_DIR, "ai_dataset_large", "images")
target_dir = os.path.join(BASE_DIR, "ai_dataset_large", "processed_images")

# 폴더가 진짜 있는지 확인
if not os.path.exists(source_dir):
    print(f"🚨 에러: 원본 이미지 폴더를 찾을 수 없습니다!")
    print(f"파이썬이 찾아본 위치: {os.path.abspath(source_dir)}")
    print("폴더 구조를 다시 한번 확인해 주세요!")
    exit()

os.makedirs(target_dir, exist_ok=True)
target_size = (224, 224)

print("🖼️ 비율 유지 정형화(Padding) 시작...")

# 2. 이미지 변환 및 저장
count = 0
for filename in os.listdir(source_dir):
    if filename.lower().endswith((".jpg", ".jpeg", ".png")):
        try:
            img_path = os.path.join(source_dir, filename)
            img = Image.open(img_path).convert("RGB")
            
            # 비율 유지하며 크기 줄이기
            img.thumbnail(target_size, Image.Resampling.LANCZOS)
            
            # 흰색 배경의 224x224 캔버스 만들기
            new_img = Image.new("RGB", target_size, (255, 255, 255))
            
            # 사진을 캔버스 정중앙에 붙이기
            left = (target_size[0] - img.size[0]) // 2
            top = (target_size[1] - img.size[1]) // 2
            new_img.paste(img, (left, top))
            
            # 완성된 사진 저장
            new_img.save(os.path.join(target_dir, filename))
            count += 1
            
            # 100장마다 진행 상황 알려주기
            if count % 100 == 0:
                print(f"  -> ⏳ {count}장 처리 완료...")
                
        except Exception as e:
            print(f"❌ {filename} 처리 실패 (건너뜀): {e}")

print(f"\n✅ 총 {count}장 정형화 완료! '{os.path.abspath(target_dir)}' 폴더를 확인해 봐.")