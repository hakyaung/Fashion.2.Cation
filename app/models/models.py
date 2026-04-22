from sqlalchemy import Column, Integer, String, Text, ForeignKey, Float, Boolean, DateTime, UniqueConstraint, SmallInteger
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

# 프로젝트 경로에 맞게 Base를 임포트하세요
from app.db.session import Base

# ==========================================
# 💡 팔로우(Follow) 테이블
# ==========================================
class Follow(Base):
    __tablename__ = "follows"
    id = Column(Integer, primary_key=True, index=True)
    follower_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    following_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (UniqueConstraint('follower_id', 'following_id', name='uq_follower_following'),)

class User(Base):
    __tablename__ = "users"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String, unique=True, index=True, nullable=False)
    nickname = Column(String, unique=True, nullable=False)
    password_hash = Column(String, nullable=False)
    bio = Column(Text, nullable=True)
    profile_image_url = Column(Text, nullable=True)
    fcm_token = Column(String, nullable=True) 
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    posts = relationship("Post", back_populates="user", cascade="all, delete-orphan")
    likes = relationship("Like", back_populates="user", cascade="all, delete-orphan")
    comments = relationship("Comment", back_populates="user", cascade="all, delete-orphan")
    
    # 유저가 작성한 스냅 영상 관계
    snaps = relationship("Snap", back_populates="user", cascade="all, delete-orphan")

    following = relationship(
        "Follow",
        foreign_keys=[Follow.follower_id],
        backref="follower_user",
        cascade="all, delete-orphan"
    )
    followers = relationship(
        "Follow",
        foreign_keys=[Follow.following_id],
        backref="following_user",
        cascade="all, delete-orphan"
    )

    # 💡 [새로 추가됨] AI 추천용 유저 선호도 (1:1 관계)
    preferences = relationship("UserPreference", back_populates="user", uselist=False, cascade="all, delete-orphan")

class Post(Base):
    __tablename__ = "posts"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    image_url = Column(Text, nullable=True)
    location_id = Column(Integer, ForeignKey("locations.id", ondelete="SET NULL"))
    content = Column(Text)
    ai_status = Column(String, default="pending") 
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="posts")
    location = relationship("Location", back_populates="posts")
    tags = relationship("PostTag", back_populates="post", cascade="all, delete-orphan")
    likes = relationship("Like", back_populates="post", cascade="all, delete-orphan")
    comments = relationship("Comment", back_populates="post", cascade="all, delete-orphan")

# ==========================================
# 🎬 스냅(숏폼 영상) 테이블 - 메타데이터 강화
# ==========================================
class Snap(Base):
    __tablename__ = "snaps"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    
    location_id = Column(Integer, ForeignKey("locations.id", ondelete="SET NULL"), nullable=True)
    
    video_url = Column(Text, nullable=False) 
    content = Column(Text, nullable=True) # 스냅 본문 내용
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # 관계 설정
    user = relationship("User", back_populates="snaps")
    location = relationship("Location", back_populates="snaps") 
    
    tags = relationship("SnapTag", back_populates="snap", cascade="all, delete-orphan")
    likes = relationship("SnapLike", back_populates="snap", cascade="all, delete-orphan")
    comments = relationship("SnapComment", back_populates="snap", cascade="all, delete-orphan")

# ==========================================
# 🏷️ 스냅 전용 태그 테이블
# ==========================================
class SnapTag(Base):
    __tablename__ = "snap_tags"
    snap_id = Column(UUID(as_uuid=True), ForeignKey("snaps.id", ondelete="CASCADE"), primary_key=True)
    tag_name = Column(String, primary_key=True)

    snap = relationship("Snap", back_populates="tags")

