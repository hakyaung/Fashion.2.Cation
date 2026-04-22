# app/api/posts.py
import os
import uuid
from typing import List, Optional

import requests
from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, Query, Request, UploadFile, status
from pydantic import BaseModel
from sqlalchemy import case, func, text, or_
from sqlalchemy.orm import Session, joinedload

# --- 프로젝트 내부 모듈 ---
from app.api.deps import get_current_user
from app.core.fcm import send_fcm_notification
from app.core.notifier import notifier
from app.db.session import get_db
from app.schemas import UserPreferenceUpdate

# 모델 임포트 (길어서 괄호로 묶어 가독성 향상)
from app.models.models import (
    Comment, 
    Like, 
    Location, 
    Post, 
    PostTag, 
    Product, 
    Snap, 
    SnapComment, 
    SnapLike, 
    SnapTag, 
    User, 
    UserPreference
)

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

TAG_FIELDS = ["category", "class_label", "color", "style"]

TAG_FIELDS = ["category", "class_label", "color", "style"]

def format_tag(tag_name: str) -> str:
    return tag_name.split(":", 1)[-1] if ":" in tag_name else tag_name


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

                        for detection in ai_data.get("detections", []):
                            confidence = detection.get("confidence", 0.0)

                            for field in TAG_FIELDS:
                                value = detection.get(field)
                                if value and value != "unknown":
                                    tag_name = f"{field}:{value}"
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
# 2. 통합 피드 조회 API (초개인화 추천 알고리즘 탑재)
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
        # 1. 기본 쿼리 및 연관 데이터 미리 불러오기 (성능 최적화)
        query = db.query(Post).options(
            joinedload(Post.user),
            joinedload(Post.location),
            joinedload(Post.likes),
            joinedload(Post.comments),
            joinedload(Post.tags)
        )

        # 2. 검색 및 지역 필터링
        if location_id is not None:
            query = query.filter(Post.location_id == location_id)
        if q and q.strip():
            query = query.filter(Post.content.ilike(f"%{q.strip()}%"))

        # 3. 정렬 로직 분기
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
            
        # 🚀 [핵심 알고리즘] AI 맞춤 추천 정렬
        elif sort_by == "recommend":
            if current_user:
                pref = db.query(UserPreference).filter(UserPreference.user_id == current_user.id).first()
                pref_tags = []
                is_male_preferred = False
                is_female_preferred = False
                
                # 영문 태그 번역기 (AI가 달아주는 태그와 매칭)
                STYLE_MAPPING = {
                    "미니멀": "minimal", "스트릿": "street", "캐주얼": "casual",
                    "빈티지": "vintage", "스포티": "sporty", "프레피": "preppy"
                }
                
                if pref:
                    if pref.preferred_styles:
                        for s in pref.preferred_styles.split(','):
                            s = s.strip()
                            pref_tags.append(s)
                            if s in STYLE_MAPPING:
                                pref_tags.append(STYLE_MAPPING[s]) 
                                
                    if pref.preferred_categories:
                        for c in pref.preferred_categories.split(','):
                            c = c.strip()
                            pref_tags.append(c)
                            # 유저의 성별 선호도 파악
                            if '남성' in c: is_male_preferred = True
                            if '여성' in c: is_female_preferred = True
                
                if pref_tags:
                    # 동적 채점 규칙(Rules) 생성
                    scoring_rules = [
                        # 규칙 1: 내 취향 태그(스타일/카테고리)와 일치하면 100점 추가
                        (PostTag.tag_name.in_(pref_tags), 100)
                    ]
                    
                    # 규칙 2: 성별 페널티 (남성옷을 찾는데 여성옷이 나오면 -500점 감점)
                    if is_male_preferred and not is_female_preferred:
                        scoring_rules.append((PostTag.tag_name.ilike('%여성%'), -500))
                    elif is_female_preferred and not is_male_preferred:
                        scoring_rules.append((PostTag.tag_name.ilike('%남성%'), -500))

                    # 게시물별 총점 계산 서브쿼리
                    score_subq = db.query(
                        PostTag.post_id,
                        func.sum(case(*scoring_rules, else_=0)).label('score')
                    ).group_by(PostTag.post_id).subquery()

                    # 점수 순으로 피드 정렬 (점수가 없으면 맨 뒤로)
                    query = query.outerjoin(score_subq, Post.id == score_subq.c.post_id)\
                                 .order_by(score_subq.c.score.desc().nulls_last(), Post.created_at.desc())
                else:
                    # 취향 정보가 빈 문자열이면 랜덤
                    query = query.order_by(func.random())
            else:
                # 비로그인 유저면 랜덤
                query = query.order_by(func.random())
                
        elif sort_by == "random":
            query = query.order_by(func.random())
        else:
            # 기본값 (최신순)
            query = query.order_by(Post.created_at.desc())

        # 4. 데이터베이스 쿼리 실행
        raw_posts = query.offset(skip).limit(limit).all()

        # 5. 파이썬 레벨에서 안전하게 중복 제거 (정렬 순서 유지)
        posts = []
        seen_ids = set()
        for p in raw_posts:
            if p.id not in seen_ids:
                seen_ids.add(p.id)
                posts.append(p)

        # 6. 프론트엔드 규격에 맞게 데이터 포장
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
                # ✅ prefix 제거 후 출력 (DB: "color:black" → 출력: "#black")
                "tags": [f"#{format_tag(tag.tag_name)}" for tag in post.tags]
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
        # 1. 좋아요 DB에 저장
        new_like = Like(post_id=post_id, user_id=current_user.id)
        db.add(new_like)
        db.commit() # 💡 유저의 좋아요는 즉시 반영시켜서 체감 속도를 높입니다.

        # 💡 2. [수정된 로직] 닌자 알고리즘: 태그별 좋아요 5회 누적 시 취향 자동 반영
        try:
            post_tags = db.query(PostTag).filter(PostTag.post_id == post_id).all()
            
            if post_tags:
                for t in post_tags:
                    target_tag = t.tag_name
                    
                    # 이 유저가 '해당 태그'가 포함된 게시물에 좋아요를 몇 번 눌렀는지 DB에서 계산
                    liked_tag_count = db.query(Like).join(
                        PostTag, Like.post_id == PostTag.post_id
                    ).filter(
                        Like.user_id == current_user.id, 
                        PostTag.tag_name == target_tag
                    ).count()
                    
                    # 🎯 마의 5번(Threshold) 돌파 시! (정확히 5번째일 때만 실행)
                    if liked_tag_count == 5:
                        user_pref = db.query(UserPreference).filter(UserPreference.user_id == current_user.id).first()
                        
                        if user_pref:
                            current_styles = user_pref.preferred_styles or ""
                            # 이미 취향 목록에 있는 태그라면 무시, 없다면 슬쩍 추가
                            if target_tag not in current_styles:
                                new_styles = f"{current_styles},{target_tag}" if current_styles else target_tag
                                user_pref.preferred_styles = new_styles
                                db.commit()
                                print(f"🤖 [AI 알고리즘] {current_user.nickname}님이 '{target_tag}' 태그에 5번 반응했습니다. 취향 자동 추가!")
                        else:
                            # 온보딩을 건너뛰어서 취향 테이블이 아예 없는 유저라면 새로 생성해 줍니다!
                            new_pref = UserPreference(
                                user_id=current_user.id,
                                preferred_styles=target_tag
                            )
                            db.add(new_pref)
                            db.commit()
                            print(f"🤖 [AI 알고리즘] {current_user.nickname}님 취향 테이블 생성 및 '{target_tag}' 자동 추가!")
                            
        except Exception as e:
            # 🚨 취향 분석하다 에러가 나도, 앱이 터지지 않도록 예외 처리
            print(f"🚨 무의식 취향 수집 중 에러 발생 (무시됨): {e}")

        # 3. 기존 알림 전송 기능 (완벽하게 유지됨)
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
# 💡 스냅 댓글 수정 및 삭제 전용 로직
# ==========================================
def _snap_comment_for_moderation(db: Session, snap_id: str, comment_id: int, current_user: User) -> SnapComment:
    comment = db.query(SnapComment).filter(SnapComment.id == comment_id, SnapComment.snap_id == snap_id).first()
    if not comment:
        raise HTTPException(status_code=404, detail="스냅 댓글을 찾을 수 없습니다.")
    
    snap = db.query(Snap).filter(Snap.id == snap_id).first()
    if not snap:
        raise HTTPException(status_code=404, detail="해당 스냅을 찾을 수 없습니다.")
    
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

