# app/services/ai_gateway.py
def send_to_ai_worker(post_id: str, image_url: str):
    # 지금은 AI가 없으니 로그만 남깁니다.
    print(f"[SYSTEM] AI 분석 대기열에 추가됨: Post ID {post_id}")
