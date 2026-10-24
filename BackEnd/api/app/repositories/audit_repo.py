"""Append-only audit trail. Never stores tokens, secrets or raw answers."""
from __future__ import annotations

import sqlite3
from typing import Any

from app.repositories.database import now_iso


def record(conn: sqlite3.Connection, owner_sub: str, action: str, outcome: str,
           target_id: str | None = None, detail: str | None = None) -> None:
    conn.execute(
        "INSERT INTO audit_events (owner_sub, action, outcome, target_id, detail, created_at) VALUES (?,?,?,?,?,?)",
        (owner_sub, action, outcome, target_id, (detail or "")[:300] or None, now_iso()),
    )


def list_for(conn: sqlite3.Connection, owner_sub: str, limit: int = 100) -> list[dict[str, Any]]:
    rows = conn.execute(
        "SELECT id, action, outcome, target_id, detail, created_at FROM audit_events WHERE owner_sub = ? "
        "ORDER BY id DESC LIMIT ?",
        (owner_sub, limit),
    ).fetchall()
    return [dict(r) for r in rows]


def delete_all_for(conn: sqlite3.Connection, owner_sub: str) -> int:
    """Privacy control: deletes the user row; ON DELETE CASCADE removes every owned record."""
    cur = conn.execute("DELETE FROM users WHERE auth0_sub = ?", (owner_sub,))
    return cur.rowcount
