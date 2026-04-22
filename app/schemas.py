from pydantic import BaseModel
from datetime import datetime
from typing import Optional

# ==========================================
# 💬 메시지 스키마
# ==========================================
class MessageBase(BaseModel):
    content: str

class MessageResponse(MessageBase):
    id: int
    room_id: int
    sender_id: str  # 💡 int -> str 로 변경
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True

# ==========================================
# 💬 채팅방 스키마
# ==========================================
class ChatRoomResponse(BaseModel):
    id: int
    user1_id: str  # 💡 int -> str 로 변경
    user2_id: str  # 💡 int -> str 로 변경
    created_at: datetime
    last_message: Optional[str] = None 
    unread_count: int = 0 

    class Config:
        from_attributes = True

class ProductResponse(BaseModel):
    id: int
    product_name: Optional[str]
    brand: Optional[str]
    image_url: Optional[str]
    price: Optional[float]
    discount_rate: Optional[float]
    heart_count: Optional[int]
    review_count: Optional[int]
    class_label: str
    style: Optional[str]
    color: Optional[str]

    class Config:
        from_attributes = True

class UserPreferenceUpdate(BaseModel):
    preferred_categories: Optional[str] = None
    preferred_styles: Optional[str] = None
    preferred_colors: Optional[str] = None
    preferred_gender: Optional[str] = None