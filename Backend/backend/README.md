# TrackUrDocs Backend

FastAPI backend for the TrackUrDocs enterprise document knowledge/RAG application described in the supplied product specification.

## Features

- JWT authentication
- Dashboard KPIs
- Document upload, listing, search, filtering, download, delete and re-index
- PDF, DOCX, TXT and Markdown extraction
- Chunking and sentence-transformer embeddings
- Grounded RAG retrieval with source citations
- Safe extractive mode when no LLM is configured
- Conversations and follow-up chat
- Collections
- Configuration
- Swagger/OpenAPI documentation

## Run locally (without Docker)

The backend runs locally using SQLite by default. No Docker is required.

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
uvicorn app.main:app --reload
```

Open `http://localhost:8000/docs`.

Seed demo data:

```bash
python -m app.seed
```

Demo login:
`admin@trackurdocs.local`
`Admin@12345`

## Configuration

The default development configuration uses SQLite and an extractive RAG response (no external services required).

To use the Gemini LLM (recommended), set in `.env`:

```
LLM_PROVIDER=gemini
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-2.5-flash
```

The application uses local sentence-transformers embeddings and ChromaDB for vector storage. All data is stored in the local `trackurdocs.db` SQLite file and `./storage` directory.

For production deployment, configure PostgreSQL compatible with the SQLAlchemy model (connection string in `.env`).

## Without Docker

The application runs natively on port 8000 with SQLite. No containerization is needed.