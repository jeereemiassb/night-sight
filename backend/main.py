from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Any

import faiss
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from backend.config import get_app_config
from backend.data_source import SqliteDirectoryRepository
from backend.photo_utils import decode_image_base64
from backend.recognition import RecognitionEngine


API_TITLE = "NightSight API"
API_VERSION = "0.1.0"

app = FastAPI(title=API_TITLE, version=API_VERSION)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class RecognitionRequest(BaseModel):
    image_base64: str = Field(..., min_length=32, description="Image in base64 or data URL format")
    threshold: float | None = Field(None, ge=-1.0, le=1.0, description="Similarity threshold override")
    top_k: int | None = Field(None, ge=1, le=20, description="Number of candidates to return")


@lru_cache(maxsize=1)
def get_repository() -> SqliteDirectoryRepository:
    return SqliteDirectoryRepository(get_app_config())


@lru_cache(maxsize=1)
def get_recognition_engine() -> RecognitionEngine:
    config = get_app_config()
    return RecognitionEngine.from_files(
        index_path=config.artifacts.face_index_path,
        labels_path=config.artifacts.face_labels_path,
    )


def file_info(path: Path) -> dict[str, Any]:
    return {
        "path": str(path),
        "exists": path.exists(),
        "size_bytes": path.stat().st_size if path.exists() else None,
    }


@app.get("/")
def root() -> dict[str, str]:
    return {"message": "NightSight backend online"}


@app.get("/api/health")
def health() -> dict[str, Any]:
    config = get_app_config()
    repository = get_repository()

    return {
        "ok": True,
        "service": API_TITLE,
        "version": API_VERSION,
        "artifacts": {
            "source_db": file_info(config.data_source.db_path),
            "face_index": file_info(config.artifacts.face_index_path),
            "face_labels": file_info(config.artifacts.face_labels_path),
        },
        "stats": {
            "db_rows": repository.count_people(),
            "rows_with_photos": repository.count_people_with_photos(),
        },
    }


@app.get("/api/ui-config")
def ui_config() -> dict[str, Any]:
    config = get_app_config()
    return {
        "person_id_label": config.data_source.person_id_label,
        "search_min_length": config.data_source.search_min_length,
        "max_results": config.data_source.max_results,
        "fields": [
            {
                "key": field.key,
                "label": field.label,
                "default_visible": field.default_visible,
                "icon": field.icon,
            }
            for field in config.fields
        ],
    }


@app.get("/api/index/info")
def index_info() -> dict[str, Any]:
    config = get_app_config()
    if not config.artifacts.face_index_path.exists():
        raise HTTPException(status_code=404, detail="Face index file was not found")

    try:
        index = faiss.read_index(str(config.artifacts.face_index_path))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Could not load the face index: {exc}") from exc

    return {
        "path": str(config.artifacts.face_index_path),
        "total_vectors": int(index.ntotal),
        "dimension": int(index.d),
        "is_trained": bool(index.is_trained),
    }


@app.post("/api/recognition/identify")
def identify_person(payload: RecognitionRequest) -> dict[str, Any]:
    config = get_app_config()

    try:
        image = decode_image_base64(payload.image_base64)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    try:
        engine = get_recognition_engine()
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Could not initialize recognition engine: {exc}") from exc

    threshold = payload.threshold if payload.threshold is not None else config.recognition.threshold
    top_k = payload.top_k if payload.top_k is not None else config.recognition.top_k

    return engine.identify(image=image, threshold=threshold, top_k=top_k)


@app.get("/api/people/search")
def search_people(
    q: str | None = Query(None, description="Free-text person search"),
    person_id: str | None = Query(None, description="Exact person id match"),
    include_photo: bool = Query(True, description="Include a photo data URL in the response"),
    limit: int | None = Query(None, ge=1, le=100, description="Maximum number of results to return"),
) -> dict[str, Any]:
    config = get_app_config()
    repository = get_repository()

    query_text = q.strip() if q else None
    exact_id = person_id.strip() if person_id else None

    if not query_text and not exact_id:
        raise HTTPException(status_code=422, detail="Send q or person_id")

    if query_text and len(query_text) < config.data_source.search_min_length:
        raise HTTPException(
            status_code=422,
            detail=f"Name search requires at least {config.data_source.search_min_length} characters",
        )

    if not config.data_source.db_path.exists():
        raise HTTPException(status_code=404, detail="Source database not found")

    effective_limit = min(limit or config.data_source.max_results, config.data_source.max_results)

    results: list[dict[str, Any]] = []

    try:
        if exact_id:
            results.extend(repository.fetch_people_by_ids([exact_id], include_photo=include_photo))
        if query_text:
            results.extend(
                repository.search_people_by_name(
                    query_text,
                    limit=effective_limit,
                    include_photo=include_photo,
                )
            )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Directory query failed: {exc}") from exc

    deduped = list({person["person_id"]: person for person in results}.values())[:effective_limit]

    return {
        "query": query_text,
        "person_id": exact_id,
        "count": len(deduped),
        "results": deduped,
    }


@app.get("/api/people/{person_id}")
def get_person_detail(
    person_id: str,
    include_photo: bool = Query(True, description="Include a photo data URL in the response"),
) -> dict[str, Any]:
    config = get_app_config()
    repository = get_repository()

    exact_id = person_id.strip()
    if not exact_id:
        raise HTTPException(status_code=422, detail="person_id is invalid")

    if not config.data_source.db_path.exists():
        raise HTTPException(status_code=404, detail="Source database not found")

    try:
        person = repository.fetch_person_by_id(exact_id, include_photo=include_photo)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Directory query failed: {exc}") from exc

    if person is None:
        raise HTTPException(status_code=404, detail="Person not found")

    return {"person": person}
