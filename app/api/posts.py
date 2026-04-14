from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, status, Request
from sqlalchemy.orm import Session, joinedload 
from typing import List, Optional
import uuid
import os
from pydantic import BaseModel
from sqlalchemy import func

from app.db.session import get_db
from app.models.models import Post, PostTag, User, Location, Like, Comment
from app.services.ai_gateway import send_to_ai_worker
from app.api.deps import get_current_user

from pydantic import BaseModel
from fastapi import HTTPException

router = APIRouter()
UPLOAD_DIR = "uploads"

# ==========================================
# 💡 선택적 인증 유틸리티 (비로그인 유저도 피드 조회를 위해)
# ==========================================
def get_current_user_optional(request: Request, db: Session = Depends(get_db)):
    auth_header = request.headers.get("Authorization")
    if not auth_header:
        return None
    try:
        token = auth_header.split(" ")[1]
        user = get_current_user(db=db, token=token)
        return user
    except Exception as e:
        print(f"선택적 인증 처리 중 알림 (비로그인): {e}")
        return None

# ==========================================
# 1. 게시글 업로드 API
# ==========================================
@router.post("/upload", status_code=status.HTTP_201_CREATED)
async def create_fashion_post(
    content: str = Form(...),
    location_id: int = Form(...),
    user_tags: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None), 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    image_url = ""
    file_path = ""
    
    if file:
        file_extension = file.filename.split(".")[-1].lower()
        if file_extension not in ["jpg", "jpeg", "png"]:
            raise HTTPException(status_code=400, detail="이미지만 업로드 가능합니다.")

        file_name = f"{uuid.uuid4()}.{file_extension}"
        file_path = os.path.join(UPLOAD_DIR, file_name)

        with open(file_path, "wb") as buffer:
            buffer.write(await file.read())

        image_url = f"/static/{file_name}"

    try:
        new_post = Post(
            user_id=current_user.id,
            image_url=image_url,
            content=content,
            location_id=location_id,
            ai_status="pending" if image_url else "text_only"
        )
        db.add(new_post)
        db.flush()

        if user_tags:
            tag_list = list(set([t.strip() for t in user_tags.split(",") if t.strip()]))
            for t_name in tag_list:
                db_tag = PostTag(post_id=new_post.id, tag_name=t_name, is_ai_generated=False)
                db.add(db_tag)

        db.commit()

        if image_url:
            send_to_ai_worker(str(new_post.id), image_url)

        return {"status": "success", "post_id": new_post.id}

    except Exception as e:
        db.rollback()
        if image_url and os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(status_code=500, detail=str(e))

