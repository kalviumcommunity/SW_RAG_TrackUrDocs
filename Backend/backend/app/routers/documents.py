"""
Document Upload & Indexing Endpoint (LU 3.45)
Document Loading & Multi-Format Intake (LU 3.19)
"""

import hashlib
import logging
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, BackgroundTasks, Query
from fastapi.responses import FileResponse
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from ..config import settings
from ..db import get_db, SessionLocal
from ..models import User, Document, Collection, Chunk, Citation, Activity
from ..schemas import DocumentOut, DocumentDetail
from ..auth import current_user
from ..ingestion import index_document

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/documents", tags=["Documents"])

ALLOWED_EXTENSIONS = {"pdf", "docx", "txt", "md", "xlsx", "pptx"}
ALLOWED_MIME_TYPES = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "text/plain",
    "text/markdown",
    "application/octet-stream",  # browsers sometimes send this
}


def _checksum(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


def as_doc(db, doc) -> DocumentOut:
    owner = db.get(User, doc.uploaded_by_id)
    return DocumentOut(
        id=doc.id,
        name=doc.name,
        file_type=doc.file_type,
        size_bytes=doc.size_bytes,
        category=doc.category,
        collection_id=doc.collection_id,
        status=doc.status,
        uploaded_by=owner.name if owner else "Unknown",
        uploaded_at=doc.uploaded_at,
        updated_at=doc.updated_at,
    )


def run_index(document_id: int, storage_path: str) -> None:
    """Background task: index a document and update its status."""
    db = SessionLocal()
    try:
        doc = db.get(Document, document_id)
        if not doc:
            return
        try:
            index_document(db, doc, Path(storage_path))
        except Exception as exc:
            logger.error("Indexing failed for document %d: %s", document_id, exc)
            doc.status = "Failed"
            doc.error_message = str(exc)[:500]
            db.add(Activity(
                user_id=doc.uploaded_by_id,
                event_type="document_index_failed",
                message=f"Indexing failed: {doc.name} — {exc}",
            ))
            db.commit()
    finally:
        db.close()


@router.post(
    "/upload",
    response_model=DocumentOut,
    status_code=201,
    summary="Upload a document",
    description=(
        "Upload a document (PDF, DOCX, XLSX, PPTX, TXT, MD). "
        "The file is validated, stored, and queued for background indexing."
    ),
)
async def upload_document(
    background: BackgroundTasks,
    file: UploadFile = File(...),
    collection_id: int | None = Form(None),
    category: str = Form("Other"),
    description: str | None = Form(None),
    user=Depends(current_user),
    db: Session = Depends(get_db),
):
    # Validate extension
    ext = Path(file.filename or "").suffix.lower().lstrip(".")
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            415,
            f"Unsupported file type '{ext}'. Supported: {', '.join(sorted(ALLOWED_EXTENSIONS)).upper()}",
        )

    # Validate collection exists
    if collection_id and not db.get(Collection, collection_id):
        raise HTTPException(404, "Collection not found")

    # Read content
    content = await file.read()

    # Validate size
    max_bytes = settings.max_upload_mb * 1024 * 1024
    if len(content) > max_bytes:
        raise HTTPException(413, f"File exceeds the {settings.max_upload_mb} MB limit")

    # Validate not empty
    if len(content) == 0:
        raise HTTPException(400, "Uploaded file is empty")

    # Duplicate check via checksum
    checksum = _checksum(content)
    existing = db.scalars(
        select(Document).where(Document.checksum == checksum)
    ).first()
    if existing:
        raise HTTPException(
            409,
            f"This file has already been uploaded as '{existing.name}' (status: {existing.status})",
        )

    # Store file safely with UUID name
    storage = Path(settings.storage_dir)
    storage.mkdir(parents=True, exist_ok=True)
    stored_name = f"{uuid4().hex}.{ext}"
    path = storage / stored_name
    path.write_bytes(content)

    # Create document record
    doc = Document(
        name=file.filename or stored_name,
        stored_name=stored_name,
        file_type=ext,
        mime_type=file.content_type or "application/octet-stream",
        size_bytes=len(content),
        uploaded_by_id=user.id,
        collection_id=collection_id,
        category=category,
        description=description,
        checksum=checksum,
        status="Processing",
    )
    db.add(doc)
    db.add(Activity(
        user_id=user.id,
        event_type="document_uploaded",
        message=f"Document uploaded: {doc.name}",
    ))
    db.commit()
    db.refresh(doc)

    # Queue background indexing
    background.add_task(run_index, doc.id, str(path))

    return as_doc(db, doc)


