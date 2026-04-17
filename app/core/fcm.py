import firebase_admin
from firebase_admin import credentials, messaging
import os

# 💡 아까 몰래 숨겨둔 마스터 열쇠 경로!
KEY_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "firebase-key.json")

# 서버가 켜질 때 딱 한 번만 파이어베이스 초기화
try:
    if not firebase_admin._apps:
        cred = credentials.Certificate(KEY_PATH)
        firebase_admin.initialize_app(cred)
        print("✅ Firebase Admin (우체국) 초기화 성공!")
except Exception as e:
    print("⚠️ Firebase 초기화 에러:", e)

# 🔔 진짜 푸시 알림을 쏘는 마법의 함수
def send_fcm_notification(fcm_token: str, title: str, body: str):
    if not fcm_token:
        return False

    try:
        # 알림 내용 포장하기
        message = messaging.Message(
            notification=messaging.Notification(
                title=title,
                body=body,
            ),
            # ==========================================
            # 💡 [핵심 추가 1] 아이폰 서버가 백그라운드 통신을 끊지 못하게 '긴급(High)' 헤더 강제 주입!
            # ==========================================
            webpush=messaging.WebpushConfig(
                headers={
                    "Urgency": "high" # 🚨 이거 없으면 iOS 백그라운드는 1번 울리고 죽습니다!
                },
                fcm_options=messaging.WebpushFCMOptions(
                    link="https://fashion2cation.co.kr" # 알림 누르면 열릴 주소
                )
            ),
            # ==========================================
            # 💡 [핵심 추가 2] 아이폰(iOS) 잠금화면을 확실히 깨우고 소리를 내는 마법의 설정!
            # ==========================================
            apns=messaging.APNSConfig(
                payload=messaging.APNSPayload(
                    aps=messaging.Aps(
                        sound="default", # 띠링! 소리를 내게 합니다
                        badge=1          # 앱 아이콘 우측 상단에 빨간 숫자(1)를 띄웁니다
                    )
                )
            ),
            token=fcm_token,
        )
        # 구글 우체국으로 발송!
        response = messaging.send(message)
        print(f"🚀 아이폰 잠금화면 푸시 전송 성공! (메시지 ID: {response})")
        return True
    except Exception as e:
        print(f"❌ 푸시 알림 전송 실패: {e}")
        return False