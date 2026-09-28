from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from ..db import get_db
from ..models import Document, Collection, Activity
from ..auth import current_user

router=APIRouter(prefix="/dashboard",tags=["Dashboard"])

@router.get("")
def dashboard(user=Depends(current_user),db=Depends(get_db)):
    docs=db.scalar(select(func.count(Document.id))) or 0
    collections=db.scalar(select(func.count(Collection.id))) or 0
    indexed=db.scalar(select(func.count(Document.id)).where(Document.status=="Indexed")) or 0
    recent=db.scalars(select(Document).order_by(Document.updated_at.desc()).limit(5)).all()
    return {"documents":docs,"collections":collections,
            "knowledge_coverage":round(indexed/docs*100) if docs else 0,
            "recent_searches":db.scalar(select(func.count(Activity.id)).where(Activity.event_type=="ai_question")) or 0,
            "recent_documents":[{"id":d.id,"name":d.name,"file_type":d.file_type,
                "status":d.status,"category":d.category,"updated_at":d.updated_at} for d in recent]}
