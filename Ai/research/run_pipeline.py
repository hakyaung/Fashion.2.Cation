"""
Fashion.2.Cation - AI 전처리 파이프라인
========================================
실행 순서:
  Step 1. auto_labeling.py  — CLIP으로 color / style 라벨 추가 → metadata.csv 업데이트
  Step 2. preprocess.py     — 이미지 224×224 리사이즈 → processed_images/
  Step 3. clean_metadata.py — 처리된 이미지만 필터링 + 라벨 인코딩 → final_multitask_data.csv

사용법:
  python run_pipeline.py            # 전체 실행
  python run_pipeline.py --step 2   # 특정 스텝만 실행 (1 / 2 / 3)
"""

import os
import sys
import time
import argparse
import subprocess

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

STEPS = {
    0: {
        "name": "데이터 검사 & 정리 (손상 이미지 제거)",
        "script": os.path.join(BASE_DIR, "check_files.py"),
        "desc": "손상된 이미지를 탐지하고 metadata.csv에서 해당 행을 제거합니다.",
    },
    1: {
        "name": "오토 라벨링 (color + style)",
        "script": os.path.join(BASE_DIR, "auto_labeling.py"),
        "desc": "CLIP 모델로 각 이미지의 색상/스타일 라벨을 metadata.csv에 추가합니다.",
    },
    2: {
        "name": "이미지 전처리 (224×224 리사이즈)",
        "script": os.path.join(BASE_DIR, "preprocess.py"),
        "desc": "원본 이미지를 224×224로 리사이즈하여 processed_images/ 폴더에 저장합니다.",
    },
    3: {
        "name": "메타데이터 정리 (final_multitask_data.csv 생성)",
        "script": os.path.join(BASE_DIR, "clean_metadata.py"),
        "desc": "처리된 이미지만 필터링하고 라벨을 숫자로 인코딩하여 최종 CSV를 만듭니다.",
    },
    4: {
        "name": "YOLO 데이터셋 변환 (ai_dataset_yolo/ 생성)",
        "script": os.path.join(BASE_DIR, "convert_to_yolo.py"),
        "desc": "final_multitask_data.csv를 YOLOv8 포맷(images/labels/dataset.yaml)으로 변환합니다.",
    },
}


def run_step(step_num: int):
    step = STEPS[step_num]
    print()
    print("=" * 55)
    print(f"  ▶  Step {step_num}: {step['name']}")
    print(f"     {step['desc']}")
    print("=" * 55)

    start = time.time()
    result = subprocess.run([sys.executable, step["script"]])
    elapsed = time.time() - start

    if result.returncode == 0:
        print(f"\n  ✅ Step {step_num} 완료! ({elapsed:.1f}초)")
    else:
        print(f"\n  ❌ Step {step_num} 실패 (종료 코드: {result.returncode})")
        print("     오류를 확인하고 다시 실행해 주세요.")
        sys.exit(result.returncode)


def main():
    parser = argparse.ArgumentParser(description="Fashion AI 전처리 파이프라인")
    parser.add_argument(
        "--step",
        type=int,
        choices=[0, 1, 2, 3, 4],
        default=None,
        help="실행할 스텝 번호 (0~4). 생략 시 전체 실행.",
    )
    args = parser.parse_args()

    print()
    print("╔══════════════════════════════════════════════╗")
    print("║   Fashion.2.Cation — AI 전처리 파이프라인   ║")
    print("╚══════════════════════════════════════════════╝")

    steps_to_run = [args.step] if args.step else [0, 1, 2, 3, 4]

    total_start = time.time()
    for s in steps_to_run:
        run_step(s)

    total_elapsed = time.time() - total_start
    print()
    print("=" * 55)
    print(f"  🎉 파이프라인 완료! 총 소요 시간: {total_elapsed/60:.1f}분")
    print()
    print("  생성된 파일:")
    results = {
        "metadata.csv (color/style 추가)":
            os.path.join(BASE_DIR, "ai_dataset_large", "metadata.csv"),
        "processed_images/ (224×224 이미지)":
            os.path.join(BASE_DIR, "ai_dataset_large", "processed_images"),
        "final_multitask_data.csv (학습용 최종 CSV)":
            os.path.join(BASE_DIR, "ai_dataset_large", "final_multitask_data.csv"),
        "ai_dataset_yolo/ (YOLO 포맷 데이터셋)":
            os.path.join(BASE_DIR, "ai_dataset_yolo"),
    }
    for label, path in results.items():
        exists = "✅" if os.path.exists(path) else "❌ (없음)"
        print(f"    {exists}  {label}")
    print()
    print("  다음 단계: python train.py  (YOLOv8 모델 학습)")
    print("=" * 55)


if __name__ == "__main__":
    main()
