from __future__ import annotations

import json
import os
import tomllib
from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, Field


ROOT_DIR = Path(__file__).resolve().parent.parent
DEFAULT_CONFIG_PATH = ROOT_DIR / "config" / "data_source.toml"


class DirectoryField(BaseModel):
    key: str
    label: str
    source: str | None = None
    default_visible: bool = False
    icon: str | None = None

    @property
    def source_name(self) -> str:
        return self.source or self.key


class DataSourceConfig(BaseModel):
    db_path: Path
    people_query: str
    person_id_label: str = "Person ID"
    photo_mode: Literal["auto", "base64", "data_url", "binary", "path"] = "auto"
    search_min_length: int = Field(3, ge=1, le=20)
    max_results: int = Field(25, ge=1, le=100)


class ArtifactsConfig(BaseModel):
    face_index_path: Path
    face_labels_path: Path


class RecognitionConfig(BaseModel):
    threshold: float = Field(0.35, ge=-1.0, le=1.0)
    top_k: int = Field(5, ge=1, le=20)


class AppConfig(BaseModel):
    data_source: DataSourceConfig
    artifacts: ArtifactsConfig
    recognition: RecognitionConfig = RecognitionConfig()
    fields: list[DirectoryField] = []

    def search_signature(self) -> str:
        payload = {
            "db_path": str(self.data_source.db_path),
            "people_query": self.data_source.people_query.strip(),
        }
        return json.dumps(payload, sort_keys=True)


def _resolve_path(raw_path: Path, *, base_dir: Path) -> Path:
    expanded = Path(os.path.expanduser(str(raw_path)))
    if expanded.is_absolute():
        return expanded
    return (base_dir / expanded).resolve()


@lru_cache(maxsize=1)
def get_app_config() -> AppConfig:
    config_path = Path(os.getenv("APP_CONFIG_PATH", DEFAULT_CONFIG_PATH)).resolve()
    if not config_path.exists():
        raise FileNotFoundError(f"Config file not found: {config_path}")

    with config_path.open("rb") as config_file:
        payload = tomllib.load(config_file)

    config = AppConfig.model_validate(payload)
    base_dir = config_path.parent

    config.data_source.db_path = _resolve_path(config.data_source.db_path, base_dir=base_dir)
    config.artifacts.face_index_path = _resolve_path(config.artifacts.face_index_path, base_dir=base_dir)
    config.artifacts.face_labels_path = _resolve_path(config.artifacts.face_labels_path, base_dir=base_dir)

    return config
