from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from ..db import get_db
from ..models import ExpectedDocument, Document
from ..schemas import ExpectedCreate
from ..auth import current_user

router = APIRouter(prefix="/expected-documents", tags=["Missing Documents"])

@router.get("")
def list_expected(user=Depends(current_user), db=Depends(get_db)):
    expected = db.scalars(select(ExpectedDocument).order_by(ExpectedDocument.name)).all()
    names = {d.name.lower() for d in db.scalars(select(Document)).all()}
    return [{"id":x.id,"name":x.name,"category":x.category,"priority":x.priority,
             "due_date":x.due_date,"status":"Available" if x.name.lower() in names else "Missing"} for x in expected]

@router.post("", status_code=201)
def create_expected(payload:ExpectedCreate, user=Depends(current_user), db=Depends(get_db)):
    x=ExpectedDocument(**payload.model_dump()); db.add(x); db.commit(); db.refresh(x); return x

@router.post("/{expected_id}/upload")
def expected_upload(expected_id:int, user=Depends(current_user), db=Depends(get_db)):
    x=db.get(ExpectedDocument, expected_id)
    if not x: raise HTTPException(404, "Expected document not found")
    return {"message":"Upload the file through POST /api/v1/documents/upload.",
            "expected_document":{"id":x.id,"name":x.name,"category":x.category}}
