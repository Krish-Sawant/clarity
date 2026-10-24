"""Private application database (SQLite for the MVP).

Holds ONLY private per-user records keyed by the verified Auth0 ``sub``.
Public educational content lives in the separate DuckDB warehouse built by
``BackEnd/data_pipeline``; private data is never copied there.
"""
from __future__ import annotations

import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

SCHEMA = """
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
    auth0_sub   TEXT PRIMARY KEY,
    auth_mode   TEXT NOT NULL CHECK (auth_mode IN ('auth0','demo')),
    created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS assessment_questions (
    id                TEXT NOT NULL,
    version           TEXT NOT NULL,
    stage             TEXT NOT NULL CHECK (stage IN ('baseline','checkpoint')),
    domain            TEXT NOT NULL,
    concept_id        TEXT NOT NULL,
    difficulty        INTEGER NOT NULL,
    points            INTEGER NOT NULL,
    pairs_with        TEXT,
    prompt            TEXT NOT NULL,
    options_json      TEXT NOT NULL,
    correct_option_id TEXT NOT NULL,
    explanation       TEXT NOT NULL,
    PRIMARY KEY (id, version)
);

CREATE TABLE IF NOT EXISTS assessment_sessions (
    id                  TEXT PRIMARY KEY,
    owner_sub           TEXT NOT NULL REFERENCES users(auth0_sub) ON DELETE CASCADE,
    stage               TEXT NOT NULL CHECK (stage IN ('baseline','checkpoint')),
    mode                TEXT NOT NULL CHECK (mode IN ('full','quick')),
    bank_version        TEXT NOT NULL,
    question_ids_json   TEXT NOT NULL,
    baseline_session_id TEXT REFERENCES assessment_sessions(id) ON DELETE CASCADE,
    created_at          TEXT NOT NULL,
    finalized_at        TEXT,
    result_json         TEXT
);
CREATE INDEX IF NOT EXISTS ix_sessions_owner ON assessment_sessions(owner_sub, stage, created_at);

CREATE TABLE IF NOT EXISTS answer_attempts (
    session_id         TEXT NOT NULL REFERENCES assessment_sessions(id) ON DELETE CASCADE,
    question_id        TEXT NOT NULL,
    question_version   TEXT NOT NULL,
    concept_id         TEXT NOT NULL,
    selected_option_id TEXT,
    was_correct        INTEGER,
    elapsed_ms         INTEGER,
    answered_at        TEXT NOT NULL,
    PRIMARY KEY (session_id, question_id)
);

CREATE TABLE IF NOT EXISTS checkpoint_links (
    checkpoint_session_id  TEXT NOT NULL REFERENCES assessment_sessions(id) ON DELETE CASCADE,
    baseline_session_id    TEXT NOT NULL REFERENCES assessment_sessions(id) ON DELETE CASCADE,
    concept_id             TEXT NOT NULL,
    baseline_question_id   TEXT NOT NULL,
    checkpoint_question_id TEXT NOT NULL,
    PRIMARY KEY (checkpoint_session_id, concept_id)
);

CREATE TABLE IF NOT EXISTS habit_surveys (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_sub    TEXT NOT NULL REFERENCES users(auth0_sub) ON DELETE CASCADE,
    answers_json TEXT NOT NULL,
    created_at   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS lessons (
    id               TEXT NOT NULL,
    version          TEXT NOT NULL,
    domain           TEXT NOT NULL,
    title            TEXT NOT NULL,
    source_ids_json  TEXT NOT NULL,
    PRIMARY KEY (id, version)
);

CREATE TABLE IF NOT EXISTS learning_plans (
    id                   TEXT PRIMARY KEY,
    owner_sub            TEXT NOT NULL REFERENCES users(auth0_sub) ON DELETE CASCADE,
    baseline_session_id  TEXT NOT NULL REFERENCES assessment_sessions(id) ON DELETE CASCADE,
    plan_json            TEXT NOT NULL,
    created_at           TEXT NOT NULL,
    UNIQUE (owner_sub, baseline_session_id)
);

CREATE TABLE IF NOT EXISTS lesson_progress (
    owner_sub          TEXT NOT NULL REFERENCES users(auth0_sub) ON DELETE CASCADE,
    lesson_id          TEXT NOT NULL,
    lesson_version     TEXT NOT NULL,
    exercise_state_json TEXT,
    reflection_option_id TEXT,
    reflection_correct INTEGER,
    started_at         TEXT NOT NULL,
    completed_at       TEXT,
    PRIMARY KEY (owner_sub, lesson_id)
);

CREATE TABLE IF NOT EXISTS saved_scenarios (
    id           TEXT PRIMARY KEY,
    owner_sub    TEXT NOT NULL REFERENCES users(auth0_sub) ON DELETE CASCADE,
    name         TEXT NOT NULL,
    inputs_json  TEXT NOT NULL,
    created_at   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS action_proposals (
    id               TEXT PRIMARY KEY,
    owner_sub        TEXT NOT NULL REFERENCES users(auth0_sub) ON DELETE CASCADE,
    kind             TEXT NOT NULL,
    title            TEXT NOT NULL,
    summary          TEXT NOT NULL,
    payload_json     TEXT NOT NULL,
    status           TEXT NOT NULL CHECK (status IN ('pending','executed','denied','expired')),
    idempotency_key  TEXT NOT NULL,
    summary_source   TEXT NOT NULL,
    created_at       TEXT NOT NULL,
    expires_at       TEXT NOT NULL,
    decided_at       TEXT,
    UNIQUE (owner_sub, idempotency_key)
);

CREATE TABLE IF NOT EXISTS demo_reminders (
    id           TEXT PRIMARY KEY,
    owner_sub    TEXT NOT NULL REFERENCES users(auth0_sub) ON DELETE CASCADE,
    proposal_id  TEXT NOT NULL UNIQUE REFERENCES action_proposals(id) ON DELETE CASCADE,
    title        TEXT NOT NULL,
    due_at       TEXT NOT NULL,
    created_at   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_events (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_sub   TEXT NOT NULL REFERENCES users(auth0_sub) ON DELETE CASCADE,
    action      TEXT NOT NULL,
    outcome     TEXT NOT NULL,
    target_id   TEXT,
    detail      TEXT,
    created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_audit_owner ON audit_events(owner_sub, created_at);
"""


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def connect(path: str) -> sqlite3.Connection:
    if path != ":memory:":
        Path(path).parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path, check_same_thread=False, timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    return conn


def init_db(path: str, *, questions: list[dict], lessons: list[dict]) -> None:
    """Create tables and (re)seed published, versioned content."""
    conn = connect(path)
    try:
        conn.executescript(SCHEMA)
        for q in questions:
            conn.execute(
                """INSERT OR REPLACE INTO assessment_questions
                (id, version, stage, domain, concept_id, difficulty, points, pairs_with, prompt,
                 options_json, correct_option_id, explanation)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?)""",
                (
                    q["id"], q["version"], q["stage"], q["domain"], q["concept_id"], q["difficulty"], q["points"],
                    q.get("pairs_with"), q["prompt"], json.dumps(q["options"]), q["correct_option_id"], q["explanation"],
                ),
            )
        for lesson in lessons:
            conn.execute(
                "INSERT OR REPLACE INTO lessons (id, version, domain, title, source_ids_json) VALUES (?,?,?,?,?)",
                (lesson["id"], lesson["version"], lesson["domain"], lesson["title"], json.dumps(lesson["source_ids"])),
            )
        conn.commit()
    finally:
        conn.close()
