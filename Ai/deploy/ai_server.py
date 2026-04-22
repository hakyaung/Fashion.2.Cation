import os
import io
import json
import yaml
import torch
from fastapi import FastAPI, File, UploadFile, Query
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
from ultralytics import YOLO
from typing import Optional
from dotenv import load_dotenv

load_dotenv()

# ────────────────────────────────────────────────
# 경로 설정
# ────────────────────────────────────────────────
BASE_DIR   = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "fashion_yolo.pt")
YAML_PATH  = os.path.join(BASE_DIR, "..", "research", "ai_dataset_yolo", "dataset.yaml")

# label_maps.json: Docker 환경(같은 폴더) → 로컬 환경(research 폴더) 순으로 탐색
_label_map_candidates = [
    os.path.join(BASE_DIR, "label_maps.json"),
    os.path.join(BASE_DIR, "..", "research", "ai_dataset_large", "label_maps.json"),
]
LABEL_MAP_PATH = next((p for p in _label_map_candidates if os.path.exists(p)), None)

# ────────────────────────────────────────────────
# 1. API 서버 생성
# ────────────────────────────────────────────────
# .env의 ALLOWED_ORIGINS에 쉼표로 구분된 도메인 목록을 입력하세요.
# 예) ALLOWED_ORIGINS=http://localhost:3000,https://fashion2cation.co.kr
_raw_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000")
ALLOWED_ORIGINS = [o.strip() for o in _raw_origins.split(",") if o.strip()]

app = FastAPI(title="Fashion.2.Cation AI 서버")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ────────────────────────────────────────────────
# 2. 하드웨어 & 모델 로딩
# ────────────────────────────────────────────────
device = (
    "cuda" if torch.cuda.is_available()
    else "mps" if torch.backends.mps.is_available()
    else "cpu"
)
print(f"🖥️  디바이스: {device}")

if not os.path.exists(MODEL_PATH):
    raise FileNotFoundError(
        f"❌ 모델 파일 없음: {MODEL_PATH}\n"
        "   먼저 python Ai/research/train.py 를 실행하세요."
    )

print(f"🤖 YOLOv8 모델 로딩 중... ({MODEL_PATH})")
model = YOLO(MODEL_PATH)
print("✅ 모델 로드 완료!")

# ────────────────────────────────────────────────
# 3. 클래스 이름 로딩
# ────────────────────────────────────────────────
if LABEL_MAP_PATH and os.path.exists(LABEL_MAP_PATH):
    with open(LABEL_MAP_PATH, "r", encoding="utf-8") as f:
        label_maps = json.load(f)
    class_map   = label_maps.get("class_label", {})
    class_names = [class_map[str(i)] for i in range(len(class_map))]
    gender_map  = label_maps.get("gender", {})
    color_map   = label_maps.get("color", {})
    style_map   = label_maps.get("style", {})
elif os.path.exists(YAML_PATH):
    with open(YAML_PATH, "r", encoding="utf-8") as f:
        cfg = yaml.safe_load(f)
    names_raw   = cfg.get("names", {})
    class_names = [names_raw[i] for i in sorted(names_raw.keys())] \
                  if isinstance(names_raw, dict) else list(names_raw)
    gender_map = color_map = style_map = {}
else:
    class_names = list(model.names.values())
    gender_map = color_map = style_map = {}

print(f"🏷️  클래스 {len(class_names)}개: {class_names}")

# ────────────────────────────────────────────────
# 4. DB 연결 (추천 엔드포인트용)
# ────────────────────────────────────────────────
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:password@localhost:5432/fashion2cation")
try:
    _engine  = create_engine(DATABASE_URL, pool_pre_ping=True)
    _Session = sessionmaker(bind=_engine)
    print(f"✅ DB 연결 성공")
    DB_AVAILABLE = True
except Exception as e:
    print(f"⚠️  DB 연결 실패 (추천 기능 비활성화): {e}")
    DB_AVAILABLE = False

# ────────────────────────────────────────────────
# 코디 조합 규칙
# ────────────────────────────────────────────────
OUTFIT_PAIRS = {
    "상의":   ["하의", "아우터", "신발"],
    "하의":   ["상의", "아우터", "신발"],
    "아우터": ["상의", "하의", "신발"],
    "원피스": ["아우터", "신발"],
    "스커트": ["상의", "아우터", "신발"],
    "신발":   ["상의", "하의", "원피스"],
}

MIN_CONFIDENCE = 25.0


def _split_class_label(class_label: str) -> tuple[str | None, str | None]:
    """'남성_상의' → ('남성', '상의'). 형식이 다르면 (None, class_label)."""
    if "_" in class_label:
        gender, _, category = class_label.partition("_")
        return gender, category
    return None, class_label


