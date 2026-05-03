from __future__ import annotations

import json
import sys
import time
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

import cv2
import faiss
import numpy as np
from insightface.app import FaceAnalysis
from tqdm import tqdm

from backend.config import get_app_config
from backend.data_source import SqliteDirectoryRepository
from backend.photo_utils import decode_photo_to_image


DET_SIZE = (320, 320)
MAX_SIZE = 640


def main() -> None:
    config = get_app_config()
    repository = SqliteDirectoryRepository(config)

    if not config.data_source.db_path.exists():
        raise FileNotFoundError(f"Source database not found: {config.data_source.db_path}")

    print("Loading face model...")
    cv2.setNumThreads(0)
    face_app = FaceAnalysis(name="buffalo_l", providers=["CPUExecutionProvider"])
    face_app.prepare(ctx_id=-1, det_size=DET_SIZE)

    total = repository.count_people_with_photos() or 0
    print(f"Rows with photos: {total:,}")
    print(f"Face index output: {config.artifacts.face_index_path}")
    print(f"Face labels output: {config.artifacts.face_labels_path}")

    embeddings: list[np.ndarray] = []
    labels: list[dict[str, str]] = []
    errors = 0
    no_face = 0
    started_at = time.time()

    iterator = repository.iter_people_for_face_index()
    progress = tqdm(iterator, total=total if total > 0 else None, unit="img", dynamic_ncols=True)

    for person_id, display_name, raw_photo in progress:
        image = decode_photo_to_image(
            raw_photo,
            photo_mode=config.data_source.photo_mode,
            base_dir=config.data_source.db_path.parent,
        )
        if image is None:
            errors += 1
            continue

        height, width = image.shape[:2]
        if max(height, width) > MAX_SIZE:
            scale = MAX_SIZE / max(height, width)
            image = cv2.resize(image, (int(width * scale), int(height * scale)))

        faces = face_app.get(image)
        if not faces:
            no_face += 1
            continue

        face = max(
            faces,
            key=lambda current: (current.bbox[2] - current.bbox[0]) * (current.bbox[3] - current.bbox[1]),
        )

        embeddings.append(face.normed_embedding)
        labels.append(
            {
                "person_id": person_id,
                "display_name": display_name,
            }
        )

        progress.set_postfix(
            {
                "ok": len(labels),
                "no_face": no_face,
                "err": errors,
            }
        )

    progress.close()

    if not embeddings:
        raise RuntimeError("No face embeddings were generated")

    matrix = np.array(embeddings, dtype="float32")
    index = faiss.IndexFlatIP(matrix.shape[1])
    index.add(matrix)

    config.artifacts.face_index_path.parent.mkdir(parents=True, exist_ok=True)
    config.artifacts.face_labels_path.parent.mkdir(parents=True, exist_ok=True)

    faiss.write_index(index, str(config.artifacts.face_index_path))
    with config.artifacts.face_labels_path.open("w", encoding="utf-8") as labels_file:
        json.dump(labels, labels_file, ensure_ascii=False, indent=2)

    elapsed = time.time() - started_at
    print(f"Done in {elapsed:.1f}s")
    print(f"Indexed faces: {len(labels):,}")
    print(f"No face detected: {no_face:,}")
    print(f"Decode errors: {errors:,}")


if __name__ == "__main__":
    main()
