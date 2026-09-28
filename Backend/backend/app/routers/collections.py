from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from ..db import get_db
from ..models import Collection, Document
from ..schemas import CollectionCreate, CollectionOut
from ..auth import current_user

router = APIRouter(prefix="/collections", tags=["Collections"])

@router.get("")
def list_collections(user=Depends(current_user), db=Depends(get_db)):
    rows = db.execute(select(Collection, func.count(Document.id))
        .outerjoin(Document, Document.collection_id == Collection.id)
        .group_by(Collection.id).order_by(Collection.name)).all()
    return [{"id":c.id,"name":c.name,"description":c.description,"document_count":count} for c,count in rows]

@router.post("", response_model=CollectionOut, status_code=201)
def create_collection(payload: CollectionCreate, user=Depends(current_user), db=Depends(get_db)):
    if db.scalar(select(Collection).where(Collection.name == payload.name)):
        raise HTTPException(409, "Collection already exists")
    c = Collection(name=payload.name, description=payload.description)
    db.add(c); db.commit(); db.refresh(c)
    return c

@router.get("/{collection_id}")
def get_collection(collection_id:int, user=Depends(current_user), db=Depends(get_db)):
    c = db.get(Collection, collection_id)
    if not c: raise HTTPException(404, "Collection not found")
    docs = db.scalars(select(Document).where(Document.collection_id == collection_id)
                      .order_by(Document.updated_at.desc())).all()
    return {"id":c.id,"name":c.name,"description":c.description,
            "documents":[{"id":d.id,"name":d.name,"status":d.status,"category":d.category} for d in docs]}
