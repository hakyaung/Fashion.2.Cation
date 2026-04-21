# app/api/posts.py
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, status, Request
from sqlalchemy.orm import Session, joinedload 
from typing import List, Optional
import uuid
import os
import requests 
from pydantic import BaseModel
from sqlalchemy import func

from app.db.session import get_db
from app.api.deps import get_current_user
from app.models.models import Post, PostTag, User, Location, Like, Comment, Snap, SnapLike, SnapComment, SnapTag

from fastapi import BackgroundTasks  
from app.core.notifier import notifier
from app.core.fcm import send_fcm_notification

router = APIRouter()
UPLOAD_DIR = "uploads"

# ==========================================
# 💡 선택적 인증 유틸리티
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
# 1. 게시글 업로드 API & AI 자동 분석
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

        if image_url and os.path.exists(file_path):
            try:
                with open(file_path, "rb") as f:
                    ai_response = requests.post("http://localhost:8001/predict", files={"file": f})
                
                if ai_response.status_code == 200:
                    ai_data = ai_response.json()
                    
                    if ai_data.get("status") == "success":
                        new_post.ai_status = "completed" 
                        
                        ai_tags = [
                            ai_data.get("category"), 
                            ai_data.get("color"), 
                            ai_data.get("style")
                        ]
                        confidence = ai_data.get("confidence", 0.0)
                        
                        for tag_name in ai_tags:
                            if tag_name and tag_name != "unknown":
                                db_tag = PostTag(
                                    post_id=new_post.id, 
                                    tag_name=tag_name, 
                                    is_ai_generated=True,
                                    confidence_score=confidence
                                )
                                db.add(db_tag)
                    else:
                        new_post.ai_status = "failed"
                else:
                    new_post.ai_status = "failed"
            
            except Exception as e:
                print(f"🚨 AI 서버 통신 에러 발생: {e}")
                new_post.ai_status = "failed"

            db.commit()

        return {"status": "success", "post_id": new_post.id}

    except Exception as e:
        db.rollback()
        if image_url and os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(status_code=500, detail=str(e))

