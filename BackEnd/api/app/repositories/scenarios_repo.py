"""User-owned saved educational scenarios (numeric assumptions only)."""
from __future__ import annotations

import json
import sqlite3
import uuid
from typing import Any

from app.repositories.database import now_iso


def save(conn: sqlite3.Connection, owner_sub: str, name: str, inputs: dict[str, Any]) -> dict[str, Any]:
    sid = f"sc_{uuid.uuid4().hex}"
    ts = now_iso()
    conn.execute(
        "INSERT INTO saved_scenarios (id, owner_sub, name, inputs_json, created_at) VALUES (?,?,?,?,?)",
        (sid, owner_sub, name, json.dumps(inputs), ts),
    )
    return {"id": sid, "name": name, "inputs": inputs, "created_at": ts}


def list_for(conn: sqlite3.Connection, owner_sub: str) -> list[dict[str, Any]]:
    rows = conn.execute(
        "SELECT * FROM saved_scenarios WHERE owner_sub = ? ORDER BY created_at DESC LIMIT 50", (owner_sub,)
    ).fetchall()
    return [{"id": r["id"], "name": r["name"], "inputs": json.loads(r["inputs_json"]), "created_at": r["created_at"]}
            for r in rows]
