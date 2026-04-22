# app/services/ai_gateway.py
# def send_to_ai_worker(post_id: str, image_url: str):
#     # 지금은 AI가 없으니 로그만 남깁니다.
#     print(f"[SYSTEM] AI 분석 대기열에 추가됨: Post ID {post_id}")

import httpx
from sqlalchemy.orm import Session
from app.models.models import Post, PostTag

AI_SERVER_URL = "http://localhost:8001"

def send_to_ai_worker(post_id: str, image_url: str, db: Session):
    try:
        # 이미지 다운로드
        img_resp = httpx.get(image_url, timeout=10)
        if img_resp.status_code != 200:
            return

        # AI 서버에 분석 요청
        files = {"file": ("image.jpg", img_resp.content, "image/jpeg")}
        ai_resp = httpx.post(f"{AI_SERVER_URL}/predict", files=files, timeout=15)
        if ai_resp.status_code != 200:
            return

        result = ai_resp.json()
        if result.get("status") != "success":
            db.query(Post).filter(Post.id == post_id).update({"ai_status": "failed"})
            db.commit()
            return

        # 기존 AI 태그 삭제 후 재저장
        # 올바른 방식 - detections 전체 저장
        for det in result.get("detections", []):
            tag = PostTag(
                post_id=post_id,
                tag_name=det["category"],
                confidence_score=det["confidence"] / 100.0,
                is_ai_generated=True,
            )
            db.add(tag)

        for det in result.get("detections", []):
            tag = PostTag(
                post_id=post_id,
                tag_name=det["category"],
                confidence_score=det["confidence"] / 100.0,
                is_ai_generated=True,
            )
            db.add(tag)

        db.query(Post).filter(Post.id == post_id).update({"ai_status": "completed"})
        db.commit()

    except Exception as e:
        print(f"[AI Gateway] 오류: {e}")