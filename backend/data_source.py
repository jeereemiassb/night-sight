from __future__ import annotations

import sqlite3
from collections.abc import Iterator, Sequence
from typing import Any

from backend.config import AppConfig, DirectoryField
from backend.photo_utils import normalize_text, photo_to_data_url


FIELD_ALIAS_PREFIX = "__field_"


class SqliteDirectoryRepository:
    def __init__(self, config: AppConfig):
        self.config = config

    @property
    def db_path(self):
        return self.config.data_source.db_path

    @property
    def people_query(self) -> str:
        return self.config.data_source.people_query.strip().rstrip(";")

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _base_select(self) -> str:
        return f"SELECT * FROM ({self.people_query}) AS directory_source"

    def _select_for_people(self, include_photo: bool) -> tuple[str, list[tuple[DirectoryField, str]]]:
        columns = [
            "person_id",
            "display_name",
            "photo_base64" if include_photo else "NULL AS photo_base64",
        ]
        field_aliases: list[tuple[DirectoryField, str]] = []
        for index, field in enumerate(self.config.fields):
            alias = f"{FIELD_ALIAS_PREFIX}{index}"
            columns.append(f'{field.source_name} AS "{alias}"')
            field_aliases.append((field, alias))
        return ", ".join(columns), field_aliases

    def count_people(self) -> int | None:
        if not self.db_path.exists():
            return None

        conn = self._connect()
        try:
            row = conn.execute(f"SELECT COUNT(*) FROM ({self.people_query}) AS directory_source").fetchone()
            return int(row[0]) if row else 0
        except sqlite3.Error:
            return None
        finally:
            conn.close()

    def count_people_with_photos(self) -> int | None:
        if not self.db_path.exists():
            return None

        conn = self._connect()
        try:
            row = conn.execute(
                f"""
                SELECT COUNT(*)
                FROM ({self.people_query}) AS directory_source
                WHERE photo_base64 IS NOT NULL
                """
            ).fetchone()
            return int(row[0]) if row else 0
        except sqlite3.Error:
            return None
        finally:
            conn.close()

    def iter_people_for_face_index(self) -> Iterator[tuple[str, str, Any]]:
        conn = self._connect()
        try:
            cursor = conn.execute(
                f"""
                SELECT person_id, display_name, photo_base64
                FROM ({self.people_query}) AS directory_source
                WHERE photo_base64 IS NOT NULL
                """
            )
            for row in cursor:
                person_id = normalize_text(row["person_id"])
                display_name = normalize_text(row["display_name"])
                if person_id and display_name:
                    yield person_id, display_name, row["photo_base64"]
        finally:
            conn.close()

    def fetch_people_by_ids(self, person_ids: Sequence[str], include_photo: bool) -> list[dict[str, Any]]:
        if not person_ids:
            return []

        select_sql, field_aliases = self._select_for_people(include_photo)
        placeholders = ", ".join("?" for _ in person_ids)
        order_cases = " ".join(f"WHEN ? THEN {index}" for index, _ in enumerate(person_ids))
        params = tuple(person_ids) + tuple(person_ids)

        conn = self._connect()
        try:
            rows = conn.execute(
                f"""
                SELECT {select_sql}
                FROM ({self.people_query}) AS directory_source
                WHERE person_id IN ({placeholders})
                ORDER BY CASE person_id {order_cases} ELSE {len(person_ids)} END
                """,
                params,
            ).fetchall()
        finally:
            conn.close()

        return [self._row_to_person(row, field_aliases=field_aliases, include_photo=include_photo) for row in rows]

    def search_people_by_name(self, query: str, *, limit: int, include_photo: bool) -> list[dict[str, Any]]:
        select_sql, field_aliases = self._select_for_people(include_photo)
        tokens = [token.casefold() for token in query.replace("_", " ").split() if token.strip()]
        if not tokens:
            return []

        where_parts = []
        params: list[str | int] = []
        for token in tokens:
            where_parts.append("LOWER(REPLACE(display_name, '_', ' ')) LIKE ?")
            params.append(f"%{token}%")
        params.append(limit)

        conn = self._connect()
        try:
            rows = conn.execute(
                f"""
                SELECT {select_sql}
                FROM ({self.people_query}) AS directory_source
                WHERE {" AND ".join(where_parts)}
                ORDER BY display_name
                LIMIT ?
                """,
                tuple(params),
            ).fetchall()
        finally:
            conn.close()

        return [self._row_to_person(row, field_aliases=field_aliases, include_photo=include_photo) for row in rows]

    def fetch_person_by_id(self, person_id: str, include_photo: bool) -> dict[str, Any] | None:
        results = self.fetch_people_by_ids([person_id], include_photo=include_photo)
        return results[0] if results else None

    def _row_to_person(
        self,
        row: sqlite3.Row,
        *,
        field_aliases: Sequence[tuple[DirectoryField, str]],
        include_photo: bool,
    ) -> dict[str, Any]:
        person_id = normalize_text(row["person_id"])
        display_name = normalize_text(row["display_name"]) or "UNKNOWN"
        raw_photo = row["photo_base64"]

        fields: dict[str, str | None] = {}
        for field, alias in field_aliases:
            fields[field.key] = normalize_text(row[alias])

        photo = (
            photo_to_data_url(
                raw_photo,
                photo_mode=self.config.data_source.photo_mode,
                base_dir=self.config.data_source.db_path.parent,
            )
            if include_photo
            else None
        )
        has_photo = False
        if raw_photo is not None:
            if isinstance(raw_photo, bytes):
                has_photo = len(raw_photo) > 0
            else:
                has_photo = bool(str(raw_photo).strip())

        return {
            "id": person_id or display_name,
            "person_id": person_id,
            "display_name": display_name,
            "fields": fields,
            "has_photo": has_photo,
            "photo_data_url": photo,
        }
