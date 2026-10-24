"""Learning plans and lesson progress."""
from __future__ import annotations

import json
import sqlite3
import uuid
from typing import Any

from app.repositories.database import now_iso


def get_plan(conn: sqlite3.Connection, owner_sub: str, baseline_session_id: str) -> dict[str, Any] | None:
    r = conn.execute(
        "SELECT plan_json FROM learning_plans WHERE owner_sub = ? AND baseline_session_id = ?",
        (owner_sub, baseline_session_id),
    ).fetchone()
    return json.loads(r["plan_json"]) if r else None


def save_plan(conn: sqlite3.Connection, owner_sub: str, baseline_session_id: str, plan: dict[str, Any]) -> None:
    conn.execute(
        """INSERT OR IGNORE INTO learning_plans (id, owner_sub, baseline_session_id, plan_json, created_at)
        VALUES (?,?,?,?,?)""",
        (f"lp_{uuid.uuid4().hex}", owner_sub, baseline_session_id, json.dumps(plan), now_iso()),
    )


def get_progress(conn: sqlite3.Connection, owner_sub: str, lesson_id: str) -> dict[str, Any] | None:
    r = conn.execute(
        "SELECT * FROM lesson_progress WHERE owner_sub = ? AND lesson_id = ?", (owner_sub, lesson_id)
    ).fetchone()
    return dict(r) if r else None


def record_reflection(conn: sqlite3.Connection, owner_sub: str, lesson_id: str, version: str,
                      option_id: str, correct: bool) -> None:
    conn.execute(
        """INSERT INTO lesson_progress (owner_sub, lesson_id, lesson_version, reflection_option_id,
            reflection_correct, started_at)
        VALUES (?,?,?,?,?,?)
        ON CONFLICT(owner_sub, lesson_id) DO UPDATE SET
            reflection_option_id = excluded.reflection_option_id,
            reflection_correct = excluded.reflection_correct""",
        (owner_sub, lesson_id, version, option_id, int(correct), now_iso()),
    )


def mark_complete(conn: sqlite3.Connection, owner_sub: str, lesson_id: str, version: str,
                  exercise_state: dict[str, Any]) -> str:
    ts = now_iso()
    conn.execute(
        """INSERT INTO lesson_progress (owner_sub, lesson_id, lesson_version, exercise_state_json, started_at, completed_at)
        VALUES (?,?,?,?,?,?)
        ON CONFLICT(owner_sub, lesson_id) DO UPDATE SET
            exercise_state_json = excluded.exercise_state_json,
            completed_at = COALESCE(lesson_progress.completed_at, excluded.completed_at)""",
        (owner_sub, lesson_id, version, json.dumps(exercise_state), ts, ts),
    )
    row = get_progress(conn, owner_sub, lesson_id)
    return row["completed_at"] if row else ts


def completed_lesson_ids(conn: sqlite3.Connection, owner_sub: str) -> list[str]:
    rows = conn.execute(
        "SELECT lesson_id FROM lesson_progress WHERE owner_sub = ? AND completed_at IS NOT NULL ORDER BY completed_at",
        (owner_sub,),
    ).fetchall()
    return [r["lesson_id"] for r in rows]
