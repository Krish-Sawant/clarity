"""Runnable resource server. Private routes must depend on current_user."""
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.auth.dependencies import Principal, current_user
from app.auth.jwt_verifier import Auth0JWTVerifier
from app.config import Settings, load_settings
from app.errors import install_error_handlers
from app.repositories.database import init_db


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or load_settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        init_db(settings.database_path, questions=[], lessons=[])
        yield

    app = FastAPI(title="Clarity API", lifespan=lifespan)
    app.state.settings = settings
    app.state.jwt_verifier = (
        Auth0JWTVerifier(settings.auth0_domain, settings.auth0_audience)
        if settings.auth0_configured else None
    )
    install_error_handlers(app)
    app.add_middleware(
        CORSMiddleware, allow_origins=list(settings.cors_origins),
        allow_methods=["GET"], allow_headers=["Authorization"],
    )

    @app.get("/health")
    def health():
        return {"status": "ok", "auth0_configured": settings.auth0_configured}

    @app.get("/api/me")
    def me(principal: Principal = Depends(current_user)):
        return {"sub": principal.sub, "auth_mode": principal.auth_mode}

    return app


app = create_app()