def _run_yolo(image_bytes: bytes) -> tuple[list, dict | None]:
    """YOLOv8 추론 실행. (detections 리스트, best 딕셔너리 or None) 반환."""
    image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    results = model.predict(source=image, imgsz=224, conf=0.25, verbose=False, device=device)
    boxes = results[0].boxes

    if len(boxes) == 0:
        return [], None

    detections = []
    for box in boxes:
        class_id   = int(box.cls.item())
        confidence = round(float(box.conf.item()) * 100, 2)
        class_label = class_names[class_id] if class_id < len(class_names) else "unknown"
        gender, category = _split_class_label(class_label)
        entry = {
            "class_label": class_label,
            "category":    category,
            "gender":      gender,
            "color":       None,  # YOLO 탐지 모델에서는 예측 불가 — 별도 분류기 필요
            "style":       None,
            "confidence":  confidence,
        }
        # bbox는 /predict 엔드포인트에서만 필요하므로 선택적으로 추가
        if hasattr(box, "xyxy"):
            x1, y1, x2, y2 = [round(v, 2) for v in box.xyxy[0].tolist()]
            entry["bbox"] = {"x1": x1, "y1": y1, "x2": x2, "y2": y2}
        detections.append(entry)

    detections.sort(key=lambda d: d["confidence"], reverse=True)
    best = detections[0]

    if best["confidence"] < MIN_CONFIDENCE:
        return detections, None

    return detections, best


# ════════════════════════════════════════════════
# 5. 추론 엔드포인트
# ════════════════════════════════════════════════
@app.post("/predict")
async def predict_image(file: UploadFile = File(...)):
    """YOLOv8 로 이미지를 분석해 카테고리·신뢰도·바운딩박스를 반환합니다."""
    image_bytes = await file.read()
    detections, best = _run_yolo(image_bytes)

    if not detections:
        return {
            "status":     "failed",
            "message":    "옷을 감지하지 못했습니다. 다른 사진을 사용해 주세요.",
            "detections": []
        }

    if best is None:
        return {
            "status":     "failed",
            "message":    f"신뢰도가 너무 낮습니다. ({detections[0]['confidence']}%)",
            "detections": detections
        }

    return {
        "status":     "success",
        "detections": detections,
    }


# ════════════════════════════════════════════════
# 6. 추천 엔드포인트
# ════════════════════════════════════════════════

@app.post("/recommend/image")
async def recommend_by_image(
    file: UploadFile = File(...),
    limit: int = Query(20, ge=1, le=100),
):
    """
    이미지를 업로드하면 YOLOv8로 카테고리를 감지하고
    같은 class_label의 상품을 추천합니다.
    """
    if not DB_AVAILABLE:
        return {"status": "failed", "message": "DB 연결 없음"}

    image_bytes = await file.read()
    detections, best = _run_yolo(image_bytes)

    if not detections:
        return {"status": "failed", "message": "옷을 감지하지 못했습니다.", "products": []}

    if best is None:
        return {"status": "failed", "message": f"신뢰도 낮음 ({detections[0]['confidence']}%)", "products": []}

    detected_class = best["class_label"]

    with _Session() as db:
        rows = db.execute(
            text("""
                SELECT * FROM products
                WHERE class_label = :cls
                ORDER BY RANDOM()
                LIMIT :lim
            """),
            {"cls": detected_class, "lim": limit}
        ).fetchall()

    return {
        "status":         "success",
        "detected_class": detected_class,
        "category":       best["category"],
        "gender":         best["gender"],
        "confidence":     best["confidence"],
        "products":       [dict(r._mapping) for r in rows],
    }


@app.get("/recommend/popular")
def recommend_popular(
    category:    Optional[str]   = Query(None, description="상의/하의/아우터/원피스/스커트/신발"),
    gender:      Optional[str]   = Query(None, description="남성/여성/공용"),
    class_label: Optional[str]   = Query(None, description="남성_상의 등 class_label"),
    style:       Optional[str]   = Query(None, description="casual, street, formal 등"),
    color:       Optional[str]   = Query(None, description="black, white, blue 등"),
    min_price:   Optional[float] = Query(None, ge=0),
    max_price:   Optional[float] = Query(None, ge=0),
    limit:       int             = Query(20, ge=1, le=100),
):
    """
    heart_count × 2 + review_count 기준 인기 상품을 추천합니다.
    category, gender, class_label, style, color, 가격대로 필터링 가능합니다.
    """
    if not DB_AVAILABLE:
        return {"status": "failed", "message": "DB 연결 없음"}

    with _Session() as db:
        rows = db.execute(
            text("""
                SELECT *,
                       COALESCE(heart_count, 0) * 2 + COALESCE(review_count, 0) AS score
                FROM products
                WHERE (:category    IS NULL OR category    = :category)
                  AND (:gender      IS NULL OR gender      = :gender OR gender = '공용')
                  AND (:class_label IS NULL OR class_label = :class_label)
                  AND (:style       IS NULL OR style       = :style)
                  AND (:color       IS NULL OR color       = :color)
                  AND (:min_price   IS NULL OR price      >= :min_price)
                  AND (:max_price   IS NULL OR price      <= :max_price)
                ORDER BY score DESC
                LIMIT :lim
            """),
            {
                "category":    category,
                "gender":      gender,
                "class_label": class_label,
                "style":       style,
                "color":       color,
                "min_price":   min_price,
                "max_price":   max_price,
                "lim":         limit,
            }
        ).fetchall()

    return {
        "status":   "success",
        "source":   "popular",
        "filters":  {
            "category": category, "gender": gender, "class_label": class_label,
            "style": style, "color": color,
            "min_price": min_price, "max_price": max_price,
        },
        "products": [dict(r._mapping) for r in rows],
    }