# ==========================================
# 2. 통합 피드 조회 API (검색, 정렬, 거리순 필터 포함)
# ==========================================
@router.get("/")
def get_fashion_feed(
    location_id: Optional[int] = None,
    q: Optional[str] = None,
    sort_by: str = "latest",
    lat: Optional[float] = None, 
    lng: Optional[float] = None, 
    skip: int = 0,
    limit: int = 10,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional) 
):
    try:
        # 1. 기본 쿼리 및 관계 로드
        query = db.query(Post).options(
            joinedload(Post.user),
            joinedload(Post.location),
            joinedload(Post.likes),
            joinedload(Post.comments),
            joinedload(Post.tags)
        )

        # 2. 필터링 (검색 및 지역 필터)
        if location_id is not None:
            query = query.filter(Post.location_id == location_id)
        if q and q.strip():
            query = query.filter(Post.content.ilike(f"%{q.strip()}%"))

        # 3. 정렬 로직 (핵심 수정 부분)
        if sort_by == "popular":
            query = query.outerjoin(Like).group_by(Post.id).order_by(
                func.count(Like.id).desc(), 
                Post.created_at.desc()
            )
        elif sort_by == "nearby" and lat is not None and lng is not None:
            distance_expr = func.sqrt(
                func.power(Location.latitude - lat, 2) + 
                func.power(Location.longitude - lng, 2)
            )
            query = query.outerjoin(Location).order_by(
                distance_expr.asc().nulls_last(), 
                Post.created_at.desc()
            )
        else:
            query = query.order_by(Post.created_at.desc())

        posts = query.offset(skip).limit(limit).all()

        # 4. 결과 가공 (기존 로직 유지)
        results = []
        for post in posts:
            is_liked = False
            if current_user:
                is_liked = any(like.user_id == current_user.id for like in post.likes)

            results.append({
                "id": str(post.id),
                "user_id": str(post.user_id),
                "content": post.content,
                "image_url": post.image_url,
                "author": post.user.nickname if post.user else "탈퇴한 사용자",
                # 💡 [핵심 추가] 프론트엔드가 프로필 사진을 띄울 수 있도록 주소를 함께 넘겨줍니다!
                "author_profile_image": post.user.profile_image_url if post.user else None,
                "location": post.location.full_name if post.location else "지역 정보 없음",
                "created_at": post.created_at.isoformat() if post.created_at else None,
                "ai_status": post.ai_status,
                "is_liked": is_liked,
                "like_count": len(post.likes),
                "comment_count": len(post.comments),
                "tags": [f"#{tag.tag_name}" for tag in post.tags]
            })
        
        return results

    except Exception as e:
        import traceback
        print(f"피드 조회 에러 상세: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"서버 에러: {str(e)}")

# ==========================================
# 3. 좋아요 토글
# ==========================================
@router.post("/{post_id}/like")
def toggle_like(post_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    existing_like = db.query(Like).filter(Like.post_id == post_id, Like.user_id == current_user.id).first()
    if existing_like:
        db.delete(existing_like)
        db.commit()
        return {"status": "unliked"}
    else:
        new_like = Like(post_id=post_id, user_id=current_user.id)
        db.add(new_like)
        db.commit()
        return {"status": "liked"}

# ==========================================
# 4. 댓글 작성
# ==========================================
class CommentCreate(BaseModel):
    content: str

@router.post("/{post_id}/comments")
def add_comment(post_id: str, comment: CommentCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    new_comment = Comment(post_id=post_id, user_id=current_user.id, content=comment.content)
    db.add(new_comment)
    db.commit()
    return {"status": "success"}

# ==========================================
# 5. 댓글 조회
# ==========================================
@router.get("/{post_id}/comments")
def get_comments(post_id: str, db: Session = Depends(get_db)):
    comments = db.query(Comment).options(joinedload(Comment.user)).filter(Comment.post_id == post_id).order_by(Comment.created_at.asc()).all()
    return [{
        "id": c.id,
        "author": c.user.nickname if c.user else "탈퇴한 사용자",
        "content": c.content,
        "created_at": c.created_at.isoformat()
    } for c in comments]

class PostUpdate(BaseModel):
    content: str
    user_tags: Optional[str] = None

# ==========================================
# 🗑️ 1. 게시물 삭제 API (DELETE)
# ==========================================
@router.delete("/{post_id}")
def delete_post(
    post_id: str, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user) 
):
    post = db.query(Post).filter(Post.id == post_id).first()
    
    if not post:
        raise HTTPException(status_code=404, detail="게시물을 찾을 수 없습니다.")
    
    if post.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="본인이 작성한 글만 삭제할 수 있습니다.")
    
    db.delete(post)
    db.commit()
    
    return {"status": "success", "message": "게시물이 삭제되었습니다."}

# ==========================================
# ✍️ 2. 게시물 수정 API (PUT)
# ==========================================
@router.put("/{post_id}")
def update_post(
    post_id: str, 
    post_data: PostUpdate, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user) 
):
    post = db.query(Post).filter(Post.id == post_id).first()
    
    if not post:
        raise HTTPException(status_code=404, detail="게시물을 찾을 수 없습니다.")
    
    if post.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="본인이 작성한 글만 수정할 수 있습니다.")
    
    post.content = post_data.content
    
    if post_data.user_tags is not None:
        db.query(PostTag).filter(PostTag.post_id == post.id).delete()
        if post_data.user_tags.strip():
            tags = [t.strip() for t in post_data.user_tags.split(",") if t.strip()]
            for tag in tags:
                new_tag = PostTag(post_id=post.id, tag_name=tag, is_ai_generated=False)
                db.add(new_tag)
                
    db.commit()
    return {"status": "success", "message": "게시물 및 태그가 수정되었습니다."}