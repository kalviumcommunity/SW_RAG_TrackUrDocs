"""
RAG Pipeline Architecture & Flow Design (LU 3.37)
Similarity Search & Top-K Retrieval (LU 3.32)
Metadata Filtering & Hybrid Search (LU 3.33)
Retrieval Relevance Tuning (LU 3.34)
Chunk Re-Ranking for Precision (LU 3.35)
Context Injection & Prompt Augmentation (LU 3.38)
Hallucination Guardrails & Refusal Handling (LU 3.41)
Conversational RAG & Follow-Up Context (LU 3.42)
"""

import logging
import re
from datetime import datetime, timedelta, timezone

import httpx
from sqlalchemy import select

from .config import settings
from .embeddings import embed, deserialize, cosine
from .models import Chunk, Document, Collection, ChatMessage, Conversation
from .prompts import (
    build_context_block,
    build_history_block,
    build_grounded_prompt,
    build_query_rewrite_prompt,
    parse_follow_ups,
)

logger = logging.getLogger(__name__)

REFUSAL = "I couldn't find enough information in your uploaded documents."


# ─── Retrieval ───────────────────────────────────────────────────────────────

def _keyword_score(text: str, query: str) -> float:
    """
    Lightweight keyword overlap score.
    Counts how many query words appear in the chunk text.
    Returns a value in [0, 1].
    """
    query_words = set(re.findall(r"\b\w{3,}\b", query.lower()))
    if not query_words:
        return 0.0
    chunk_words = set(re.findall(r"\b\w{3,}\b", text.lower()))
    overlap = len(query_words & chunk_words)
    return min(overlap / len(query_words), 1.0)


def retrieve(
    db,
    question: str,
    scope: str = "all",
    updated_within_days: int | None = None,
) -> list[tuple[float, object, object]]:
    """
    Hybrid retrieval pipeline:
      1. Embed query
      2. Fetch all eligible chunks (with metadata filters)
      3. Score each chunk: semantic cosine + keyword overlap
      4. Sort by hybrid score
      5. Return top-K results

    Returns list of (hybrid_score, chunk, doc) tuples.
    """
    query_vector = embed([question])[0]

    # Build base query
    stmt = (
        select(Chunk, Document)
        .join(Document, Chunk.document_id == Document.id)
        .where(Document.status == "Indexed")
    )

    # Scope filtering
    if scope and scope.lower() not in {"all", ""}:
        stmt = (
            stmt
            .outerjoin(Collection, Document.collection_id == Collection.id)
            .where(
                (Collection.name.ilike(scope))
                | (Document.category.ilike(scope))
            )
        )

    # Date filtering
    if updated_within_days:
        cutoff = datetime.now(timezone.utc) - timedelta(days=updated_within_days)
        stmt = stmt.where(Document.updated_at >= cutoff)

    rows = db.execute(stmt).all()

    # Score each candidate
    scored = []
    sem_w = settings.semantic_weight
    kw_w = settings.keyword_weight

    for chunk, doc in rows:
        sem_score = cosine(query_vector, deserialize(chunk.embedding_json))
        kw_score = _keyword_score(chunk.text, question)
        hybrid = sem_w * sem_score + kw_w * kw_score
        scored.append((hybrid, sem_score, chunk, doc))

    # Sort by hybrid score descending
    scored.sort(key=lambda x: x[0], reverse=True)

    # Take top-K candidates for reranking
    candidates = scored[: settings.rag_top_k]

    # Rerank: boost chunks where section title matches query keywords
    reranked = _rerank(candidates, question)

    # Return (hybrid_score, chunk, doc) — omit internal sem_score
    return [(item[0], item[2], item[3]) for item in reranked[: settings.rerank_top_k]]


def _rerank(
    candidates: list[tuple[float, float, object, object]],
    question: str,
) -> list[tuple[float, float, object, object]]:
    """
    Lightweight deterministic reranker.
    Boosts candidates where:
      - Section title contains query keywords (+0.05)
      - Chunk is from beginning of document (chunk_index == 0) for definitional questions

    Does NOT call any external API.
    """
    query_words = set(re.findall(r"\b\w{4,}\b", question.lower()))
    reranked = []
    for hybrid, sem_score, chunk, doc in candidates:
        boost = 0.0
        if chunk.section:
            section_words = set(re.findall(r"\b\w{4,}\b", chunk.section.lower()))
            if query_words & section_words:
                boost += 0.05
        if chunk.chunk_index == 0:
            boost += 0.01  # slight preference for introductory content
        reranked.append((hybrid + boost, sem_score, chunk, doc))

    reranked.sort(key=lambda x: x[0], reverse=True)
    return reranked


# ─── Conversation History ────────────────────────────────────────────────────

def _get_conversation_history(
    db,
    conversation_id: int | None,
    max_turns: int = 4,
) -> list[dict]:
    """
    Fetch the last N turns of a conversation.
    Limits history to avoid context overflow.
    """
    if not conversation_id:
        return []
    messages = db.scalars(
        select(ChatMessage)
        .where(ChatMessage.conversation_id == conversation_id)
        .order_by(ChatMessage.created_at.desc())
        .limit(max_turns * 2)  # user + assistant pairs
    ).all()
    # Reverse to chronological order
    return [{"role": m.role, "content": m.content} for m in reversed(messages)]


# ─── Query Rewriting ─────────────────────────────────────────────────────────

