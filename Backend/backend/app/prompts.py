"""
Prompt Templates & Reusable Prompt Design (LU 3.18)
Prompt Construction & System/User Roles (LU 3.13)
Grounded Answer Generation (LU 3.39)
"""

SYSTEM_GROUNDED = """You are TrackUrDocs, an enterprise document-grounded AI assistant.

Your ONLY source of information is the document context supplied below.

STRICT RULES:
1. Answer ONLY using the supplied document context.
2. Do NOT use any outside knowledge, general knowledge, or assumptions.
3. Do NOT invent policies, dates, numbers, names, procedures, or facts.
4. Cite supporting sources using [SOURCE N] notation for every factual claim.
5. If the context does not contain enough information to answer, respond EXACTLY:
   "I couldn't find enough information in your uploaded documents."
6. If sources contain conflicting information, state this explicitly and cite both.
7. Never fabricate citations or document names.
8. Prefer concise, professional, factual answers.
9. You may suggest follow-up questions at the end of your answer.
"""

GROUNDED_ANSWER_TEMPLATE = """{system}

CONVERSATION HISTORY:
{history}

RETRIEVED DOCUMENT CONTEXT:
{context}

USER QUESTION:
{question}

Respond with a grounded answer using the document context above.
After your answer, suggest 2-3 follow-up questions the user might ask, prefixed with "FOLLOW_UP:".
"""

QUERY_REWRITE_TEMPLATE = """Given the following conversation history and a follow-up question,
rewrite the follow-up question as a standalone question that captures all necessary context
from the conversation history.

CONVERSATION HISTORY:
{history}

FOLLOW-UP QUESTION:
{question}

Return ONLY the rewritten standalone question, nothing else.
"""

DOCUMENT_SUMMARY_TEMPLATE = """Summarize the following document content in 2-3 sentences.
Focus on the main topics, policies, or information covered.

DOCUMENT: {document_name}
CONTENT:
{content}

SUMMARY:"""


def build_context_block(results: list) -> str:
    """
    Build the SOURCE context string from retrieval results.
    Each result is (score, chunk, doc).
    """
    sources = []
    for i, (score, chunk, doc) in enumerate(results, 1):
        page_info = f"page={chunk.page}" if chunk.page else "page=N/A"
        section_info = f"section={chunk.section}" if chunk.section else ""
        meta = " | ".join(filter(None, [doc.name, page_info, section_info]))
        sources.append(
            f"[SOURCE {i}] {meta}\n{chunk.text}"
        )
    return "\n\n".join(sources)


def build_history_block(messages: list) -> str:
    """
    Format conversation history for inclusion in prompts.
    messages: list of {"role": str, "content": str}
    """
    if not messages:
        return "(No prior conversation)"
    lines = []
    for m in messages:
        role = "User" if m["role"] == "user" else "Assistant"
        # Truncate very long messages to prevent context overflow
        content = m["content"]
        if len(content) > 500:
            content = content[:500] + "…"
        lines.append(f"{role}: {content}")
    return "\n".join(lines)


def build_grounded_prompt(
    question: str,
    context: str,
    history: str = "",
) -> str:
    """Assemble the full grounded-answer prompt."""
    return GROUNDED_ANSWER_TEMPLATE.format(
        system=SYSTEM_GROUNDED,
        history=history or "(No prior conversation)",
        context=context,
        question=question,
    )


def build_query_rewrite_prompt(question: str, history: str) -> str:
    """Assemble the query-rewriting prompt."""
    return QUERY_REWRITE_TEMPLATE.format(history=history, question=question)


def parse_follow_ups(answer: str) -> tuple[str, list[str]]:
    """
    Split the model's answer from follow-up suggestions.
    Returns (clean_answer, [follow_up_1, follow_up_2, ...]).
    """
    lines = answer.strip().split("\n")
    answer_lines = []
    follow_ups = []
    for line in lines:
        stripped = line.strip()
        if stripped.startswith("FOLLOW_UP:"):
            follow_ups.append(stripped[len("FOLLOW_UP:"):].strip())
        else:
            answer_lines.append(line)
    return "\n".join(answer_lines).strip(), follow_ups