# ==========================================
# 🤖 8. AI 추천 피드 (동적 정렬 바구니 적용 - 에러 원천차단)
# ==========================================
@router.get("/recommendations/feed")
def get_recommended_feed(
    page: int = Query(1, ge=1),
    size: int = Query(10, ge=1),
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    offset = (page - 1) * size
    query = db.query(Product)

    if current_user:
        pref = db.query(UserPreference).filter(UserPreference.user_id == current_user.id).first()
        
        if pref:
            categories_str = pref.preferred_categories or ""
            styles_str = pref.preferred_styles or ""
            category_list = [c.strip() for c in categories_str.split(',') if c.strip()]
            style_list = [s.strip() for s in styles_str.split(',') if s.strip()]

            is_male = any('남성' in c for c in category_list)
            is_female = any('여성' in c for c in category_list)

            # 🚀 [해결책] 정렬 조건을 담을 빈 바구니(List) 준비
            order_clauses = []

            # 1. 성별 점수 (선택한 경우에만 바구니에 담기)
            if is_male and not is_female:
                gender_cond = or_(
                    Product.gender.ilike('%남성%'), Product.gender.ilike('M%'),
                    Product.category.ilike('%남성%'), Product.class_label.ilike('%남성%')
                )
                order_clauses.append(case((gender_cond, 10000), else_=0).desc())
            elif is_female and not is_male:
                gender_cond = or_(
                    Product.gender.ilike('%여성%'), Product.gender.ilike('F%'),
                    Product.category.ilike('%여성%'), Product.class_label.ilike('%여성%')
                )
                order_clauses.append(case((gender_cond, 10000), else_=0).desc())

            # 2. 카테고리 점수 (선택한 경우에만 바구니에 담기)
            if category_list:
                cat_cond = or_(
                    *(Product.category.ilike(f"%{c}%") for c in category_list),
                    *(Product.class_label.ilike(f"%{c}%") for c in category_list)
                )
                order_clauses.append(case((cat_cond, 5000), else_=0).desc())

            # 3. 스타일 점수 (선택한 경우에만 바구니에 담기)
            STYLE_MAPPING = {"미니멀": "minimal", "스트릿": "street", "캐주얼": "casual", "빈티지": "vintage", "스포티": "sporty", "프레피": "preppy"}
            mapped_styles = []
            for s in style_list:
                mapped_styles.append(s)
                if s in STYLE_MAPPING:
                    mapped_styles.append(STYLE_MAPPING[s])
            
            if mapped_styles:
                style_cond = or_(*(Product.style.ilike(f"%{s}%") for s in mapped_styles))
                order_clauses.append(case((style_cond, 1000), else_=0).desc())

            # 4. 마지막으로 기본 인기도와 최신순을 바구니 맨 밑에 깔아두기
            base_pop_score = func.coalesce(Product.heart_count, 0) * 0.01
            order_clauses.append(base_pop_score.desc())
            order_clauses.append(Product.created_at.desc())

            # 🚀 바구니에 담긴 조건들을 한 번에 풀어서 정렬 적용 (* 사용)
            query = query.order_by(*order_clauses)
        else:
            # 취향이 없는 유저
            query = query.order_by(Product.heart_count.desc())
    else:
        # 비로그인 유저
        query = query.order_by(Product.heart_count.desc())

    # 데이터 추출 (Limit & Offset)
    products = query.offset(offset).limit(size).all()
    
    # 프론트엔드로 내보내기
    return [{
        "id": p.id, "filename": p.filename, "brand": p.brand, "product_name": p.product_name,
        "class_label": p.class_label, "gender": p.gender, "category": p.category,
        "color": p.color, "style": p.style, "price": p.price,
        "review_count": p.review_count, "heart_count": p.heart_count,
        "image_url": p.image_url, "created_at": p.created_at.isoformat() if p.created_at else None
    } for p in products]