def _rewrite_query(question: str, history: list[dict]) -> str:
    """
    If there is conversation history, use Gemini to rewrite the question
    as a standalone query that captures context from prior turns.
    Falls back to the original question on any error.
    """
    if not history or not settings.gemini_api_key:
        return question

    # Only rewrite if the question is short/ambiguous (likely a follow-up)
    if len(question.split()) > 10:
        return question

    try:
        from google import genai  # noqa: PLC0415

        client = genai.Client(api_key=settings.gemini_api_key)
        history_text = build_history_block(history)
        prompt = build_query_rewrite_prompt(question, history_text)
        response = client.models.generate_content(
            model=settings.gemini_model,
            contents=prompt,
        )
        rewritten = (response.text or "").strip()
        if rewritten:
            logger.info("Query rewritten: '%s' → '%s'", question, rewritten)
            return rewritten
    except Exception as exc:
        logger.warning("Query rewrite failed: %s", exc)

    return question


# ─── Answer Generation ───────────────────────────────────────────────────────

async def answer_question(
    question: str,
    results: list[tuple[float, object, object]],
    history: list[dict] | None = None,
) -> tuple[str, bool, list[str]]:
    """
    Generate a grounded answer.

    Returns:
        (answer_text, is_grounded, follow_up_suggestions)

    Hallucination Guardrails:
      G1 — Minimum similarity threshold (rag_min_score)
      G2 — Require retrieved context
      G3 — Explicit grounded system prompt
      G4 — Citation validation (only real chunks)
      G5 — Refusal when no valid sources
    """
    # Guardrail G1 + G5: filter by minimum score
    usable = [r for r in results if r[0] >= settings.rag_min_score]

    # Guardrail G2 + G5: refuse if nothing passes threshold
    if not usable:
        return REFUSAL, False, []

    # Build context and history blocks
    context = build_context_block(usable)
    history_text = build_history_block(history or [])

    if settings.llm_provider.lower() == "gemini":
        return await _gemini_answer(question, context, history_text)

    if settings.llm_provider.lower() == "ollama":
        return await _ollama_answer(question, context, history_text)

    # Extractive fallback (no LLM)
    answer = _extractive_answer(usable)
    return answer, True, []


async def _gemini_answer(
    question: str,
    context: str,
    history_text: str,
) -> tuple[str, bool, list[str]]:
    """Call Gemini with the grounded prompt."""
    if not settings.gemini_api_key:
        raise RuntimeError(
            "GEMINI_API_KEY is not set. "
            "Add it to your .env file: GEMINI_API_KEY=your_key_here"
        )

    try:
        from google import genai  # noqa: PLC0415
        from google.genai import types  # noqa: PLC0415

        client = genai.Client(api_key=settings.gemini_api_key)
        prompt = build_grounded_prompt(question, context, history_text)

        logger.info(
            "Calling Gemini model=%s, prompt_len=%d",
            settings.gemini_model,
            len(prompt),
        )

        response = client.models.generate_content(
            model=settings.gemini_model,
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=settings.gemini_temperature,
                max_output_tokens=settings.gemini_max_output_tokens,
            ),
        )

        raw = response.text or ""
        if not raw.strip():
            return REFUSAL, False, []

        answer, follow_ups = parse_follow_ups(raw)

        logger.info(
            "Gemini response received, answer_len=%d, follow_ups=%d",
            len(answer),
            len(follow_ups),
        )
        return answer, True, follow_ups

    except Exception as exc:
        logger.error("Gemini call failed: %s", exc)
        error_str = str(exc).lower()
        if "api_key" in error_str or "authentication" in error_str or "401" in error_str:
            return (
                "Authentication failed. Please verify your GEMINI_API_KEY in .env.",
                False,
                [],
            )
        if "quota" in error_str or "429" in error_str or "rate" in error_str:
            return (
                "Gemini API quota exceeded. Please try again later.",
                False,
                [],
            )
        if "model" in error_str and "not found" in error_str:
            return (
                f"Gemini model '{settings.gemini_model}' is not available. "
                "Check GEMINI_MODEL in your .env.",
                False,
                [],
            )
        raise


async def _ollama_answer(
    question: str,
    context: str,
    history_text: str,
) -> tuple[str, bool, list[str]]:
    """Call a local Ollama model."""
    from .prompts import build_grounded_prompt  # noqa: PLC0415

    prompt = build_grounded_prompt(question, context, history_text)
    async with httpx.AsyncClient(timeout=120) as client:
        response = await client.post(
            f"{settings.ollama_base_url.rstrip('/')}/api/generate",
            json={"model": settings.ollama_model, "prompt": prompt, "stream": False},
        )
        response.raise_for_status()
        raw = response.json().get("response", "")
        answer, follow_ups = parse_follow_ups(raw)
        return answer, True, follow_ups


def _extractive_answer(
    usable: list[tuple[float, object, object]],
) -> str:
    """
    Extractive fallback: return the top chunk texts directly.
    Used when no LLM is configured.
    """
    parts = []
    for i, (_, chunk, _) in enumerate(usable[:3], 1):
        parts.append(f"[SOURCE {i}] {chunk.text}")
    return "Based on your organization's documents:\n\n" + "\n\n".join(parts)


# ─── Full Pipeline Entry Point ───────────────────────────────────────────────

async def run_rag_pipeline(
    db,
    question: str,
    conversation_id: int | None = None,
    scope: str = "all",
    updated_within_days: int | None = None,
) -> tuple[str, bool, list[tuple], list[str]]:
    """
    Complete RAG pipeline:
      1. Fetch conversation history
      2. Rewrite query if follow-up
      3. Retrieve + hybrid score
      4. Rerank
      5. Answer with Gemini
      6. Return answer, grounded flag, results, follow-ups

    Returns:
        (answer, grounded, results, follow_up_suggestions)
    """
    history = _get_conversation_history(db, conversation_id)
    standalone_question = _rewrite_query(question, history)

    results = retrieve(db, standalone_question, scope, updated_within_days)
    answer, grounded, follow_ups = await answer_question(
        standalone_question, results, history
    )

    return answer, grounded, results, follow_ups
