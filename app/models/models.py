from sqlalchemy import Column, Integer, String, Text, ForeignKey, Float, Boolean, DateTime, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

# 프로젝트 경로에 맞게 Base를 임포트하세요
from app.db.session import Base

# ==========================================
# 💡 새롭게 추가된 팔로우(Follow) 테이블
# ==========================================
class Follow(Base):
    __tablename__ = "follows"
    id = Column(Integer, primary_key=True, index=True)
    follower_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    following_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # 중복 팔로우 방지 (A가 B를 두 번 팔로우할 수 없음)
    __table_args__ = (UniqueConstraint('follower_id', 'following_id', name='uq_follower_following'),)

class User(Base):
    __tablename__ = "users"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String, unique=True, index=True, nullable=False)
    nickname = Column(String, unique=True, nullable=False)
    password_hash = Column(String, nullable=False)
    
    # 💡 새롭게 추가된 프로필 필드
    bio = Column(Text, nullable=True)
    profile_image_url = Column(Text, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # 1:N 양방향 관계 설정 (유저가 삭제되면 작성한 글/댓글/좋아요도 삭제됨)
    posts = relationship("Post", back_populates="user", cascade="all, delete-orphan")
    likes = relationship("Like", back_populates="user", cascade="all, delete-orphan")
    comments = relationship("Comment", back_populates="user", cascade="all, delete-orphan")

    # 💡 팔로우/팔로잉 양방향 관계 설정
    # 내가 팔로우하는 사람들 (내가 follower_id인 경우)
    following = relationship(
        "Follow",
        foreign_keys=[Follow.follower_id],
        backref="follower_user",
        cascade="all, delete-orphan"
    )
    # 나를 팔로우하는 사람들 (내가 following_id인 경우)
    followers = relationship(
        "Follow",
        foreign_keys=[Follow.following_id],
        backref="following_user",
        cascade="all, delete-orphan"
    )

class Post(Base):
    __tablename__ = "posts"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    image_url = Column(Text, nullable=True) # 텍스트 전용 게시글을 위해 nullable=True 설정 권장
    location_id = Column(Integer, ForeignKey("locations.id", ondelete="SET NULL"))
    content = Column(Text)
    
    ai_status = Column(String, default="pending") 
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # 양방향 관계 설정 (게시글에서 유저, 위치, 태그, 좋아요, 댓글을 바로 가져올 수 있음)
    user = relationship("User", back_populates="posts")
    location = relationship("Location", back_populates="posts")
    tags = relationship("PostTag", back_populates="post", cascade="all, delete-orphan")
    likes = relationship("Like", back_populates="post", cascade="all, delete-orphan")
    comments = relationship("Comment", back_populates="post", cascade="all, delete-orphan")

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

    # DB 레벨의 제약 조건: 한 유저는 한 글에 한 번만 좋아요 가능
    __table_args__ = (UniqueConstraint('user_id', 'post_id', name='uix_user_post_like'),)

    # 양방향 관계
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

    # 관계 설정
    posts = relationship("Post", back_populates="location")

# ==========================================
# 💬 채팅방 모델 (1:1 DM)
# ==========================================
class ChatRoom(Base):
    __tablename__ = "chat_rooms"

    id = Column(Integer, primary_key=True, index=True)
    # 💡 Integer 대신 UUID로 변경, ondelete="CASCADE" 추가 (유저 탈퇴시 방도 삭제)
    user1_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    user2_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # 이 방에 속한 메시지들을 연결 (방이 삭제되면 메시지도 삭제)
    messages = relationship("Message", back_populates="room", cascade="all, delete-orphan")

# ==========================================
# 💬 메시지 모델
# ==========================================
class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    room_id = Column(Integer, ForeignKey("chat_rooms.id", ondelete="CASCADE"), nullable=False)
    # 💡 Integer 대신 UUID로 변경
    sender_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    content = Column(String, nullable=False)
    
    is_read = Column(Boolean, default=False) 
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    room = relationship("ChatRoom", back_populates="messages")
    sender = relationship("User")

    