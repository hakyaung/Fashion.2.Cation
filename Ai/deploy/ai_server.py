import os
import io
import json
import yaml
from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
from ultralytics import YOLO

# ────────────────────────────────────────────────
# 1. API 서버 생성
# ────────────────────────────────────────────────
app = FastAPI(title="패션 YOLOv8 감지 AI")

# ==========================================
# 💡 1. API 서버 생성 (반드시 미들웨어 추가보다 먼저 와야 합니다!)
# ==========================================
app = FastAPI(title="패션 멀티태스크 감정 AI")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 2. 하드웨어 & 환경 세팅 (Mac MPS 지원 추가)
device = torch.device("cuda" if torch.cuda.is_available() else "mps" if torch.backends.mps.is_available() else "cpu")
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

print(f"🤖 YOLOv8 모델 로딩 중... ({MODEL_PATH})")
model = YOLO(MODEL_PATH)
print("✅ 모델 로드 완료!")

# label_maps.json 에서 클래스 이름 읽기 (clean_metadata.py 가 생성)
if os.path.exists(LABEL_MAP_PATH):
    with open(LABEL_MAP_PATH, "r", encoding="utf-8") as f:
        label_maps = json.load(f)
    class_map = label_maps.get("class_label", {})
    class_names = [class_map[str(i)] for i in range(len(class_map))]
    gender_map = label_maps.get("gender", {})
    color_map  = label_maps.get("color", {})
    style_map  = label_maps.get("style", {})
elif os.path.exists(YAML_PATH):
    with open(YAML_PATH, "r", encoding="utf-8") as f:
        cfg = yaml.safe_load(f)
    names_raw = cfg.get("names", {})
    class_names = [names_raw[i] for i in sorted(names_raw.keys())] \
                  if isinstance(names_raw, dict) else list(names_raw)
    gender_map = color_map = style_map = {}
else:
    class_names = list(model.names.values())
    gender_map = color_map = style_map = {}

print(f"🏷️  클래스 {len(class_names)}개: {class_names}")

# ────────────────────────────────────────────────
# 3. 추론 엔드포인트
# ────────────────────────────────────────────────
@app.post("/predict")
async def predict_image(file: UploadFile = File(...)):
    # 이미지 읽기
    image_bytes = await file.read()
    image = Image.open(io.BytesIO(image_bytes)).convert("RGB")

    # YOLOv8 추론
    results = model.predict(source=image, imgsz=224, conf=0.25, verbose=False)
    result  = results[0]

    # 감지된 객체가 없는 경우
    if len(result.boxes) == 0:
        return {
            "status": "failed",
            "message": "옷을 감지하지 못했습니다. 다른 사진을 사용해 주세요.",
            "detections": []
        }

    # 감지된 객체들 파싱 (신뢰도 순 정렬)
    detections = []
    for box in result.boxes:
        class_id   = int(box.cls.item())
        confidence = round(float(box.conf.item()) * 100, 2)
        x1, y1, x2, y2 = [round(v, 2) for v in box.xyxy[0].tolist()]

        detections.append({
            "category":   class_names[class_id] if class_id < len(class_names) else "unknown",
            "confidence": confidence,
            "bbox": {"x1": x1, "y1": y1, "x2": x2, "y2": y2},
        })

    # 신뢰도 높은 순 정렬
    detections.sort(key=lambda d: d["confidence"], reverse=True)
    best = detections[0]

    # 신뢰도 컷 (25% 미만은 불확실로 처리)
    if best["confidence"] < 25.0:
        return {
            "status": "failed",
            "message": f"신뢰도가 너무 낮습니다. ({best['confidence']}%)",
            "detections": detections
        }

    return {
        "status":     "success",
        "category":   best["category"],
        "confidence": best["confidence"],
        "detections": detections,
    }


@app.get("/health")
async def health_check():
    return {"status": "ok", "model": "YOLOv8", "classes": len(class_names)}


# ────────────────────────────────────────────────
# 서버 실행
# ────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("ai_server:app", host="0.0.0.0", port=8001, reload=True)