@router.get(
    "",
    response_model=list[DocumentOut],
    summary="List documents",
)
def list_documents(
    search: str | None = Query(None),
    file_type: str | None = Query(None),
    status: str | None = Query(None),
    category: str | None = Query(None),
    collection_id: int | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    user=Depends(current_user),
    db: Session = Depends(get_db),
):
    stmt = select(Document).order_by(Document.updated_at.desc())
    if search:
        stmt = stmt.where(Document.name.ilike(f"%{search}%"))
    if file_type:
        stmt = stmt.where(Document.file_type == file_type.lower())
    if status:
        stmt = stmt.where(Document.status == status)
    if category:
        stmt = stmt.where(Document.category == category)
    if collection_id:
        stmt = stmt.where(Document.collection_id == collection_id)
    stmt = stmt.offset(skip).limit(limit)
    return [as_doc(db, d) for d in db.scalars(stmt).all()]


@router.get(
    "/{document_id}",
    response_model=DocumentDetail,
    summary="Get document details",
)
def get_document(
    document_id: int,
    user=Depends(current_user),
    db: Session = Depends(get_db),
):
    doc = db.get(Document, document_id)
    if not doc:
        raise HTTPException(404, "Document not found")
    usage = db.scalar(
        select(func.count(Citation.id)).where(Citation.document_id == document_id)
    ) or 0
    base = as_doc(db, doc).model_dump()
    return DocumentDetail(
        **base,
        mime_type=doc.mime_type,
        description=doc.description,
        error_message=doc.error_message,
        usage_count=usage,
        indexed_at=doc.indexed_at,
    )


@router.get(
    "/{document_id}/download",
    summary="Download / open document",
)
def download(
    document_id: int,
    user=Depends(current_user),
    db: Session = Depends(get_db),
):
    doc = db.get(Document, document_id)
    if not doc:
        raise HTTPException(404, "Document not found")
    path = Path(settings.storage_dir) / doc.stored_name
    if not path.exists():
        raise HTTPException(404, "Stored file not found. It may have been deleted.")
    return FileResponse(path, media_type=doc.mime_type, filename=doc.name)


@router.post(
    "/{document_id}/reindex",
    summary="Re-index a document",
)
def reindex(
    document_id: int,
    background: BackgroundTasks,
    user=Depends(current_user),
    db: Session = Depends(get_db),
):
    doc = db.get(Document, document_id)
    if not doc:
        raise HTTPException(404, "Document not found")
    path = Path(settings.storage_dir) / doc.stored_name
    if not path.exists():
        raise HTTPException(404, "Stored file not found")
    doc.status = "Processing"
    doc.error_message = None
    db.add(Activity(
        user_id=user.id,
        event_type="document_reindexed",
        message=f"Re-indexing started: {doc.name}",
    ))
    db.commit()
    background.add_task(run_index, doc.id, str(path))
    return {"message": "Re-indexing started", "document_id": document_id}


@router.delete(
    "/{document_id}",
    summary="Delete a document",
)
def delete_document(
    document_id: int,
    user=Depends(current_user),
    db: Session = Depends(get_db),
):
    doc = db.get(Document, document_id)
    if not doc:
        raise HTTPException(404, "Document not found")

    # Delete physical file
    path = Path(settings.storage_dir) / doc.stored_name
    if path.exists():
        path.unlink()

    name = doc.name
    db.delete(doc)
    db.add(Activity(
        user_id=user.id,
        event_type="document_deleted",
        message=f"Document deleted: {name}",
    ))
    db.commit()
    return {"message": "Document deleted", "name": name}
