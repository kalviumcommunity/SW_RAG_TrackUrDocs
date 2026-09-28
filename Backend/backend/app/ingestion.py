"""
Corpus Preparation & Ingestion Validation
Batch Embedding & Rate/Cost Management
Indexing Embeddings & Metadata Storage
"""

import hashlib
from pathlib import Path

from .config import settings
from .document_parser import extract_file, chunk_pages
from .embeddings import embed, serialize
from .models import Chunk, Activity, Document
from .models import utcnow


def compute_checksum(content: bytes) -> str:
    """SHA-256 checksum for duplicate detection."""
    return hashlib.sha256(content).hexdigest()


def index_document(db, document: Document, storage_path: Path) -> None:
    """
    Full ingestion pipeline:
      1. Parse → extract pages
      2. Chunk → overlapping text windows
      3. Embed → sentence-transformer vectors (batched)
      4. Store → update Chunk rows + document status

    Uses config-driven CHUNK_SIZE and CHUNK_OVERLAP.
    """
    pages = extract_file(storage_path, document.file_type)
    chunks = chunk_pages(
        pages,
        size=settings.chunk_size,
        overlap=settings.chunk_overlap,
    )
    if not chunks:
        raise ValueError("No readable text was found in the document.")

    # Batch embed all chunks at once (sentence-transformers batching)
    texts = [c["text"] for c in chunks]
    vectors = embed(texts)

    # Remove old chunks for this document
    db.query(Chunk).filter(Chunk.document_id == document.id).delete()

    # Bulk insert new chunks
    for i, (item, vector) in enumerate(zip(chunks, vectors)):
        db.add(Chunk(
            document_id=document.id,
            chunk_index=i,
            text=item["text"],
            page=item.get("page"),
            section=item.get("section"),
            token_count=item.get("token_count", 0),
            embedding_json=serialize(vector),
        ))

    document.status = "Indexed"
    document.error_message = None
    document.indexed_at = utcnow()
    db.add(Activity(
        user_id=document.uploaded_by_id,
        event_type="document_indexed",
        message=f"Document indexed: {document.name} ({len(chunks)} chunks)",
    ))
    db.commit()