# ==========================================
# 2. 통합 피드 조회 API
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
        query = db.query(Post).options(
            joinedload(Post.user),
            joinedload(Post.location),
            joinedload(Post.likes),
            joinedload(Post.comments),
            joinedload(Post.tags)
        )

        if location_id is not None:
            query = query.filter(Post.location_id == location_id)
        if q and q.strip():
            query = query.filter(Post.content.ilike(f"%{q.strip()}%"))

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

        raw_posts = query.offset(skip).limit(limit).all()

        # 파이썬 레벨에서 안전하게 중복을 제거합니다! (순서 유지)
        posts = []
        seen_ids = set()
        for p in raw_posts:
            if p.id not in seen_ids:
                seen_ids.add(p.id)
                posts.append(p)

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
# 3. 좋아요 토글 & 강제 동기화
# ==========================================
@router.post("/{post_id}/like/ensure")
def ensure_like(post_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    existing = db.query(Like).filter(Like.post_id == post_id, Like.user_id == current_user.id).first()
    if existing:
        return {"status": "already_liked"}
    db.add(Like(post_id=post_id, user_id=current_user.id))
    db.commit()
    return {"status": "liked"}

@router.post("/{post_id}/like")
def toggle_like(post_id: str, background_tasks: BackgroundTasks, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    existing_like = db.query(Like).filter(Like.post_id == post_id, Like.user_id == current_user.id).first()
    if existing_like:
        db.delete(existing_like)
        db.commit()
        return {"status": "unliked"}
    else:
        new_like = Like(post_id=post_id, user_id=current_user.id)
        db.add(new_like)
        db.commit()

        post = db.query(Post).filter(Post.id == post_id).first()
        if post and post.user_id != current_user.id:
            target_user = db.query(User).filter(User.id == post.user_id).first()
            if target_user and target_user.fcm_token:
                background_tasks.add_task(
                    send_fcm_notification,
                    target_user.fcm_token,
                    "새로운 좋아요 ❤️",
                    f"{current_user.nickname}님이 회원님의 게시물을 좋아합니다."
                )
            
            background_tasks.add_task(
                notifier.push, str(post.user_id), "새로운 좋아요 ❤️", f"{current_user.nickname}님이 회원님의 게시물을 좋아합니다."
            )

        return {"status": "liked"}

# ==========================================
# 4. 댓글 작성 및 조회
# ==========================================
class CommentCreate(BaseModel):
    content: str

@router.post("/{post_id}/comments")
def add_comment(post_id: str, comment: CommentCreate, background_tasks: BackgroundTasks, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    new_comment = Comment(post_id=post_id, user_id=current_user.id, content=comment.content)
    db.add(new_comment)
    db.commit()

    post = db.query(Post).filter(Post.id == post_id).first()
    if post and post.user_id != current_user.id:
        target_user = db.query(User).filter(User.id == post.user_id).first()
        if target_user and target_user.fcm_token:
            background_tasks.add_task(
                send_fcm_notification,
                target_user.fcm_token,
                "새로운 댓글 💬",
                f"{current_user.nickname}님: {comment.content}"
            )

        background_tasks.add_task(
            notifier.push, str(post.user_id), "새로운 댓글 💬", f"{current_user.nickname}님: {comment.content}"
        )

    return {"status": "success"}

@router.get("/{post_id}/comments")
def get_comments(post_id: str, db: Session = Depends(get_db)):
    comments = db.query(Comment).options(joinedload(Comment.user)).filter(Comment.post_id == post_id).order_by(Comment.created_at.asc()).all()
    return [{
        "id": c.id,
        "user_id": str(c.user_id),
        "author": c.user.nickname if c.user else "탈퇴한 사용자",
        "content": c.content,
        "created_at": c.created_at.isoformat()
    } for c in comments]

# ==========================================
# 5. 댓글 수정 및 삭제
# ==========================================
def _comment_for_moderation(db: Session, post_id: str, comment_id: int, current_user: User) -> Comment:
    comment = db.query(Comment).filter(Comment.id == comment_id, Comment.post_id == post_id).first()
    if not comment:
        raise HTTPException(status_code=404, detail="댓글을 찾을 수 없습니다.")
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="게시물을 찾을 수 없습니다.")
    if comment.user_id != current_user.id and post.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="댓글을 수정하거나 삭제할 권한이 없습니다.")
    return comment

class CommentUpdateBody(BaseModel):
    content: str

@router.patch("/{post_id}/comments/{comment_id}")
def update_comment(
    post_id: str,
    comment_id: int,
    body: CommentUpdateBody,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    comment = _comment_for_moderation(db, post_id, comment_id, current_user)
    text = (body.content or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="댓글 내용을 입력해 주세요.")
    comment.content = text
    db.commit()
    return {"status": "success"}

@router.delete("/{post_id}/comments/{comment_id}")
def delete_comment(
    post_id: str,
    comment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    comment = _comment_for_moderation(db, post_id, comment_id, current_user)
    db.delete(comment)
    db.commit()
    return {"status": "success"}

# ==========================================
# 6. 게시물 수정 및 삭제
# ==========================================
class PostUpdate(BaseModel):
    content: str
    user_tags: Optional[str] = None

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

# ==========================================
# 🎬 7. 스냅(숏폼) 전용 API
# ==========================================
class SnapCreate(BaseModel):
    video_url: str
    content: Optional[str] = None
    location_id: Optional[int] = None
    tags: Optional[str] = None

@router.post("/snaps")
def create_snap(snap_in: SnapCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    new_snap = Snap(
        user_id=current_user.id, 
        video_url=snap_in.video_url,
        content=snap_in.content,
        location_id=snap_in.location_id
    )
    db.add(new_snap)
    db.flush()

    if snap_in.tags:
        tag_list = list(set([t.strip() for t in snap_in.tags.split(",") if t.strip()]))
        for t_name in tag_list:
            db.add(SnapTag(snap_id=new_snap.id, tag_name=t_name))
            
    db.commit()
    return {"message": "스냅 DB 저장 성공"}

@router.get("/snaps")
def get_snaps(db: Session = Depends(get_db), current_user: Optional[User] = Depends(get_current_user_optional)):
    raw_snaps = db.query(Snap).options(
        joinedload(Snap.user),
        joinedload(Snap.location),
        joinedload(Snap.tags),
        joinedload(Snap.likes),
        joinedload(Snap.comments)
    ).order_by(Snap.created_at.desc()).limit(10).all()

    # 파이썬 레벨에서 안전하게 스냅 중복 제거!
    snaps = []
    seen_snaps = set()
    for s in raw_snaps:
        if s.id not in seen_snaps:
            seen_snaps.add(s.id)
            snaps.append(s)

    results = []
    for s in snaps:
        is_liked = False
        if current_user:
            is_liked = any(like.user_id == current_user.id for like in s.likes)

        results.append({
            "id": str(s.id),
            "user_id": str(s.user_id),
            "video_url": s.video_url,
            "content": s.content,
            "author": s.user.nickname if s.user else "탈퇴한 사용자",
            "author_profile_image": s.user.profile_image_url if s.user else None,
            "location_name": s.location.full_name if s.location else "위치 정보 없음",
            "created_at": s.created_at.isoformat() if s.created_at else None,
            "is_liked": is_liked,
            "like_count": len(s.likes),
            "comment_count": len(s.comments),
            "tags": [tag.tag_name for tag in s.tags]
        })
    return results

@router.post("/snaps/{snap_id}/like")
def toggle_snap_like(snap_id: str, background_tasks: BackgroundTasks, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    existing_like = db.query(SnapLike).filter(SnapLike.snap_id == snap_id, SnapLike.user_id == current_user.id).first()
    if existing_like:
        db.delete(existing_like)
        db.commit()
        return {"status": "unliked"}
    else:
        db.add(SnapLike(snap_id=snap_id, user_id=current_user.id))
        db.commit()
        return {"status": "liked"}

@router.post("/snaps/{snap_id}/comments")
def add_snap_comment(snap_id: str, comment: CommentCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    new_comment = SnapComment(snap_id=snap_id, user_id=current_user.id, content=comment.content)
    db.add(new_comment)
    db.commit()
    return {"status": "success"}

@router.get("/snaps/{snap_id}/comments")
def get_snap_comments(snap_id: str, db: Session = Depends(get_db)):
    comments = db.query(SnapComment).options(joinedload(SnapComment.user)).filter(SnapComment.snap_id == snap_id).order_by(SnapComment.created_at.asc()).all()
    return [{
        "id": c.id,
        "user_id": str(c.user_id),
        "author": c.user.nickname if c.user else "알 수 없음",
        "content": c.content,
        "created_at": c.created_at.isoformat()
    } for c in comments]

# ==========================================
# 💡 [추가] 스냅 댓글 수정 및 삭제 전용 로직
# ==========================================
def _snap_comment_for_moderation(db: Session, snap_id: str, comment_id: int, current_user: User) -> SnapComment:
    comment = db.query(SnapComment).filter(SnapComment.id == comment_id, SnapComment.snap_id == snap_id).first()
    if not comment:
        raise HTTPException(status_code=404, detail="스냅 댓글을 찾을 수 없습니다.")
    
    snap = db.query(Snap).filter(Snap.id == snap_id).first()
    if not snap:
        raise HTTPException(status_code=404, detail="해당 스냅을 찾을 수 없습니다.")
    
    # 본인이 쓴 댓글이거나, 이 스냅 영상의 주인일 때만 수정/삭제 권한 부여
    if comment.user_id != current_user.id and snap.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="댓글을 수정하거나 삭제할 권한이 없습니다.")
    
    return comment

@router.patch("/snaps/{snap_id}/comments/{comment_id}")
def update_snap_comment(
    snap_id: str,
    comment_id: int,
    body: CommentUpdateBody, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    comment = _snap_comment_for_moderation(db, snap_id, comment_id, current_user)
    text = (body.content or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="댓글 내용을 입력해 주세요.")
    
    comment.content = text
    db.commit()
    return {"status": "success"}

@router.delete("/snaps/{snap_id}/comments/{comment_id}")
def delete_snap_comment(
    snap_id: str,
    comment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    comment = _snap_comment_for_moderation(db, snap_id, comment_id, current_user)
    db.delete(comment)
    db.commit()
    return {"status": "success"}

@router.put("/snaps/{snap_id}")
def update_snap(
    snap_id: str, 
    snap_data: PostUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    snap = db.query(Snap).filter(Snap.id == snap_id).first()
    if not snap or snap.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="권한이 없습니다.")
    
    snap.content = snap_data.content
    db.query(SnapTag).filter(SnapTag.snap_id == snap.id).delete()
    if snap_data.user_tags:
        tags = [t.strip() for t in snap_data.user_tags.split(",") if t.strip()]
        for tag in tags:
            db.add(SnapTag(snap_id=snap.id, tag_name=tag))
            
    db.commit()
    return {"status": "success"}

@router.delete("/snaps/{snap_id}")
def delete_snap(snap_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    snap = db.query(Snap).filter(Snap.id == snap_id).first()
    if not snap or snap.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="권한이 없습니다.")
    db.delete(snap)
    db.commit()
    return {"status": "success"}