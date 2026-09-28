"""
Chat Interface & Query UI (LU 3.46)
Source Citation & Attribution (LU 3.40)
Conversational RAG & Follow-Up Context (LU 3.42)
"""

import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from ..db import get_db
from ..models import Conversation, ChatMessage, Citation, Document, Activity, Feedback
from ..schemas import ChatIn, ChatOut, CitationOut, FeedbackIn
from ..auth import current_user
from ..rag import run_rag_pipeline

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/chat", tags=["AI Chat"])


@router.post(
    "",
    response_model=ChatOut,
    summary="Ask a question",
    description=(
        "Run the full RAG pipeline: retrieve grounded context from indexed documents, "
        "generate an answer with Gemini, and return citations."
    ),
)
async def chat(
    payload: ChatIn,
    user=Depends(current_user),
    db=Depends(get_db),
):
    # Resolve or create conversation
    if payload.conversation_id:
        convo = db.get(Conversation, payload.conversation_id)
        if not convo or convo.user_id != user.id:
            raise HTTPException(404, "Conversation not found")
    else:
        convo = Conversation(user_id=user.id, title=payload.question[:80])
        db.add(convo)
        db.flush()

    # Store user message
    db.add(ChatMessage(conversation_id=convo.id, role="user", content=payload.question))

    # Run RAG pipeline
    try:
        answer, grounded, results, follow_ups = await run_rag_pipeline(
            db=db,
            question=payload.question,
            conversation_id=convo.id,
            scope=payload.scope,
            updated_within_days=payload.updated_within_days,
        )
    except Exception as exc:
        logger.error("RAG pipeline error: %s", exc)
        # Store a graceful error message rather than crashing
        answer = (
            "I encountered an error while processing your question. "
            "Please check the server logs or verify the GEMINI_API_KEY is configured."
        )
        grounded = False
        results = []
        follow_ups = []

    # Store assistant message
    message = ChatMessage(conversation_id=convo.id, role="assistant", content=answer)
    db.add(message)
    db.flush()

    # Store citations and build response
    citations: list[CitationOut] = []
    min_score = 0.30  # match rag_min_score default

    if grounded:
        for score, chunk, doc in results:
            if score < min_score:
                continue
            # Validate: doc and chunk must exist
            real_doc = db.get(Document, doc.id)
            if not real_doc:
                continue
            db.add(Citation(
                message_id=message.id,
                document_id=doc.id,
                chunk_id=chunk.id,
                score=score,
                page=chunk.page,
                section=chunk.section,
                excerpt=chunk.text[:500],
            ))
            citations.append(CitationOut(
                document_id=doc.id,
                document_name=doc.name,
                chunk_id=chunk.id,
                page=chunk.page,
                section=chunk.section,
                score=round(score, 4),
                excerpt=chunk.text[:500],
            ))

    db.add(Activity(
        user_id=user.id,
        event_type="ai_question",
        message=f'AI question asked: "{payload.question[:120]}"',
    ))
    db.commit()

    return ChatOut(
        conversation_id=convo.id,
        message_id=message.id,
        answer=answer,
        grounded=grounded,
        citations=citations,
        suggested_followups=follow_ups,
    )


@router.get(
    "/conversations",
    summary="List conversations",
    description="Return all conversations for the authenticated user.",
)
def conversations(user=Depends(current_user), db=Depends(get_db)):
    rows = db.scalars(
        select(Conversation)
        .where(Conversation.user_id == user.id)
        .order_by(Conversation.updated_at.desc())
    ).all()
    return [
        {
            "id": c.id,
            "title": c.title,
            "created_at": c.created_at,
            "updated_at": c.updated_at,
        }
        for c in rows
    ]


@router.get(
    "/conversations/{conversation_id}",
    summary="Get conversation messages",
)
def conversation(
    conversation_id: int,
    user=Depends(current_user),
    db=Depends(get_db),
):
    c = db.get(Conversation, conversation_id)
    if not c or c.user_id != user.id:
        raise HTTPException(404, "Conversation not found")

    messages = db.scalars(
        select(ChatMessage)
        .where(ChatMessage.conversation_id == c.id)
        .order_by(ChatMessage.created_at)
    ).all()

    output = []
    for m in messages:
        cites = db.scalars(
            select(Citation).where(Citation.message_id == m.id)
        ).all()
        cite_list = []
        for x in cites:
            doc = db.get(Document, x.document_id)
            cite_list.append({
                "document_id": x.document_id,
                "document_name": doc.name if doc else "Unknown",
                "chunk_id": x.chunk_id,
                "page": x.page,
                "section": x.section,
                "score": x.score,
                "excerpt": x.excerpt,
            })
        output.append({
            "id": m.id,
            "role": m.role,
            "content": m.content,
            "created_at": m.created_at,
            "citations": cite_list,
        })

    return {"id": c.id, "title": c.title, "messages": output}


@router.post(
    "/messages/{message_id}/feedback",
    summary="Submit answer feedback",
    description="Record whether an AI answer was helpful or not.",
)
def submit_feedback(
    message_id: int,
    payload: FeedbackIn,
    user=Depends(current_user),
    db=Depends(get_db),
):
    msg = db.get(ChatMessage, message_id)
    if not msg:
        raise HTTPException(404, "Message not found")

    # Upsert feedback (one per user per message)
    existing = db.scalars(
        select(Feedback)
        .where(Feedback.message_id == message_id, Feedback.user_id == user.id)
    ).first()

    if existing:
        existing.rating = payload.rating
    else:
        db.add(Feedback(
            message_id=message_id,
            user_id=user.id,
            rating=payload.rating,
        ))

    db.add(Activity(
        user_id=user.id,
        event_type="feedback_submitted",
        message=f"Feedback '{payload.rating}' for message {message_id}",
    ))
    db.commit()
    return {"message": "Feedback recorded", "rating": payload.rating}
