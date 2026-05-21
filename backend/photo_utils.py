from __future__ import annotations

import base64
from pathlib import Path
from typing import Any

import cv2
import numpy as np


def normalize_text(value: Any) -> str | None:
    if value is None:
        return None

    if isinstance(value, bytes):
        try:
            value = value.decode("utf-8")
        except UnicodeDecodeError:
            return None

    text = str(value).strip()
    return text if text else None


def _infer_mime_from_base64(payload: str) -> str:
    if payload.startswith("/9j/"):
        return "image/jpeg"
    if payload.startswith("iVBORw0KGgo"):
        return "image/png"
    if payload.startswith("R0lGOD"):
        return "image/gif"
    if payload.startswith("UklGR"):
        return "image/webp"
    if payload.startswith("Qk"):
        return "image/bmp"
    return "image/jpeg"


def _infer_mime_from_path(path: Path) -> str:
    suffix = path.suffix.casefold()
    if suffix in {".jpg", ".jpeg"}:
        return "image/jpeg"
    if suffix == ".png":
        return "image/png"
    if suffix == ".gif":
        return "image/gif"
    if suffix == ".webp":
        return "image/webp"
    if suffix == ".bmp":
        return "image/bmp"
    return "image/jpeg"


def _extract_base64_payload(raw_photo: Any, photo_mode: str) -> str | None:
    if raw_photo is None:
        return None

    if isinstance(raw_photo, bytes):
        if photo_mode == "binary":
            return None
        try:
            raw_photo = raw_photo.decode("utf-8")
        except UnicodeDecodeError:
            return None

    payload = str(raw_photo).strip()
    if not payload:
        return None

    if payload.startswith("data:image"):
        return payload.split(",", 1)[1] if "," in payload else None

    if "," in payload and payload.split(",", 1)[0].startswith("data:image"):
        return payload.split(",", 1)[1]

    return payload


def _resolve_photo_path(raw_photo: Any, base_dir: Path | None = None) -> Path | None:
    if raw_photo is None or isinstance(raw_photo, bytes):
        return None

    payload = str(raw_photo).strip()
    if not payload or payload.startswith("data:image"):
        return None

    path = Path(payload).expanduser()
    if not path.is_absolute() and base_dir is not None:
        path = base_dir / path

    return path.resolve()


def _read_photo_path(raw_photo: Any, base_dir: Path | None = None) -> bytes | None:
    path = _resolve_photo_path(raw_photo, base_dir=base_dir)
    if path is None or not path.is_file():
        return None

    try:
        return path.read_bytes()
    except OSError:
        return None


def decode_image_bytes(raw: bytes) -> np.ndarray:
    if not raw:
        raise ValueError("Image payload is empty")

    array = np.frombuffer(raw, dtype=np.uint8)
    image = cv2.imdecode(array, cv2.IMREAD_COLOR)
    if image is None:
        raise ValueError("Could not decode the image payload")

    return image


def decode_image_base64(image_base64: str) -> np.ndarray:
    payload = image_base64.strip()
    if not payload:
        raise ValueError("image_base64 is empty")

    if "," in payload:
        payload = payload.split(",", 1)[1]

    try:
        image_bytes = base64.b64decode(payload, validate=True)
    except Exception as exc:
        raise ValueError("image_base64 is invalid") from exc

    return decode_image_bytes(image_bytes)


def decode_photo_to_image(raw_photo: Any, photo_mode: str = "auto", base_dir: Path | None = None) -> np.ndarray | None:
    if raw_photo is None:
        return None

    if photo_mode == "path":
        image_bytes = _read_photo_path(raw_photo, base_dir=base_dir)
        if image_bytes is None:
            return None
        array = np.frombuffer(image_bytes, dtype=np.uint8)
        return cv2.imdecode(array, cv2.IMREAD_COLOR)

    if photo_mode == "binary":
        if isinstance(raw_photo, bytes):
            array = np.frombuffer(raw_photo, dtype=np.uint8)
            return cv2.imdecode(array, cv2.IMREAD_COLOR)
        return None

    payload = _extract_base64_payload(raw_photo, photo_mode)
    if not payload:
        if isinstance(raw_photo, bytes):
            array = np.frombuffer(raw_photo, dtype=np.uint8)
            return cv2.imdecode(array, cv2.IMREAD_COLOR)
        return None

    try:
        image_bytes = base64.b64decode(payload)
    except Exception:
        return None

    array = np.frombuffer(image_bytes, dtype=np.uint8)
    return cv2.imdecode(array, cv2.IMREAD_COLOR)


def photo_to_data_url(raw_photo: Any, photo_mode: str = "auto", base_dir: Path | None = None) -> str | None:
    if raw_photo is None:
        return None

    if photo_mode == "path":
        path = _resolve_photo_path(raw_photo, base_dir=base_dir)
        if path is None or not path.is_file():
            return None

        try:
            image_bytes = path.read_bytes()
        except OSError:
            return None

        encoded = base64.b64encode(image_bytes).decode("utf-8")
        return f"data:{_infer_mime_from_path(path)};base64,{encoded}"

    if isinstance(raw_photo, bytes) and photo_mode == "binary":
        encoded = base64.b64encode(raw_photo).decode("utf-8")
        return f"data:image/jpeg;base64,{encoded}"

    if isinstance(raw_photo, bytes):
        try:
            raw_photo = raw_photo.decode("utf-8")
        except UnicodeDecodeError:
            encoded = base64.b64encode(raw_photo).decode("utf-8")
            return f"data:image/jpeg;base64,{encoded}"

    payload = str(raw_photo).strip()
    if not payload:
        return None

    if payload.startswith("data:image"):
        return payload

    if "," in payload and payload.split(",", 1)[0].startswith("data:image"):
        return payload

    mime = _infer_mime_from_base64(payload)
    return f"data:{mime};base64,{payload}"
