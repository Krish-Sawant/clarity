"""Voluntary, ungraded habit/goal self-reports. Stored separately from quiz data."""
from __future__ import annotations

import json
import sqlite3
from typing import Any

from app.repositories.database import now_iso


def latest(conn: sqlite3.Connection, owner_sub: str) -> dict[str, Any] | None:
    r = conn.execute(
        "SELECT answers_json, created_at FROM habit_surveys WHERE owner_sub = ? ORDER BY id DESC LIMIT 1",
        (owner_sub,),
    ).fetchone()
    if r is None:
        return None
    return {**json.loads(r["answers_json"]), "updated_at": r["created_at"]}


def save_merged(conn: sqlite3.Connection, owner_sub: str, partial: dict[str, Any]) -> dict[str, Any]:
    """Append a new record = previous answers overlaid with provided (non-None) fields."""
    prev = latest(conn, owner_sub) or {}
    prev.pop("updated_at", None)
    merged = {**prev, **{k: v for k, v in partial.items() if v is not None}}
    conn.execute(
        "INSERT INTO habit_surveys (owner_sub, answers_json, created_at) VALUES (?,?,?)",
        (owner_sub, json.dumps(merged), now_iso()),
    )
    return {**merged, "updated_at": now_iso()}
