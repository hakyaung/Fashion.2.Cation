import pandas as pd
import os

# 1. 경로 설정
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "ai_dataset_large")
PROCESSED_IMG_DIR = os.path.join(DATA_DIR, "processed_images")
ORIGINAL_CSV = os.path.join(DATA_DIR, "metadata.csv")
FINAL_CSV = os.path.join(DATA_DIR, "final_training_data.csv")

# 2. 기존 메타데이터 불러오기
df = pd.read_csv(ORIGINAL_CSV)
print(f"📊 기존 메타데이터 개수: {len(df)}개")

# 3. 실제 정형화된 폴더에 있는 파일 목록 가져오기
processed_files = set(os.listdir(PROCESSED_IMG_DIR))
print(f"🖼️ 실제 정형화된 이미지 개수: {len(processed_files)}개")

# 4. 이미지 파일명이 실제 폴더에 존재하는 행만 남기기
df_final = df[df['filename'].isin(processed_files)].copy()

# 5. (선택) 카테고리를 숫자로 바꾸는 라벨 인코딩 (AI 학습용)
# 예: '상의' -> 0, '하의' -> 1 이런 식이야.
if 'category' in df_final.columns:
    df_final['category_label'] = df_final['category'].astype('category').cat.codes

# 6. 최종 CSV 저장
df_final.to_csv(FINAL_CSV, index=False, encoding='utf-8-sig')

print("-" * 30)
print(f"✅ 정형화 완료!")
print(f"📁 최종 저장된 파일: {FINAL_CSV}")
print(f"📝 최종 데이터 개수: {len(df_final)}개 (이미지 개수와 일치해야 함!)")