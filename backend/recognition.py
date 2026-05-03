from __future__ import annotations

import json
import pickle
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import faiss
import numpy as np
from insightface.app import FaceAnalysis


@dataclass
class RecognitionLabel:
    person_id: str | None
    display_name: str


class RecognitionEngine:
    def __init__(self, index: faiss.Index, labels: list[RecognitionLabel], face_app: FaceAnalysis):
        self.index = index
        self.labels = labels
        self.face_app = face_app

    @classmethod
    def from_files(cls, index_path: Path, labels_path: Path) -> "RecognitionEngine":
        if not index_path.exists():
            raise FileNotFoundError(f"Face index not found: {index_path}")
        if not labels_path.exists():
            raise FileNotFoundError(f"Face labels not found: {labels_path}")

        index = faiss.read_index(str(index_path))
        raw_labels = load_raw_labels(labels_path)
        labels = parse_recognition_labels(raw_labels)

        face_app = FaceAnalysis(name="buffalo_l", providers=["CPUExecutionProvider"])
        face_app.prepare(ctx_id=-1, det_size=(640, 640))

        return cls(index=index, labels=labels, face_app=face_app)

    def identify(self, image: np.ndarray, threshold: float, top_k: int) -> dict[str, Any]:
        faces = self.face_app.get(image)
        if not faces:
            return {
                "recognized": False,
                "display_name": None,
                "person_id": None,
                "threshold": threshold,
                "face_count": 0,
                "best_match": None,
                "top_matches": [],
                "reason": "NO_FACE_DETECTED",
            }

        face = max(
            faces,
            key=lambda current: (current.bbox[2] - current.bbox[0]) * (current.bbox[3] - current.bbox[1]),
        )
        embedding = face.normed_embedding.reshape(1, -1).astype("float32")
        similarities, indices = self.index.search(embedding, top_k)

        matches: list[dict[str, Any]] = []
        for similarity, raw_index in zip(similarities[0], indices[0]):
            idx = int(raw_index)
            if idx < 0 or idx >= len(self.labels):
                continue

            label = self.labels[idx]
            score = float(similarity)
            matches.append(
                {
                    "person_id": label.person_id,
                    "display_name": label.display_name,
                    "similarity": score,
                    "similarity_percent": round(max(0.0, min(1.0, score)) * 100, 2),
                }
            )

        best_match = matches[0] if matches else None
        recognized = bool(best_match and best_match["similarity"] >= threshold)

        return {
            "recognized": recognized,
            "display_name": best_match["display_name"] if best_match else None,
            "person_id": best_match["person_id"] if best_match else None,
            "threshold": threshold,
            "face_count": len(faces),
            "best_match": best_match,
            "top_matches": matches,
            "reason": None if recognized else "LOW_SIMILARITY" if best_match else "NO_MATCHES",
        }


def load_raw_labels(labels_path: Path) -> Any:
    if labels_path.suffix.casefold() in {".pkl", ".pickle"}:
        with labels_path.open("rb") as labels_file:
            return pickle.load(labels_file)

    try:
        with labels_path.open("r", encoding="utf-8") as labels_file:
            return json.load(labels_file)
    except UnicodeDecodeError:
        with labels_path.open("rb") as labels_file:
            return pickle.load(labels_file)


def parse_recognition_labels(raw_labels: Any) -> list[RecognitionLabel]:
    labels: list[RecognitionLabel] = []

    for item in raw_labels:
        label = parse_recognition_label(item)
        if label.display_name:
            labels.append(label)

    return labels


def parse_recognition_label(item: Any) -> RecognitionLabel:
    if isinstance(item, dict):
        person_id = item.get("person_id", item.get("nip"))
        display_name = item.get("display_name", item.get("full_name", ""))
        return RecognitionLabel(
            person_id=str(person_id).strip() if person_id is not None else None,
            display_name=str(display_name).strip(),
        )

    if isinstance(item, str):
        if "|" in item:
            person_id, display_name = item.split("|", 1)
            return RecognitionLabel(
                person_id=person_id.strip() or None,
                display_name=display_name.strip(),
            )

        return RecognitionLabel(person_id=None, display_name=item.strip())

    if isinstance(item, (list, tuple)) and len(item) >= 2:
        person_id, display_name = item[0], item[1]
        return RecognitionLabel(
            person_id=str(person_id).strip() if person_id is not None else None,
            display_name=str(display_name).strip(),
        )

    return RecognitionLabel(person_id=None, display_name="")
