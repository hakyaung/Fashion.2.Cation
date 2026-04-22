"""
통합 테스트: /predict detection -> PostTag 부착 흐름 시뮬레이션

ai_server.py의 _split_class_label + detection dict 구조를
그대로 재현해 app/api/posts.py의 TAG_FIELDS 루프 결과를 출력한다.

실제 torch/ultralytics/DB 없이 돌아가므로 CI나 빠른 회귀 점검에 유용.
"""
from __future__ import annotations

# ai_server.py의 핵심 로직을 그대로 복제 (단위 테스트용)
def split_class_label(class_label: str) -> tuple[str | None, str | None]:
    if "_" in class_label:
        gender, _, category = class_label.partition("_")
        return gender, category
    return None, class_label


def make_detection(class_label: str, confidence: float) -> dict:
    gender, category = split_class_label(class_label)
    return {
        "class_label": class_label,
        "category":    category,
        "gender":      gender,
        "color":       None,
        "style":       None,
        "confidence":  confidence,
    }


# app/api/posts.py의 TAG_FIELDS 루프 재현
TAG_FIELDS = ["category", "class_label", "gender", "color", "style"]


def simulate_post_tags(detections: list[dict]) -> list[dict]:
    """posts.py 업로드 핸들러의 태그 생성 로직과 동일."""
    tags = []
    for detection in detections:
        confidence = detection.get("confidence", 0.0)
        for field in TAG_FIELDS:
            value = detection.get(field)
            if value and value != "unknown":
                tags.append({
                    "tag_name":         f"{field}:{value}",
                    "confidence_score": confidence,
                    "is_ai_generated":  True,
                })
    return tags


# ── 시나리오 1: 모든 9개 class_label 단일 검출 ────────────────
print("=" * 60)
print("  시나리오 1 — class_label별 생성되는 태그 개수")
print("=" * 60)

LABELS = [
    "공용_신발", "남성_상의", "남성_아우터", "남성_하의",
    "여성_상의", "여성_아우터", "여성_원피스", "여성_치마", "여성_하의",
]
for lbl in LABELS:
    det = make_detection(lbl, confidence=87.5)
    tags = simulate_post_tags([det])
    tag_names = [t["tag_name"] for t in tags]
    print(f"  [{lbl:12}] → {len(tags)}개 태그:  {tag_names}")

# ── 시나리오 2: 1장에 여러 의류가 동시 검출된 경우 ──────────────
print()
print("=" * 60)
print("  시나리오 2 — 한 이미지에 상의 + 하의 + 신발 동시 검출")
print("=" * 60)

multi_det = [
    make_detection("남성_상의", 94.2),
    make_detection("남성_하의", 88.1),
    make_detection("공용_신발", 71.5),
]
tags = simulate_post_tags(multi_det)
print(f"  총 {len(tags)}개 태그 생성:")
for t in tags:
    print(f"    - {t['tag_name']:30} (conf={t['confidence_score']})")

# ── 시나리오 3: 형식 불일치(fallback) ─────────────────────────
print()
print("=" * 60)
print("  시나리오 3 — class_label에 '_'가 없는 예외 케이스")
print("=" * 60)
det = make_detection("unknown", 40.0)
tags = simulate_post_tags([det])
print(f"  class_label='unknown' → 태그 {len(tags)}개 (unknown은 skip 처리됨)")
det = make_detection("하의", 55.0)
tags = simulate_post_tags([det])
tag_names = [t["tag_name"] for t in tags]
print(f"  class_label='하의' (gender 파싱 불가) → {len(tags)}개: {tag_names}")

# ── 요약 ─────────────────────────────────────────────────────
print()
print("=" * 60)
print("  요약")
print("=" * 60)
print(f"  TAG_FIELDS = {TAG_FIELDS}")
print(f"  정상 class_label 1건당 부착 태그: 3개 (category + class_label + gender)")
print(f"  color / style은 YOLO 탐지 모델이 예측하지 않아 현재 None → skip")
print(f"  color/style 태그까지 채우려면 별도 속성 분류기 필요")
