"""Assessment sessions + answer attempts. All reads are owner-filtered."""
from __future__ import annotations

import json
import sqlite3
import uuid
from typing import Any

from app.repositories.database import now_iso


def _row(r: sqlite3.Row | None) -> dict[str, Any] | None:
    if r is None:
        return None
    d = dict(r)
    d["question_ids"] = json.loads(d.pop("question_ids_json"))
    d["result"] = json.loads(d["result_json"]) if d.get("result_json") else None
    d.pop("result_json", None)
    return d


def create_session(
    conn: sqlite3.Connection, *, owner_sub: str, stage: str, mode: str, bank_version: str,
    question_ids: list[str], baseline_session_id: str | None = None,
) -> dict[str, Any]:
    sid = f"as_{uuid.uuid4().hex}"
    conn.execute(
        """INSERT INTO assessment_sessions
        (id, owner_sub, stage, mode, bank_version, question_ids_json, baseline_session_id, created_at)
        VALUES (?,?,?,?,?,?,?,?)""",
        (sid, owner_sub, stage, mode, bank_version, json.dumps(question_ids), baseline_session_id, now_iso()),
    )
    return get_session(conn, sid, owner_sub)  # type: ignore[return-value]


def get_session(conn: sqlite3.Connection, session_id: str, owner_sub: str) -> dict[str, Any] | None:
    r = conn.execute(
        "SELECT * FROM assessment_sessions WHERE id = ? AND owner_sub = ?", (session_id, owner_sub)
    ).fetchone()
    return _row(r)


def find_open_session(
    conn: sqlite3.Connection, owner_sub: str, stage: str, *, baseline_session_id: str | None = None
) -> dict[str, Any] | None:
    sql = "SELECT * FROM assessment_sessions WHERE owner_sub = ? AND stage = ? AND finalized_at IS NULL"
    params: list[Any] = [owner_sub, stage]
    if baseline_session_id is not None:
        sql += " AND baseline_session_id = ?"
        params.append(baseline_session_id)
    r = conn.execute(sql + " ORDER BY created_at DESC LIMIT 1", params).fetchone()
    return _row(r)


def latest_finalized(conn: sqlite3.Connection, owner_sub: str, stage: str, *, baseline_session_id: str | None = None):
    sql = "SELECT * FROM assessment_sessions WHERE owner_sub = ? AND stage = ? AND finalized_at IS NOT NULL"
    params: list[Any] = [owner_sub, stage]
    if baseline_session_id is not None:
        sql += " AND baseline_session_id = ?"
        params.append(baseline_session_id)
    r = conn.execute(sql + " ORDER BY finalized_at DESC, rowid DESC LIMIT 1", params).fetchone()
    return _row(r)


def list_finalized(conn: sqlite3.Connection, owner_sub: str) -> list[dict[str, Any]]:
    rows = conn.execute(
        "SELECT * FROM assessment_sessions WHERE owner_sub = ? AND finalized_at IS NOT NULL ORDER BY finalized_at, rowid",
        (owner_sub,),
    ).fetchall()
    return [_row(r) for r in rows]  # type: ignore[misc]


def upsert_answer(
    conn: sqlite3.Connection, *, session_id: str, question_id: str, question_version: str, concept_id: str,
    selected_option_id: str | None, elapsed_ms: int | None,
) -> None:
    conn.execute(
        """INSERT INTO answer_attempts
        (session_id, question_id, question_version, concept_id, selected_option_id, elapsed_ms, answered_at)
        VALUES (?,?,?,?,?,?,?)
        ON CONFLICT(session_id, question_id) DO UPDATE SET
          selected_option_id = excluded.selected_option_id,
          elapsed_ms = excluded.elapsed_ms,
          answered_at = excluded.answered_at""",
        (session_id, question_id, question_version, concept_id, selected_option_id, elapsed_ms, now_iso()),
    )


def get_answers(conn: sqlite3.Connection, session_id: str) -> dict[str, str | None]:
    rows = conn.execute(
        "SELECT question_id, selected_option_id FROM answer_attempts WHERE session_id = ?", (session_id,)
    ).fetchall()
    return {r["question_id"]: r["selected_option_id"] for r in rows}


def finalize_session(
    conn: sqlite3.Connection, *, session_id: str, owner_sub: str, result: dict[str, Any],
    correctness: dict[str, bool | None],
) -> bool:
    """Atomically finalize once. Returns False if it was already finalized."""
    cur = conn.execute(
        """UPDATE assessment_sessions SET finalized_at = ?, result_json = ?
        WHERE id = ? AND owner_sub = ? AND finalized_at IS NULL""",
        (result["finalized_at"], json.dumps(result), session_id, owner_sub),
    )
    if cur.rowcount != 1:
        return False
    for qid, ok in correctness.items():
        conn.execute(
            "UPDATE answer_attempts SET was_correct = ? WHERE session_id = ? AND question_id = ?",
            (None if ok is None else int(ok), session_id, qid),
        )
    return True


def insert_checkpoint_links(conn: sqlite3.Connection, checkpoint_session_id: str, baseline_session_id: str,
                            links: list[tuple[str, str, str]]) -> None:
    for concept_id, bqid, cqid in links:
        conn.execute(
            """INSERT OR IGNORE INTO checkpoint_links
            (checkpoint_session_id, baseline_session_id, concept_id, baseline_question_id, checkpoint_question_id)
            VALUES (?,?,?,?,?)""",
            (checkpoint_session_id, baseline_session_id, concept_id, bqid, cqid),
        )


def get_checkpoint_links(conn: sqlite3.Connection, checkpoint_session_id: str) -> list[dict[str, Any]]:
    rows = conn.execute(
        "SELECT * FROM checkpoint_links WHERE checkpoint_session_id = ? ORDER BY concept_id", (checkpoint_session_id,)
    ).fetchall()
    return [dict(r) for r in rows]
