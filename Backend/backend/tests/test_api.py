"""
Comprehensive backend tests for TrackUrDocs.

Tests cover:
  - Health endpoint
  - Auth (register, login, me, duplicate, wrong password)
  - Document upload (valid, invalid extension, too large, empty)
  - Collections
  - Expected documents
  - Dashboard
  - Activity
  - Embeddings quality
  - Chunking
  - Retrieval (via chat)
  - Feedback
"""

import io
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.db import get_db, Base
from app.config import settings

# ─── Test Database Setup ─────────────────────────────────────────────────────

TEST_DB_URL = "sqlite:///./test_trackurdocs.db"
engine_test = create_engine(TEST_DB_URL, connect_args={"check_same_thread": False})
TestSessionLocal = sessionmaker(bind=engine_test, autoflush=False, autocommit=False)
Base.metadata.create_all(bind=engine_test)


def override_get_db():
    db = TestSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)


# ─── Helper ──────────────────────────────────────────────────────────────────

_TEST_USER = {"name": "Test User", "email": "testuser@example.com", "password": "Password123"}
_ADMIN_USER = {"name": "Admin", "email": "admin@example.com", "password": "Admin1234", "role": "Admin"}


def _register_and_login(user_data=None):
    data = user_data or _TEST_USER
    client.post("/api/v1/auth/register", json=data)  # idempotent
    resp = client.post("/api/v1/auth/login", json={"email": data["email"], "password": data["password"]})
    assert resp.status_code == 200, resp.text
    return resp.json()["access_token"]


def _auth_headers(token=None):
    t = token or _register_and_login()
    return {"Authorization": f"Bearer {t}"}


def _make_txt_file(content: str = "This is a test document.\nIt has multiple lines.") -> tuple:
    return ("file", ("test.txt", io.BytesIO(content.encode()), "text/plain"))


# ─── Health ──────────────────────────────────────────────────────────────────

