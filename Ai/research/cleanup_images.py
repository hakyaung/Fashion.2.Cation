"""
cleanup_images.py
=================
images/ 폴더에서 불필요한 파일을 정리합니다.
  - " 2.jpg" macOS 중복 파일 삭제
  - metadata.csv에 없는 파일 삭제

사용법:
    python Ai/research/cleanup_images.py
"""

import os
import pandas as pd

BASE_DIR   = os.path.dirname(os.path.abspath(__file__))
IMAGES_DIR = os.path.join(BASE_DIR, "ai_dataset_large", "images")
META_PATH  = os.path.join(BASE_DIR, "ai_dataset_large", "metadata.csv")

meta = set(pd.read_csv(META_PATH)["filename"].tolist())
imgs = os.listdir(IMAGES_DIR)

deleted = 0
for f in imgs:
    path = os.path.join(IMAGES_DIR, f)
    if " 2.jpg" in f or f not in meta:
        os.remove(path)
        deleted += 1

print(f"삭제: {deleted}개")
print(f"남은 파일: {len(os.listdir(IMAGES_DIR))}개")
