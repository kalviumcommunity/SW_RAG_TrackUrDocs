import json
from functools import lru_cache
import numpy as np
from sentence_transformers import SentenceTransformer
from .config import settings

@lru_cache(maxsize=1)
def model():
    return SentenceTransformer(settings.embedding_model)

def embed(texts):
    vectors = model().encode(texts, normalize_embeddings=True, show_progress_bar=False)
    return vectors.tolist()

def serialize(vector):
    return json.dumps(vector)

def deserialize(value):
    return np.array(json.loads(value), dtype=np.float32)

def cosine(a, b):
    a = np.asarray(a, dtype=np.float32)
    b = np.asarray(b, dtype=np.float32)
    denominator = np.linalg.norm(a) * np.linalg.norm(b)
    return float(np.dot(a, b) / denominator) if denominator else 0.0