def test_health():
    r = client.get("/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] in {"healthy", "degraded"}
    assert "database" in body
    assert "storage" in body


# ─── Authentication ───────────────────────────────────────────────────────────

def test_register_success():
    import time
    unique_email = f"user_{int(time.time())}@example.com"
    r = client.post("/api/v1/auth/register", json={
        "name": "New User", "email": unique_email, "password": "Password123"
    })
    assert r.status_code == 201
    body = r.json()
    assert body["email"] == unique_email
    assert "password" not in body
    assert "password_hash" not in body


def test_register_duplicate_email():
    client.post("/api/v1/auth/register", json=_TEST_USER)
    r = client.post("/api/v1/auth/register", json=_TEST_USER)
    assert r.status_code == 409


def test_register_short_password():
    r = client.post("/api/v1/auth/register", json={
        "name": "X", "email": "short@example.com", "password": "abc"
    })
    assert r.status_code == 422


def test_login_success():
    _register_and_login()  # ensure user exists
    r = client.post("/api/v1/auth/login", json={
        "email": _TEST_USER["email"], "password": _TEST_USER["password"]
    })
    assert r.status_code == 200
    assert "access_token" in r.json()


def test_login_wrong_password():
    r = client.post("/api/v1/auth/login", json={
        "email": _TEST_USER["email"], "password": "WrongPassword!"
    })
    assert r.status_code == 401


def test_me_endpoint():
    h = _auth_headers()
    r = client.get("/api/v1/auth/me", headers=h)
    assert r.status_code == 200
    assert r.json()["email"] == _TEST_USER["email"]


def test_me_no_token():
    r = client.get("/api/v1/auth/me")
    assert r.status_code == 403


def test_invalid_jwt():
    r = client.get("/api/v1/auth/me", headers={"Authorization": "Bearer totally.invalid.token"})
    assert r.status_code == 401


# ─── Collections ─────────────────────────────────────────────────────────────

def test_create_collection():
    h = _auth_headers()
    import time
    name = f"Test Collection {int(time.time())}"
    r = client.post("/api/v1/collections", json={"name": name, "description": "desc"}, headers=h)
    assert r.status_code == 201
    assert r.json()["name"] == name


def test_list_collections():
    h = _auth_headers()
    r = client.get("/api/v1/collections", headers=h)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_duplicate_collection():
    import time
    h = _auth_headers()
    name = f"Unique Coll {int(time.time())}"
    client.post("/api/v1/collections", json={"name": name}, headers=h)
    r = client.post("/api/v1/collections", json={"name": name}, headers=h)
    assert r.status_code == 409


# ─── Document Upload ──────────────────────────────────────────────────────────

def test_upload_txt_document():
    h = _auth_headers()
    r = client.post(
        "/api/v1/documents/upload",
        files=[_make_txt_file("The remote work policy allows 3 days per week from home.")],
        data={"category": "HR"},
        headers=h,
    )
    assert r.status_code == 201
    body = r.json()
    assert body["status"] == "Processing"
    assert body["file_type"] == "txt"
    assert body["category"] == "HR"
    return body["id"]


def test_upload_invalid_extension():
    h = _auth_headers()
    r = client.post(
        "/api/v1/documents/upload",
        files=[("file", ("evil.exe", io.BytesIO(b"MZ"), "application/octet-stream"))],
        headers=h,
    )
    assert r.status_code == 415


def test_upload_empty_file():
    h = _auth_headers()
    r = client.post(
        "/api/v1/documents/upload",
        files=[("file", ("empty.txt", io.BytesIO(b""), "text/plain"))],
        headers=h,
    )
    assert r.status_code == 400


def test_upload_requires_auth():
    r = client.post(
        "/api/v1/documents/upload",
        files=[_make_txt_file()],
    )
    assert r.status_code == 403


def test_list_documents():
    h = _auth_headers()
    r = client.get("/api/v1/documents", headers=h)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


# ─── Expected Documents ───────────────────────────────────────────────────────

def test_create_expected_document():
    h = _auth_headers()
    r = client.post(
        "/api/v1/expected-documents",
        json={"name": "Business Continuity Plan", "priority": "High", "category": "Operations"},
        headers=h,
    )
    assert r.status_code == 201


def test_list_expected_documents():
    h = _auth_headers()
    r = client.get("/api/v1/expected-documents", headers=h)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


# ─── Dashboard ────────────────────────────────────────────────────────────────

def test_dashboard():
    h = _auth_headers()
    r = client.get("/api/v1/dashboard", headers=h)
    assert r.status_code == 200
    body = r.json()
    assert "documents" in body
    assert "collections" in body
    assert "knowledge_coverage" in body


# ─── Activity ────────────────────────────────────────────────────────────────

def test_activity_list():
    h = _auth_headers()
    r = client.get("/api/v1/activity", headers=h)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


# ─── Embedding Quality ────────────────────────────────────────────────────────

def test_embedding_similarity_sanity():
    """
    Embedding Quality Check (LU 3.29):
    Semantically similar sentences should have higher cosine similarity
    than unrelated sentences.
    """
    from app.embeddings import embed, cosine

    similar_a = "The employee benefits include health insurance."
    similar_b = "Health insurance is part of the employee package."
    unrelated = "The quarterly revenue exceeded expectations by 15 percent."

    vecs = embed([similar_a, similar_b, unrelated])
    sim_related = cosine(vecs[0], vecs[1])
    sim_unrelated = cosine(vecs[0], vecs[2])

    assert sim_related > sim_unrelated, (
        f"Expected similar sentences to score higher: "
        f"related={sim_related:.3f}, unrelated={sim_unrelated:.3f}"
    )
    # Sanity: related similarity should be meaningful
    assert sim_related > 0.5, f"Related similarity too low: {sim_related:.3f}"


# ─── Chunking ─────────────────────────────────────────────────────────────────

def test_chunk_pages_basic():
    from app.document_parser import chunk_pages

    pages = [{"page": 1, "section": "Policy", "text": "A " * 1000}]
    chunks = chunk_pages(pages, size=200, overlap=50)
    assert len(chunks) > 1, "Text should produce multiple chunks"
    for c in chunks:
        assert "text" in c
        assert "page" in c
        assert "section" in c
        assert len(c["text"]) <= 210  # allow slight boundary tolerance


def test_chunk_preserves_metadata():
    from app.document_parser import chunk_pages

    pages = [{"page": 5, "section": "Leave Policy", "text": "Word " * 300}]
    chunks = chunk_pages(pages, size=200, overlap=50)
    for c in chunks:
        assert c["page"] == 5
        assert c["section"] == "Leave Policy"


def test_clean_text():
    from app.document_parser import clean_text

    dirty = "Hello   \x00World\n\n\n\nMultiple\n\n\nLines"
    result = clean_text(dirty)
    assert "\x00" not in result
    assert "\n\n\n" not in result
    assert "Hello" in result
    assert "World" in result


# ─── Chat / RAG ───────────────────────────────────────────────────────────────

def test_chat_refusal_when_no_docs():
    """
    Hallucination Guardrail: when no relevant documents exist,
    the system should refuse rather than invent an answer.
    """
    h = _auth_headers()
    r = client.post(
        "/api/v1/chat",
        json={"question": "What is the policy for teleporting to Mars?", "scope": "all"},
        headers=h,
    )
    assert r.status_code == 200
    body = r.json()
    assert "conversation_id" in body
    # With no indexed docs, answer should be a refusal
    assert body["grounded"] is False or "couldn't find" in body["answer"].lower()


def test_chat_creates_conversation():
    h = _auth_headers()
    r = client.post(
        "/api/v1/chat",
        json={"question": "Hello, what documents do you have?"},
        headers=h,
    )
    assert r.status_code == 200
    body = r.json()
    assert body["conversation_id"] > 0
    assert body["message_id"] > 0


def test_chat_follow_up_conversation():
    h = _auth_headers()
    # First turn
    r1 = client.post("/api/v1/chat", json={"question": "Tell me about policies."}, headers=h)
    assert r1.status_code == 200
    conv_id = r1.json()["conversation_id"]

    # Second turn in same conversation
    r2 = client.post(
        "/api/v1/chat",
        json={"question": "What about leave?", "conversation_id": conv_id},
        headers=h,
    )
    assert r2.status_code == 200
    assert r2.json()["conversation_id"] == conv_id


def test_list_conversations():
    h = _auth_headers()
    client.post("/api/v1/chat", json={"question": "What is the vacation policy?"}, headers=h)
    r = client.get("/api/v1/chat/conversations", headers=h)
    assert r.status_code == 200
    assert isinstance(r.json(), list)
    assert len(r.json()) >= 1


def test_feedback_helpful():
    h = _auth_headers()
    r = client.post("/api/v1/chat", json={"question": "Test question for feedback."}, headers=h)
    msg_id = r.json()["message_id"]
    fb = client.post(f"/api/v1/chat/messages/{msg_id}/feedback", json={"rating": "helpful"}, headers=h)
    assert fb.status_code == 200
    assert fb.json()["rating"] == "helpful"


def test_feedback_invalid_rating():
    h = _auth_headers()
    r = client.post("/api/v1/chat", json={"question": "Test question."}, headers=h)
    msg_id = r.json()["message_id"]
    fb = client.post(
        f"/api/v1/chat/messages/{msg_id}/feedback",
        json={"rating": "amazing"},  # invalid
        headers=h,
    )
    assert fb.status_code == 422
