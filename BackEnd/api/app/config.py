"""Runtime configuration, read from environment variables (see .env.example).

Settings are attached to ``app.state.settings`` so tests can build an app with
isolated settings instead of mutating global state.
"""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

try:  # optional: load BackEnd/api/.env for local development
    from dotenv import load_dotenv

    load_dotenv(Path(__file__).resolve().parents[1] / ".env")
except ImportError:  # pragma: no cover
    pass

API_ROOT = Path(__file__).resolve().parents[1]
FIXTURES_DIR = Path(__file__).resolve().parent / "fixtures"


def _bool(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None or raw == "":
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, default))
    except (TypeError, ValueError):
        return default


@dataclass(frozen=True)
class Settings:
    env: str = "development"
    database_path: str = str(API_ROOT / "data" / "fork_private.sqlite3")
    # Auth0 API (resource server) settings. Both required for real JWT validation.
    auth0_domain: str | None = None
    auth0_audience: str | None = None
    # Dev-only synthetic preview. MUST be false in any judged/production deploy
    # that claims Auth0 protection.
    demo_mode_enabled: bool = False
    gemini_api_key: str | None = field(default=None, repr=False)
    gemini_model: str = "gemini-3.6-flash"
    gemini_timeout_s: int = 20
    gemini_max_output_tokens: int = 1024
    ai_requests_per_user_per_hour: int = 40
    warehouse_path: str = str(API_ROOT.parent / "data_pipeline" / "warehouse" / "fork_public.duckdb")
    cors_origins: tuple[str, ...] = ("http://localhost:3000",)

    @property
    def auth0_configured(self) -> bool:
        return bool(self.auth0_domain and self.auth0_audience)

    @property
    def gemini_configured(self) -> bool:
        return bool(self.gemini_api_key)


def load_settings() -> Settings:
    origins = tuple(o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",") if o.strip())
    domain = (os.getenv("AUTH0_DOMAIN") or "").replace("https://", "").rstrip("/") or None
    return Settings(
        env=os.getenv("FORK_ENV", "development"),
        database_path=os.getenv("DATABASE_PATH", Settings.database_path),
        auth0_domain=domain,
        auth0_audience=os.getenv("AUTH0_AUDIENCE") or None,
        demo_mode_enabled=_bool("DEMO_MODE_ENABLED", False),
        gemini_api_key=os.getenv("GEMINI_API_KEY") or None,
        gemini_model=os.getenv("GEMINI_MODEL", Settings.gemini_model),
        gemini_timeout_s=_int("GEMINI_TIMEOUT_S", 20),
        gemini_max_output_tokens=_int("GEMINI_MAX_OUTPUT_TOKENS", 1024),
        ai_requests_per_user_per_hour=_int("AI_REQUESTS_PER_USER_PER_HOUR", 40),
        warehouse_path=os.getenv("WAREHOUSE_PATH", Settings.warehouse_path),
        cors_origins=origins,
    )
