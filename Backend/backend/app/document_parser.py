"""
Document Loading & Multi-Format Intake
Text Extraction & Cleaning Pipeline
Document Chunking Strategies
Chunk Metadata & Source Tracking
Token-Aware Chunk Sizing & Overlap
"""

import re
from pathlib import Path

from pypdf import PdfReader
from docx import Document as DocxDocument


# ─── Text Cleaning ──────────────────────────────────────────────────────────

def clean_text(text: str) -> str:
    """
    Normalize and clean extracted text.
    - Collapse repeated whitespace/newlines
    - Remove null bytes
    - Normalize unicode spaces
    - Strip leading/trailing whitespace
    """
    if not text:
        return ""
    # Remove null bytes and non-printable control chars (keep \n \t)
    text = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", "", text)
    # Normalize unicode whitespace to ASCII space
    text = re.sub(r"[\u00a0\u2000-\u200b\u202f\u205f\u3000]", " ", text)
    # Collapse 3+ newlines → 2
    text = re.sub(r"\n{3,}", "\n\n", text)
    # Collapse repeated spaces within a line (preserve newlines)
    text = re.sub(r"[ \t]+", " ", text)
    # Strip each line
    lines = [line.strip() for line in text.split("\n")]
    text = "\n".join(lines)
    return text.strip()


def estimate_tokens(text: str) -> int:
    """
    Approximate token count.
    GPT-style tokenizers average ~4 chars per token.
    sentence-transformers tokenizers are similar for English.
    """
    return max(1, len(text) // 4)


# ─── Loaders ────────────────────────────────────────────────────────────────

def _load_pdf(path: Path) -> list[dict]:
    """Load PDF pages preserving page numbers."""
    pages = []
    reader = PdfReader(str(path))
    for number, page in enumerate(reader.pages, 1):
        text = clean_text(page.extract_text() or "")
        if text:
            pages.append({"page": number, "section": None, "text": text})
    return pages


def _load_docx(path: Path) -> list[dict]:
    """Load DOCX preserving heading sections."""
    doc = DocxDocument(str(path))
    pages = []
    section = None
    buffer: list[str] = []

    def flush():
        if buffer:
            pages.append({
                "page": None,
                "section": section,
                "text": clean_text("\n".join(buffer)),
            })
            buffer.clear()

    for para in doc.paragraphs:
        text = para.text.strip()
        if not text:
            continue
        style_name = para.style.name if para.style else ""
        if "Heading" in style_name:
            flush()
            section = text
        else:
            buffer.append(text)

    flush()
    return pages


def _load_txt(path: Path) -> list[dict]:
    """Load plain text / markdown."""
    raw = path.read_text(encoding="utf-8", errors="replace")
    text = clean_text(raw)
    if not text:
        return []
    return [{"page": None, "section": None, "text": text}]


def _load_xlsx(path: Path) -> list[dict]:
    """Load Excel spreadsheet, one page per sheet."""
    try:
        import openpyxl  # noqa: PLC0415
    except ImportError:
        raise ValueError(
            "openpyxl is required for XLSX files. "
            "Install it with: pip install openpyxl"
        )
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    pages = []
    for sheet_name in wb.sheetnames:
        ws = wb[sheet_name]
        rows = []
        for row in ws.iter_rows(values_only=True):
            cells = [str(c) if c is not None else "" for c in row]
            line = "\t".join(cells).rstrip()
            if any(c.strip() for c in cells):
                rows.append(line)
        text = clean_text("\n".join(rows))
        if text:
            pages.append({"page": None, "section": sheet_name, "text": text})
    wb.close()
    return pages


def _load_pptx(path: Path) -> list[dict]:
    """Load PowerPoint, one page per slide."""
    try:
        from pptx import Presentation  # noqa: PLC0415
    except ImportError:
        raise ValueError(
            "python-pptx is required for PPTX files. "
            "Install it with: pip install python-pptx"
        )
    prs = Presentation(str(path))
    pages = []
    for slide_num, slide in enumerate(prs.slides, 1):
        lines = []
        title = None
        for shape in slide.shapes:
            if not shape.has_text_frame:
                continue
            text = shape.text_frame.text.strip()
            if not text:
                continue
            if hasattr(shape, "name") and "title" in shape.name.lower():
                title = text
            else:
                lines.append(text)
        full_text = clean_text("\n".join(lines))
        if full_text:
            pages.append({"page": slide_num, "section": title, "text": full_text})
    return pages


# ─── Public API ─────────────────────────────────────────────────────────────

LOADERS = {
    "pdf": _load_pdf,
    "docx": _load_docx,
    "txt": _load_txt,
    "md": _load_txt,
    "xlsx": _load_xlsx,
    "pptx": _load_pptx,
}


def extract_file(path: Path, file_type: str) -> list[dict]:
    """
    Dispatch to the correct loader and return a list of
    {"page": int|None, "section": str|None, "text": str} dicts.
    """
    loader = LOADERS.get(file_type.lower())
    if not loader:
        raise ValueError(f"Unsupported file type: {file_type}")
    pages = loader(path)
    # Filter empty pages
    return [p for p in pages if p.get("text", "").strip()]


def chunk_pages(
    pages: list[dict],
    size: int = 900,
    overlap: int = 150,
) -> list[dict]:
    """
    Split each page/section into overlapping character-based chunks.

    Each chunk preserves:
      - page number
      - section name
      - approximate token count

    The size and overlap are measured in characters.
    ~900 chars ≈ 225 tokens (well within 512-token limit of all-MiniLM-L6-v2).
    """
    output = []
    for page in pages:
        # Normalize whitespace but keep paragraph structure for context
        text = " ".join(page["text"].split())
        start = 0
        while start < len(text):
            end = min(start + size, len(text))
            # Try to break at a word boundary
            if end < len(text):
                boundary = text.rfind(" ", start, end)
                if boundary > start:
                    end = boundary

            piece = text[start:end].strip()
            if piece:
                output.append({
                    "text": piece,
                    "page": page.get("page"),
                    "section": page.get("section"),
                    "token_count": estimate_tokens(piece),
                })
            if end >= len(text):
                break
            start = end - overlap
            # Ensure forward progress
            if start < 0:
                start = 0

    return output
