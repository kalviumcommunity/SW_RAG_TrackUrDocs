from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Database
    database_url: str = "sqlite:///./trackurdocs.db"
    storage_dir: str = "./storage"

    # Auth
    jwt_secret: str = "change-me"
    jwt_algorithm: str = "HS256"
    access_token_minutes: int = 480

    # Embeddings
    embedding_model: str = "all-MiniLM-L6-v2"

    # Retrieval
    rag_top_k: int = 8
    rag_min_score: float = 0.30
    rerank_top_k: int = 5
    semantic_weight: float = 0.7
    keyword_weight: float = 0.3

    # Chunking
    chunk_size: int = 900
    chunk_overlap: int = 150

    # LLM
    llm_provider: str = "extractive"
    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.5-flash"
    gemini_temperature: float = 0.2
    gemini_max_output_tokens: int = 2048
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "llama3.2"

    # Upload
    max_upload_mb: int = 50

    # CORS
    cors_origins: str = "http://localhost:3000,http://localhost:5173,http://127.0.0.1:3000,http://127.0.0.1:5173"

    # Logging
    log_level: str = "INFO"


@lru_cache
def get_settings():
    return Settings()


settings = get_settings()
