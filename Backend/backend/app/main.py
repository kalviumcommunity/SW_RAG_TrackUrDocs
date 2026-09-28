import logging
from pathlib import Path
from contextlib import asynccontextmanager

from sqlalchemy import text
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .db import Base, engine, SessionLocal
from .routers import (
    auth,
    documents,
    chat,
    collections,
    expected,
    activity,
    dashboard,
)


logging.basicConfig(
    level=getattr(logging, settings.log_level.upper(), logging.INFO),
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan handler.

    Startup:
    - Create database tables if they don't exist.
    - Create the storage directory if needed.

    Shutdown:
    - Reserved for future cleanup logic.
    """

    # Startup
    # Auto-create all tables on startup (safe to run multiple times)
    Base.metadata.create_all(bind=engine)

    # Ensure storage directory exists
    Path(settings.storage_dir).mkdir(parents=True, exist_ok=True)

    yield

    # Shutdown
    # Add cleanup logic here if needed in the future


app = FastAPI(
    title="TrackUrDocs API",
    version="1.0.0",
    description=(
        "Enterprise internal document knowledge and RAG platform.\n\n"
        "**Authentication:** Click **Authorize** and enter: "
        "`Bearer <your_jwt_token>`"
    ),
    lifespan=lifespan,
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        x.strip()
        for x in settings.cors_origins.split(",")
        if x.strip()
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", tags=["System"], summary="Health check")
def health():
    """
    Verify the API is running and all required services are reachable.
    Returns per-component status.
    """

    result: dict = {
        "status": "healthy",
        "database": "ok",
        "storage": "ok",
    }

    # Database probe
    try:
        db = SessionLocal()
        db.execute(text("SELECT 1"))
        db.close()
    except Exception as exc:
        result["database"] = f"error: {exc}"
        result["status"] = "degraded"

    # Storage probe
    try:
        storage = Path(settings.storage_dir)
        storage.mkdir(parents=True, exist_ok=True)

        if not storage.is_dir():
            raise RuntimeError("not a directory")

    except Exception as exc:
        result["storage"] = f"error: {exc}"
        result["status"] = "degraded"

    return result


# API routers
app.include_router(auth.router, prefix="/api/v1")
app.include_router(documents.router, prefix="/api/v1")
app.include_router(chat.router, prefix="/api/v1")
app.include_router(collections.router, prefix="/api/v1")
app.include_router(expected.router, prefix="/api/v1")
app.include_router(activity.router, prefix="/api/v1")
app.include_router(dashboard.router, prefix="/api/v1")