@app.get("/recommend/outfit")
def recommend_outfit(
    category: str           = Query(..., description="기준 카테고리 (상의/하의/아우터/원피스/스커트/신발)"),
    gender:   Optional[str] = Query(None),
    style:    Optional[str] = Query(None),
    limit:    int           = Query(10, ge=1, le=50),
):
    """
    선택한 카테고리에 어울리는 카테고리 상품들을 함께 추천합니다.
    예) 상의 → 하의 + 아우터 + 신발
    """
    if not DB_AVAILABLE:
        return {"status": "failed", "message": "DB 연결 없음"}

    paired = OUTFIT_PAIRS.get(category)
    if not paired:
        return {
            "status":  "failed",
            "message": f"'{category}' 카테고리에 대한 코디 규칙이 없습니다.",
        }

    outfit: dict = {}
    with _Session() as db:
        for cat in paired:
            rows = db.execute(
                text("""
                    SELECT * FROM products
                    WHERE category = :category
                      AND (:gender IS NULL OR gender = :gender OR gender = '공용')
                      AND (:style  IS NULL OR style  = :style)
                    ORDER BY COALESCE(heart_count, 0) DESC, RANDOM()
                    LIMIT :lim
                """),
                {"category": cat, "gender": gender, "style": style, "lim": limit}
            ).fetchall()

            if rows:
                outfit[cat] = [dict(r._mapping) for r in rows]

    return {
        "status":        "success",
        "base_category": category,
        "paired_with":   paired,
        "outfit":        outfit,
    }


@app.get("/recommend/preference")
def recommend_by_preference(
    user_id: str = Query(..., description="유저 UUID"),
    limit:   int = Query(20, ge=1, le=100),
):
    """
    user_preferences 테이블의 유저 설정값 기반으로 상품을 추천합니다.
    선호도 미설정 시 인기 추천으로 대체됩니다.
    """
    if not DB_AVAILABLE:
        return {"status": "failed", "message": "DB 연결 없음"}

    with _Session() as db:
        pref = db.execute(
            text("SELECT * FROM user_preferences WHERE user_id = :uid"),
            {"uid": user_id}
        ).fetchone()

        if not pref:
            rows = db.execute(
                text("""
                    SELECT * FROM products
                    ORDER BY COALESCE(heart_count,0)*2 + COALESCE(review_count,0) DESC
                    LIMIT :lim
                """),
                {"lim": limit}
            ).fetchall()
            return {
                "status":   "success",
                "source":   "popular_fallback",
                "products": [dict(r._mapping) for r in rows],
            }

        # 선호도 기반 필터링 — IN 절은 파라미터 바인딩으로 처리
        conditions = []
        params: dict = {"lim": limit}

        if pref.preferred_gender:
            conditions.append("(gender = :gender OR gender = '공용')")
            params["gender"] = pref.preferred_gender

        if pref.preferred_categories:
            cats = [c.strip() for c in pref.preferred_categories.split(",") if c.strip()]
            if cats:
                placeholders = ", ".join([f":cat{i}" for i in range(len(cats))])
                conditions.append(f"category IN ({placeholders})")
                for i, c in enumerate(cats):
                    params[f"cat{i}"] = c

        if pref.preferred_styles:
            styles = [s.strip() for s in pref.preferred_styles.split(",") if s.strip()]
            if styles:
                placeholders = ", ".join([f":style{i}" for i in range(len(styles))])
                conditions.append(f"style IN ({placeholders})")
                for i, s in enumerate(styles):
                    params[f"style{i}"] = s

        if pref.preferred_colors:
            colors = [c.strip() for c in pref.preferred_colors.split(",") if c.strip()]
            if colors:
                placeholders = ", ".join([f":color{i}" for i in range(len(colors))])
                conditions.append(f"color IN ({placeholders})")
                for i, c in enumerate(colors):
                    params[f"color{i}"] = c

        where = ("WHERE " + " AND ".join(conditions)) if conditions else ""
        rows = db.execute(
            text(f"""
                SELECT * FROM products
                {where}
                ORDER BY COALESCE(heart_count,0) DESC, RANDOM()
                LIMIT :lim
            """),
            params
        ).fetchall()

    return {
        "status":   "success",
        "source":   "preference",
        "products": [dict(r._mapping) for r in rows],
    }


# ════════════════════════════════════════════════
# 7. 헬스체크
# ════════════════════════════════════════════════
@app.get("/health")
async def health_check():
    return {
        "status":       "ok",
        "model":        "YOLOv8",
        "device":       device,
        "classes":      len(class_names),
        "class_names":  class_names,
        "db":           "connected" if DB_AVAILABLE else "disconnected",
    }


# ────────────────────────────────────────────────
# 서버 실행
# ────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("ai_server:app", host="0.0.0.0", port=8001, reload=True)
