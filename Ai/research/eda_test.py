import pandas as pd
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FINAL_CSV = os.path.join(BASE_DIR, "ai_dataset_large", "final_training_data.csv")

df = pd.read_csv(FINAL_CSV)

print("============ 📊 데이터 밸런스 검사 ============")
# 카테고리별로 데이터가 몇 개씩 있는지 확인!
category_counts = df['category'].value_counts()
print(category_counts)
print("-" * 40)

print("\n============ 💰 가격 이상치 검사 ============")
# 가격이 숫자로 되어있다면 평균, 최소, 최대값 확인!
if 'price' in df.columns:
    # 혹시 가격에 '원'이나 ','가 섞여있다면 숫자로 바꿔주기
    if df['price'].dtype == 'object':
        df['price'] = df['price'].astype(str).str.replace(',', '').str.replace('원', '')
        df['price'] = pd.to_numeric(df['price'], errors='coerce')
    
    print(df['price'].describe())
else:
    print("⚠️ 가격(price) 컬럼이 없습니다.")
print("===============================================")