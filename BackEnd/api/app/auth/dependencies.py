"""FastAPI dependencies that resolve the authenticated principal.

Two identity sources exist and they are never confused:

* ``auth0`` — a Bearer access token verified by :class:`Auth0JWTVerifier`.
* ``demo``  — DEV ONLY. Enabled solely when ``DEMO_MODE_ENABLED=true``. The
  Next.js BFF sends an opaque random session id in ``X-Fork-Demo-Session``;
  records are namespaced under ``demo|<id>`` and hold synthetic data only.
  The UI labels this mode "DEMO MODE — not Auth0".

Callers can never supply a raw user id.
"""
from __future__ import annotations

import re
import sqlite3
from collections.abc import Iterator
from dataclasses import dataclass
from typing import Literal

from fastapi import Depends, Header, Request

from app.auth.jwt_verifier import TokenVerificationError
from app.errors import ApiError
from app.repositories import database

DEMO_SESSION_RE = re.compile(r"^[A-Za-z0-9_-]{16,64}$")


@dataclass(frozen=True)
class Principal:
    sub: str
    auth_mode: Literal["auth0", "demo"]


def get_db(request: Request) -> Iterator[sqlite3.Connection]:
    conn = database.connect(request.app.state.settings.database_path)
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def get_principal(
    request: Request,
    authorization: str | None = Header(default=None),
    x_fork_demo_session: str | None = Header(default=None),
) -> Principal:
    settings = request.app.state.settings
    if authorization:
        scheme, _, token = authorization.partition(" ")
        if scheme.lower() != "bearer" or not token:
            raise ApiError(401, "invalid_authorization_header", "Expected 'Authorization: Bearer <token>'.")
        verifier = request.app.state.jwt_verifier
        if verifier is None:
            raise ApiError(401, "auth0_not_configured", "This API is not configured to accept Auth0 tokens.")
        try:
            claims = verifier.verify(token)
        except TokenVerificationError as exc:
            raise ApiError(401, "invalid_token", f"Access token rejected ({exc}).") from None
        return Principal(sub=claims["sub"], auth_mode="auth0")

    if x_fork_demo_session is not None:
        if not settings.demo_mode_enabled:
            raise ApiError(401, "demo_mode_disabled", "Demo mode is disabled on this server. Sign in with Auth0.")
        if not DEMO_SESSION_RE.fullmatch(x_fork_demo_session):
            raise ApiError(401, "invalid_demo_session", "Malformed demo session.")
        return Principal(sub=f"demo|{x_fork_demo_session}", auth_mode="demo")

    raise ApiError(401, "not_authenticated", "Authentication required.", None)


def current_user(
    principal: Principal = Depends(get_principal),
    conn: sqlite3.Connection = Depends(get_db),
) -> Principal:
    """Resolve the principal and make sure a ``users`` row exists for it."""
    conn.execute(
        "INSERT OR IGNORE INTO users(auth0_sub, auth_mode, created_at) VALUES (?, ?, ?)",
        (principal.sub, principal.auth_mode, database.now_iso()),
    )
    return principal
