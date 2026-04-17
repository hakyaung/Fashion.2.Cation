from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Dict, List
import json
import uuid
import asyncio

from app.db.session import get_db
from app.db.session import SessionLocal
from app.models.models import Message, ChatRoom, User
from app.schemas import MessageResponse 
from sqlalchemy import or_, desc

# 💡 무전기(알림 발신기) 가져오기
from app.core.notifier import notifier

from app.core.fcm import send_fcm_notification

router = APIRouter()

# ==========================================
# 🔌 웹소켓 연결 매니저 (교환원 역할)
# ==========================================
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[int, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, room_id: int):
        if room_id not in self.active_connections:
            self.active_connections[room_id] = []
        self.active_connections[room_id].append(websocket)

    def disconnect(self, websocket: WebSocket, room_id: int):
        if room_id in self.active_connections:
            if websocket in self.active_connections[room_id]:
                self.active_connections[room_id].remove(websocket)
            if not self.active_connections[room_id]:
                del self.active_connections[room_id]

    async def broadcast_to_room(self, room_id: int, message: str):
        if room_id in self.active_connections:
            for connection in self.active_connections[room_id]:
                try:
                    await connection.send_text(message)
                except:
                    # 연결이 끊긴 소켓은 무시
                    pass

manager = ConnectionManager()

# ==========================================
# 💬 웹소켓 실시간 통신 엔드포인트
# ==========================================
@router.websocket("/ws/{room_id}/{user_id}")
async def websocket_chat(websocket: WebSocket, room_id: str, user_id: str):
    # 1. 여기서 딱 한 번만 수락합니다!
    await websocket.accept()
    
    print(f"📡 웹소켓 연결 성공: Room {room_id}, User {user_id}")
    
    db = SessionLocal()
    try:
        room_id_int = int(room_id)
        user_uuid = uuid.UUID(user_id)
        
        # 누가 누구에게 보내는지 파악하기 위해 방 정보와 보낸 사람 정보를 미리 가져옵니다.
        room = db.query(ChatRoom).filter(ChatRoom.id == room_id_int).first()
        sender = db.query(User).filter(User.id == user_uuid).first()
        
        # 상대방 ID 찾기 (알림을 받을 타겟)
        target_user_id = None
        if room:
            target_user_id = room.user2_id if str(room.user1_id) == user_id else room.user1_id

        # 매니저에 등록
        await manager.connect(websocket, room_id_int)
        
        while True:
            # 클라이언트로부터 메시지 수신 대기
            data = await websocket.receive_text()
            
            # DB 저장
            new_message = Message(room_id=room_id_int, sender_id=user_uuid, content=data)
            db.add(new_message)
            db.commit()
            db.refresh(new_message)

            # 포장해서 방 전체에 뿌리기
            msg_data = {
                "type": "message",
                "id": new_message.id,
                "room_id": room_id_int,
                "sender_id": str(new_message.sender_id),
                "content": new_message.content,
                "is_read": new_message.is_read,
                "created_at": new_message.created_at.isoformat() if new_message.created_at else ""
            }
            await manager.broadcast_to_room(room_id_int, json.dumps(msg_data))
            
            # 상대방의 화면(무전기)으로 실시간 웹소켓 알림 쏘기!
            if target_user_id and sender:
                await notifier.push(
                    str(target_user_id), 
                    "새로운 메시지 💬", 
                    f"{sender.nickname}: {data}"
                )

            # 💡 [핵심 수정] 화면 꺼진 사람(아이폰)을 위한 알림 발송 (백그라운드 처리)
            target_user = db.query(User).filter(User.id == target_user_id).first()
            if target_user and target_user.fcm_token:
                # 🚀 우체국 업무는 백그라운드 직원에게 던져버리고 채팅방은 멈추지 않습니다!
                asyncio.create_task(
                    asyncio.to_thread(
                        send_fcm_notification,
                        target_user.fcm_token,
                        "새로운 메시지 💬",
                        f"{sender.nickname}: {data}"
                    )
                )
            
    except WebSocketDisconnect:
        manager.disconnect(websocket, int(room_id))
        print(f"ℹ️ 유저 {user_id} 연결 종료")
    except Exception as e:
        print(f"❌ 웹소켓 서버 에러: {e}")
    finally:
        db.close()

