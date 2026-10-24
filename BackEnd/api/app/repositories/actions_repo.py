"""Action proposals and the only side effect they can have: a demo reminder row."""
from __future__ import annotations

import json
import sqlite3
import uuid
from typing import Any

from app.repositories.database import now_iso


def _p(r: sqlite3.Row | None) -> dict[str, Any] | None:
    if r is None:
        return None
    d = dict(r)
    d["payload"] = json.loads(d.pop("payload_json"))
    return d


def get_by_idempotency(conn: sqlite3.Connection, owner_sub: str, key: str) -> dict[str, Any] | None:
    return _p(conn.execute(
        "SELECT * FROM action_proposals WHERE owner_sub = ? AND idempotency_key = ?", (owner_sub, key)
    ).fetchone())


def create(conn: sqlite3.Connection, *, owner_sub: str, kind: str, title: str, summary: str,
           payload: dict[str, Any], idempotency_key: str, summary_source: str, expires_at: str) -> dict[str, Any]:
    pid = f"ap_{uuid.uuid4().hex}"
    conn.execute(
        """INSERT INTO action_proposals
        (id, owner_sub, kind, title, summary, payload_json, status, idempotency_key, summary_source, created_at, expires_at)
        VALUES (?,?,?,?,?,?,'pending',?,?,?,?)""",
        (pid, owner_sub, kind, title, summary, json.dumps(payload), idempotency_key, summary_source, now_iso(), expires_at),
    )
    return get(conn, pid)  # type: ignore[return-value]


def get(conn: sqlite3.Connection, proposal_id: str) -> dict[str, Any] | None:
    return _p(conn.execute("SELECT * FROM action_proposals WHERE id = ?", (proposal_id,)).fetchone())


def set_status_if_pending(conn: sqlite3.Connection, proposal_id: str, owner_sub: str, status: str) -> bool:
    cur = conn.execute(
        """UPDATE action_proposals SET status = ?, decided_at = ?
        WHERE id = ? AND owner_sub = ? AND status = 'pending'""",
        (status, now_iso(), proposal_id, owner_sub),
    )
    return cur.rowcount == 1


def create_reminder(conn: sqlite3.Connection, *, owner_sub: str, proposal_id: str, title: str, due_at: str) -> dict[str, Any]:
    rid = f"rm_{uuid.uuid4().hex}"
    conn.execute(
        "INSERT INTO demo_reminders (id, owner_sub, proposal_id, title, due_at, created_at) VALUES (?,?,?,?,?,?)",
        (rid, owner_sub, proposal_id, title, due_at, now_iso()),
    )
    return get_reminder_for_proposal(conn, proposal_id)  # type: ignore[return-value]


def get_reminder_for_proposal(conn: sqlite3.Connection, proposal_id: str) -> dict[str, Any] | None:
    r = conn.execute("SELECT * FROM demo_reminders WHERE proposal_id = ?", (proposal_id,)).fetchone()
    return dict(r) if r else None


def list_proposals(conn: sqlite3.Connection, owner_sub: str) -> list[dict[str, Any]]:
    rows = conn.execute(
        "SELECT * FROM action_proposals WHERE owner_sub = ? ORDER BY created_at DESC LIMIT 50", (owner_sub,)
    ).fetchall()
    return [_p(r) for r in rows]  # type: ignore[misc]


def list_reminders(conn: sqlite3.Connection, owner_sub: str) -> list[dict[str, Any]]:
    rows = conn.execute(
        "SELECT * FROM demo_reminders WHERE owner_sub = ? ORDER BY created_at DESC LIMIT 50", (owner_sub,)
    ).fetchall()
    return [dict(r) for r in rows]
