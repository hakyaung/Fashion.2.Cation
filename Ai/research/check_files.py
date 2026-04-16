import pandas as pd
import os

# 1. 경로 설정 (최종 정답지)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FINAL_CSV = os.path.join(BASE_DIR, "ai_dataset_large", "final_training_data.csv")

# 2. 데이터 불러오기
df = pd.read_csv(FINAL_CSV)
print(f"📊 현재 검사할 데이터 개수: {len(df)}개")

# 3. 드디어 알아낸 진짜 이름표 적용!
file_column = 'filename' 

# 완전히 모든 정보가 똑같은 행 검사
exact_duplicates = df.duplicated().sum()
print(f"👯 완전히 똑같은 쌍둥이 데이터: {exact_duplicates}개")

# 파일 이름이 중복된 데이터 검사
if file_column in df.columns:
    name_duplicates = df.duplicated(subset=[file_column]).sum()
    print(f"🖼️ 파일 이름이 똑같은 중복 데이터: {name_duplicates}개")
    
    # 중복이 있다면 1개만 남기고 청소!
    if name_duplicates > 0:
        df_cleaned = df.drop_duplicates(subset=[file_column])
        df_cleaned.to_csv(FINAL_CSV, index=False, encoding='utf-8-sig')
        print(f"🧹 중복 데이터 청소 완료! 최종 남은 데이터: {len(df_cleaned)}개")
    else:
        print("✨ 중복 데이터가 하나도 없는 아주 깨끗한 상태입니다! 당장 AI 학습 가보자고!")
else:
    print(f"⚠️ 앗, '{file_column}' 컬럼이 없대! 다시 확인해 봐야 할 듯!")