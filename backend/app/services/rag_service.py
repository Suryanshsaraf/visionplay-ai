import os
import chromadb
from sqlalchemy.orm import Session
from app.models import models
from chromadb import EmbeddingFunction

# Persistent storage folder for ChromaDB
DB_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "chroma_db")
os.makedirs(DB_DIR, exist_ok=True)

class SimpleEmbeddingFunction(EmbeddingFunction):
    """
    A lightweight, 100% offline hash-based embedding function.
    Generates 384-dimensional dense vectors based on term hashing.
    Avoids 79MB ONNX downloads and internet dependency.
    """
    def __call__(self, input: list) -> list:
        embeddings = []
        for text in input:
            vector = [0.0] * 384
            words = text.lower().replace("|", " ").replace(":", " ").replace("-", " ").split()
            for idx, word in enumerate(words):
                h = hash(word) % 384
                vector[h] += 1.0 + (idx * 0.1)
            # Normalize vector
            norm = sum(v**2 for v in vector)**0.5
            if norm > 0:
                vector = [float(v / norm) for v in vector]
            embeddings.append(vector)
        return embeddings

_chroma_client = None

def get_chroma_client():
    global _chroma_client
    if _chroma_client is None:
        _chroma_client = chromadb.PersistentClient(path=DB_DIR)
    return _chroma_client

def index_match_events(match_id: int, db: Session):
    # Fetch events
    events = db.query(models.MatchEvent).filter(
        models.MatchEvent.match_id == match_id
    ).all()

    if not events:
        print(f"No events to index in ChromaDB for match {match_id}")
        return

    client = get_chroma_client()
    # Create collection with custom embedding function
    collection = client.get_or_create_collection(
        name=f"match_{match_id}",
        embedding_function=SimpleEmbeddingFunction()
    )

    documents = []
    metadatas = []
    ids = []

    for ev in events:
        doc = f"Timestamp: {ev.timestamp:.2f}s | Event: {ev.event_type.upper()} | {ev.description}"
        meta = {
            "match_id": match_id,
            "timestamp": float(ev.timestamp),
            "event_type": ev.event_type,
            "player_id": int(ev.player_id) if ev.player_id is not None else -1,
            "team_id": int(ev.team_id) if ev.team_id is not None else -1
        }
        
        documents.append(doc)
        metadatas.append(meta)
        ids.append(f"event_{ev.id}")

    # Add items to collection
    collection.upsert(
        documents=documents,
        metadatas=metadatas,
        ids=ids
    )

    print(f"Indexed {len(documents)} events in ChromaDB collection 'match_{match_id}'.")

def search_match_events(match_id: int, query_text: str, n_results: int = 5) -> list:
    client = get_chroma_client()
    try:
        collection = client.get_collection(
            name=f"match_{match_id}",
            embedding_function=SimpleEmbeddingFunction()
        )
    except Exception:
        # Collection doesn't exist yet
        print(f"Collection 'match_{match_id}' not found.")
        return []

    count = collection.count()
    if count == 0:
        return []

    results = collection.query(
        query_texts=[query_text],
        n_results=min(n_results, count)
    )

    formatted_results = []
    if results and results["documents"]:
        docs = results["documents"][0]
        metas = results["metadatas"][0]
        distances = results["distances"][0] if "distances" in results else [0.0] * len(docs)
        
        for doc, meta, dist in zip(docs, metas, distances):
            formatted_results.append({
                "document": doc,
                "timestamp": meta["timestamp"],
                "event_type": meta["event_type"],
                "player_id": meta["player_id"],
                "team_id": meta["team_id"],
                "score": float(dist)
            })

    return formatted_results
