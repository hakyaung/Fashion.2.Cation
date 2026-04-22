"""
download_missing_images.py
===========================
metadata.csv 기준으로 images/ 폴더에 없는 이미지들을 29CM에서 직접 다운로드합니다.

사용법:
    python Ai/research/download_missing_images.py

필요 패키지:
    pip install requests beautifulsoup4 pandas tqdm
"""

import os
import re
import time
import random
import requests
import pandas as pd
from pathlib import Path
from bs4 import BeautifulSoup
from tqdm import tqdm

# ─────────────────────────────────────────────
# 경로 설정
# ─────────────────────────────────────────────
BASE_DIR   = os.path.dirname(os.path.abspath(__file__))
META_PATH  = os.path.join(BASE_DIR, "ai_dataset_large", "metadata.csv")
IMAGES_DIR = os.path.join(BASE_DIR, "ai_dataset_large", "images")

os.makedirs(IMAGES_DIR, exist_ok=True)

# ─────────────────────────────────────────────
# 헬퍼: 파일명에서 29CM 상품 ID 추출
# 예) M_top_p01_3276485.jpg → 3276485
# ─────────────────────────────────────────────
def extract_product_id(filename: str):
    name = Path(filename).stem           # 확장자 제거
    parts = name.split("_")
    # 마지막 숫자 부분이 상품 ID
    for part in reversed(parts):
        if part.isdigit():
            return part
    return None


# ─────────────────────────────────────────────
# 29CM 상품 페이지에서 og:image URL 추출
# ─────────────────────────────────────────────
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "ko-KR,ko;q=0.9",
    "Referer": "https://www.29cm.co.kr/",
}

def get_image_url(product_id: str, timeout: int = 10) -> str | None:
    url = f"https://www.29cm.co.kr/products/{product_id}"
    try:
        resp = requests.get(url, headers=HEADERS, timeout=timeout)
        if resp.status_code != 200:
            return None
        soup = BeautifulSoup(resp.text, "html.parser")

        # 1순위: og:image 메타태그
        og = soup.find("meta", property="og:image")
        if og and og.get("content"):
            return og["content"]

        # 2순위: 상품 상세 첫 번째 img 태그
        img = soup.select_one("img[src]")
        if img:
            src = img["src"]
            if src.startswith("//"):
                src = "https:" + src
            return src

    except Exception:
        pass
    return None


# ─────────────────────────────────────────────
# 이미지 파일 다운로드
# ─────────────────────────────────────────────
def download_image(image_url: str, save_path: str, timeout: int = 15) -> bool:
    try:
        resp = requests.get(image_url, headers=HEADERS, timeout=timeout, stream=True)
        if resp.status_code != 200:
            return False
        with open(save_path, "wb") as f:
            for chunk in resp.iter_content(1024 * 64):
                f.write(chunk)
        return True
    except Exception:
        return False


# ─────────────────────────────────────────────
# 메인 실행
# ─────────────────────────────────────────────
def main():
    df = pd.read_csv(META_PATH)
    all_files = set(df["filename"].tolist())

    # 이미 있는 파일 확인
    existing = set(os.listdir(IMAGES_DIR))
    missing  = [f for f in all_files if f not in existing]

    print(f"📊 전체: {len(all_files)}장 | 보유: {len(existing)}장 | 부족: {len(missing)}장")

    if not missing:
        print("✅ 모든 이미지가 이미 있습니다!")
        return

    success  = 0
    failed   = []

    for filename in tqdm(missing, desc="다운로드 중"):
        product_id = extract_product_id(filename)
        if not product_id:
            failed.append((filename, "ID 추출 실패"))
            continue

        # 1. 29CM에서 og:image URL 가져오기
        img_url = get_image_url(product_id)
        if not img_url:
            failed.append((filename, "URL 없음"))
            # 짧게 쉬고 다음으로
            time.sleep(random.uniform(0.3, 0.7))
            continue

        # 2. 이미지 파일 저장
        save_path = os.path.join(IMAGES_DIR, filename)
        ok = download_image(img_url, save_path)

        if ok:
            success += 1
        else:
            failed.append((filename, "다운로드 실패"))

        # 크롤링 지연 (차단 방지)
        time.sleep(random.uniform(0.8, 1.8))

    # ─── 결과 요약 ───────────────────────────
    print()
    print("=" * 50)
    print(f"✅ 성공: {success}장")
    print(f"❌ 실패: {len(failed)}장")
    print("=" * 50)

    if failed:
        fail_log = os.path.join(BASE_DIR, "ai_dataset_large", "download_failed.txt")
        with open(fail_log, "w", encoding="utf-8") as f:
            for fname, reason in failed:
                f.write(f"{fname}\t{reason}\n")
        print(f"\n실패 목록 저장됨: {fail_log}")
        print("나중에 재시도하려면 스크립트를 다시 실행하면 됩니다 (이미 받은 건 건너뜁니다).")


if __name__ == "__main__":
    main()
