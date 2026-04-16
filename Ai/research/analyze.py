import platform
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns

# 🎨 OS(운영체제)별 한글 폰트 자동 설정
os_name = platform.system()

if os_name == 'Darwin':  # 맥북(macOS)일 경우
    plt.rc('font', family='AppleGothic')
elif os_name == 'Windows':  # 윈도우일 경우
    plt.rc('font', family='Malgun Gothic') # 윈도우 기본 폰트인 맑은 고딕
else:  # 리눅스 등 기타 OS일 경우
    plt.rc('font', family='NanumGothic')

# 마이너스(-) 기호 깨짐 방지
plt.rcParams['axes.unicode_minus'] = False

# 1. 데이터 불러오기
print("📂 데이터를 불러오는 중입니다...")
df = pd.read_csv("ai_dataset_large/metadata.csv")

# 2. 데이터 요약 확인
print("\n🔍 [데이터 요약]")
print(f"총 데이터 개수: {len(df)}개")
print("-" * 50)

# 3. 카테고리별 옷 개수 분석 그래프 그리기
plt.figure(figsize=(10, 6))
sns.countplot(data=df, x='category', hue='gender', palette='Set2')
plt.title('👕 성별 및 카테고리별 데이터 수집 현황', fontsize=15)
plt.xlabel('카테고리', fontsize=12)
plt.ylabel('수집된 개수', fontsize=12)
plt.legend(title='성별')

# 그래프 화면에 띄우기
plt.show()