# ==========================================
# 📜 과거 채팅 내역 불러오기 API
# ==========================================
@router.get("/{room_id}/messages", response_model=List[MessageResponse])
def get_chat_history(room_id: int, db: Session = Depends(get_db)):
    messages = db.query(Message).filter(Message.room_id == room_id).order_by(Message.created_at.asc()).all()
    # UUID 객체를 문자열로 안전하게 변환
    for msg in messages:
        msg.sender_id = str(msg.sender_id)
    return messages

# ==========================================
# 🚪 채팅방 생성/조회 API (User A가 User B에게 대화 걸기)
# ==========================================
@router.post("/room/{target_user_id}")
def get_or_create_room(target_user_id: str, current_user_id: str, db: Session = Depends(get_db)):
    # 💡 실제 구현 시에는 current_user_id를 보안 토큰(Depends)에서 가져와야 합니다.
    # 우선 테스트를 위해 파라미터로 받게 해두었습니다.
    
    # 이미 둘 사이의 방이 있는지 확인
    existing_room = db.query(ChatRoom).filter(
        ((ChatRoom.user1_id == current_user_id) & (ChatRoom.user2_id == target_user_id)) |
        ((ChatRoom.user1_id == target_user_id) & (ChatRoom.user2_id == current_user_id))
    ).first()

    if existing_room:
        return {"room_id": existing_room.id}

    # 방이 없으면 새로 생성
    new_room = ChatRoom(user1_id=current_user_id, user2_id=target_user_id)
    db.add(new_room)
    db.commit()
    db.refresh(new_room)
    
    return {"room_id": new_room.id}

# ==========================================
# 📂 내 채팅방 목록 가져오기 (인스타 DM 리스트용)
# ==========================================
@router.get("/rooms")
def get_user_rooms(current_user_id: str, db: Session = Depends(get_db)):
    # 1. 내가 참여한 모든 채팅방 조회
    rooms = db.query(ChatRoom).filter(
        or_(ChatRoom.user1_id == current_user_id, ChatRoom.user2_id == current_user_id)
    ).all()

    result = []
    for room in rooms:
        # 2. 나 말고 상대방 유저 정보 찾기
        other_user_id = room.user2_id if str(room.user1_id) == current_user_id else room.user1_id
        other_user = db.query(User).filter(User.id == other_user_id).first()
        
        # 3. 마지막 메시지 가져오기
        last_msg = db.query(Message).filter(Message.room_id == room.id)\
                      .order_by(desc(Message.created_at)).first()

        result.append({
            "id": room.id,
            "other_user": {
                "id": str(other_user.id),
                "nickname": other_user.nickname,
                "profile_image_url": other_user.profile_image_url
            },
            "last_message": last_msg.content if last_msg else "대화 내용이 없습니다.",
            "last_message_time": last_msg.created_at.isoformat() if last_msg else room.created_at.isoformat(),
            "unread_count": db.query(Message).filter(Message.room_id == room.id, 
                                                    Message.sender_id != current_user_id, 
                                                    Message.is_read == False).count()
        })
    
    # 마지막 메시지 시간순으로 정렬
    return sorted(result, key=lambda x: x['last_message_time'], reverse=True)

# ==========================================
# 💡 메시지 읽음 처리 API
# ==========================================
@router.put("/room/{room_id}/read")
async def mark_messages_as_read(room_id: int, current_user_id: str, db: Session = Depends(get_db)):
    unread_messages = db.query(Message).filter(
        Message.room_id == room_id,
        Message.sender_id != current_user_id,
        Message.is_read == False    
    ).all()
    
    if not unread_messages:
        return {"status": "ok", "updated": 0}
        
    for msg in unread_messages:
        msg.is_read = True
    db.commit()
    
    # 파이썬의 숫자형 room_id를 문자열(str)로 변환해서 방송합니다.
    read_event = {
        "type": "read_receipt",
        "room_id": str(room_id), 
        "reader_id": str(current_user_id)
    }
    
    await manager.broadcast_to_room(str(room_id), json.dumps(read_event))
    
    return {"status": "ok", "updated": len(unread_messages)}