# ==========================================
# ❤️ 스냅 좋아요 테이블
# ==========================================
class SnapLike(Base):
    __tablename__ = "snap_likes"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    snap_id = Column(UUID(as_uuid=True), ForeignKey("snaps.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (UniqueConstraint('user_id', 'snap_id', name='uix_user_snap_like_unique'),)

    user = relationship("User", backref="snap_likes_rel")
    snap = relationship("Snap", back_populates="likes")

# ==========================================
# 💬 스냅 댓글 테이블
# ==========================================
class SnapComment(Base):
    __tablename__ = "snap_comments"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    snap_id = Column(UUID(as_uuid=True), ForeignKey("snaps.id", ondelete="CASCADE"), nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    user = relationship("User", backref="snap_comments_rel")
    snap = relationship("Snap", back_populates="comments")

class PostTag(Base):
    __tablename__ = "post_tags"
    post_id = Column(UUID(as_uuid=True), ForeignKey("posts.id", ondelete="CASCADE"), primary_key=True)
    tag_name = Column(String, primary_key=True)
    confidence_score = Column(Float, default=0.0)
    is_ai_generated = Column(Boolean, default=True)

    post = relationship("Post", back_populates="tags")

class Like(Base):
    __tablename__ = "likes"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    post_id = Column(UUID(as_uuid=True), ForeignKey("posts.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (UniqueConstraint('user_id', 'post_id', name='uix_user_post_like'),)

    user = relationship("User", back_populates="likes")
    post = relationship("Post", back_populates="likes")

class Comment(Base):
    __tablename__ = "comments"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    post_id = Column(UUID(as_uuid=True), ForeignKey("posts.id", ondelete="CASCADE"), nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    user = relationship("User", back_populates="comments")
    post = relationship("Post", back_populates="comments")

class Location(Base):
    __tablename__ = "locations"
    id = Column(Integer, primary_key=True, index=True)
    city = Column(String, nullable=False)
    district = Column(String, nullable=False)
    full_name = Column(String, unique=True, nullable=False)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)

    posts = relationship("Post", back_populates="location")
    snaps = relationship("Snap", back_populates="location")

# ==========================================
# 💬 채팅방 모델 (1:1 DM)
# ==========================================
class ChatRoom(Base):
    __tablename__ = "chat_rooms"
    id = Column(Integer, primary_key=True, index=True)
    user1_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    user2_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    messages = relationship("Message", back_populates="room", cascade="all, delete-orphan")

# ==========================================
# 💬 메시지 모델
# ==========================================
class Message(Base):
    __tablename__ = "messages"
    id = Column(Integer, primary_key=True, index=True)
    room_id = Column(Integer, ForeignKey("chat_rooms.id", ondelete="CASCADE"), nullable=False)
    sender_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    content = Column(String, nullable=False)
    is_read = Column(Boolean, default=False) 
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    room = relationship("ChatRoom", back_populates="messages")
    sender = relationship("User")

# ==========================================
# 👗 [새로 추가됨] AI 추천용 products 테이블
# ==========================================
class Product(Base):
    __tablename__ = "products"
    
    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String(255), nullable=False)
    brand = Column(String(100))
    product_name = Column(Text)
    
    # 카테고리
    class_label = Column(String(50), nullable=False, index=True)
    gender = Column(String(20), index=True)
    category = Column(String(20), index=True)
    
    # 인코딩 코드 (빠른 필터링용)
    gender_code = Column(SmallInteger)
    category_code = Column(SmallInteger)
    class_code = Column(SmallInteger, index=True)
    
    # 스타일
    color = Column(String(50))
    style = Column(String(50))
    color_code = Column(SmallInteger)
    style_code = Column(SmallInteger)
    
    # 통계 (인기 추천용)
    price = Column(Float)
    discount_rate = Column(Float)
    review_count = Column(Integer)
    heart_count = Column(Integer)
    color_score = Column(Float)
    style_score = Column(Float)
    
    image_url = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

# ==========================================
# 🎯 [새로 추가됨] 유저 선호도 테이블 (추천 필터링용)
# ==========================================
class UserPreference(Base):
    __tablename__ = "user_preferences"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    
    # 💡 [핵심 수정] nullable=True를 명시하여 데이터가 들어갈 수 있도록 보장
    preferred_categories = Column(Text, nullable=True)
    preferred_styles = Column(Text, nullable=True)
    preferred_colors = Column(Text, nullable=True)
    preferred_gender = Column(String(20), nullable=True)
    
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # User 테이블과의 관계
    user = relationship("User", back_populates="preferences")