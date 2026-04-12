from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.db.session import get_db
from app.models.models import Location

# 💡 핵심 수정: main.py에서 이미 prefix를 붙여주므로 여기서는 빈 괄호로 두어야 합니다!
router = APIRouter()

@router.get("/search")
def search_locations(q: str, db: Session = Depends(get_db)):
    """
    유저가 입력한 검색어(q)가 full_name에 포함된 지역을 최대 10개 반환합니다.
    """
    try:
        # 검색어가 없으면 빈 리스트 반환
        if not q or not q.strip():
            return []
        
        # ilike를 사용하여 대소문자 구분 없이 검색 (PostgreSQL 기준)
        search_keyword = f"%{q.strip()}%"
        locations = db.query(Location).filter(Location.full_name.ilike(search_keyword)).limit(10).all()
        
        return [{"id": loc.id, "full_name": loc.full_name} for loc in locations]
        
    except Exception as e:
        # 에러 발생 시 서버가 죽지 않고 터미널에 원인을 남기도록 처리
        print(f"지역 검색 API 내부 오류: {e}")
        raise HTTPException(status_code=500, detail="지역 검색 중 서버 오류가 발생했습니다.")
