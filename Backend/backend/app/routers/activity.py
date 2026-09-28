from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from ..db import get_db
from ..models import Activity
from ..auth import current_user

router = APIRouter(prefix="/activity", tags=["Activity"])

@router.get("")
def activity(event_type=None, limit:int=Query(50,ge=1,le=200),
             user=Depends(current_user), db=Depends(get_db)):
    stmt=select(Activity).order_by(Activity.created_at.desc()).limit(limit)
    if event_type and event_type!="all": stmt=stmt.where(Activity.event_type==event_type)
    rows=db.scalars(stmt).all()
    return [{"id":a.id,"event_type":a.event_type,"message":a.message,"created_at":a.created_at} for a in rows]
