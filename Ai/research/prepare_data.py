import os
import pandas as pd
from sklearn.model_selection import train_test_split
from torch.utils.data import DataLoader
from Ai.depoly.custom_dataset import FashionDataset, my_transform # 아까 만든 거 가져오기!

# 1. 경로 설정
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FINAL_CSV = os.path.join(BASE_DIR, "ai_dataset_large", "final_training_data.csv")
IMG_DIR = os.path.join(BASE_DIR, "ai_dataset_large", "processed_images")

# 2. 정답지 불러오기
df = pd.read_csv(FINAL_CSV)

# 3. 데이터 쪼개기 (Train 80% / Validation 20%)
# scikit-learn이 아주 공평하게 섞어서 나눠줄 거야.
train_df, val_df = train_test_split(df, test_size=0.2, random_state=42, stratify=df['category'])

# 쪼갠 데이터 임시 저장 (DataLoader가 읽을 수 있게)
train_csv_path = os.path.join(BASE_DIR, "ai_dataset_large", "train_data.csv")
val_csv_path = os.path.join(BASE_DIR, "ai_dataset_large", "val_data.csv")
train_df.to_csv(train_csv_path, index=False)
val_df.to_csv(val_csv_path, index=False)

print(f"📚 공부용(Train) 데이터: {len(train_df)}장")
print(f"📝 모의고사용(Validation) 데이터: {len(val_df)}장")

# 4. Dataset(가마솥) 만들기
train_dataset = FashionDataset(csv_file=train_csv_path, img_dir=IMG_DIR, transform=my_transform)
val_dataset = FashionDataset(csv_file=val_csv_path, img_dir=IMG_DIR, transform=my_transform)

# 5. 🌟 대망의 배식기(DataLoader) 세팅!
# 한 번에 32장씩(batch_size=32), 순서를 마구 섞어서(shuffle=True) 배식해 줘!
train_loader = DataLoader(train_dataset, batch_size=32, shuffle=True)

# 모의고사는 섞을 필요 없이 순서대로 풀게 하면 됨
val_loader = DataLoader(val_dataset, batch_size=32, shuffle=False)

print("🍽️ 배식기(DataLoader) 세팅 완료! 이제 AI 입에 밥 넣어줄 준비 끝!")