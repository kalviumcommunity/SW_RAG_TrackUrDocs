from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional


# ─── Auth ────────────────────────────────────────────────────────────────────

class RegisterIn(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: str
    password: str = Field(min_length=8)
    role: str = "Employee"


class LoginIn(BaseModel):
    email: str
    password: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    email: str
    role: str
    workspace: str
    created_at: datetime


# ─── Collections ─────────────────────────────────────────────────────────────

class CollectionCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    description: Optional[str] = None


class CollectionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    description: Optional[str]
    created_at: datetime


class CollectionDetail(CollectionOut):
    document_count: int = 0
    updated_at: Optional[datetime] = None


# ─── Documents ───────────────────────────────────────────────────────────────

class DocumentOut(BaseModel):
    id: int
    name: str
    file_type: str
    size_bytes: int
    category: str
    collection_id: Optional[int]
    status: str
    uploaded_by: str
    uploaded_at: datetime
    updated_at: datetime


class DocumentDetail(DocumentOut):
    mime_type: str
    description: Optional[str]
    error_message: Optional[str]
    usage_count: int
    indexed_at: Optional[datetime] = None


# ─── Chat ────────────────────────────────────────────────────────────────────

class ChatIn(BaseModel):
    question: str = Field(min_length=2, max_length=2000)
    conversation_id: Optional[int] = None
    scope: str = "all"
    updated_within_days: Optional[int] = None


class CitationOut(BaseModel):
    document_id: int
    document_name: str
    chunk_id: int
    page: Optional[int]
    section: Optional[str]
    score: float
    excerpt: str


class ChatOut(BaseModel):
    conversation_id: int
    message_id: int
    answer: str
    grounded: bool
    citations: list[CitationOut]
    suggested_followups: list[str] = Field(default_factory=list)


class FeedbackIn(BaseModel):
    rating: str = Field(pattern="^(helpful|not_helpful)$")


# ─── Expected Documents ───────────────────────────────────────────────────────

class ExpectedCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    category: str = "Other"
    priority: str = "Medium"
    due_date: Optional[str] = None
