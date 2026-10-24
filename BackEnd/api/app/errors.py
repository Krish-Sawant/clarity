"""Structured error helpers. Every error body looks like
``{"error": {"code": "...", "message": "...", "details": ...}}``.
"""
from __future__ import annotations

from typing import Any

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse


class ApiError(HTTPException):
    def __init__(self, status_code: int, code: str, message: str, details: Any = None):
        super().__init__(status_code=status_code, detail={"code": code, "message": message, "details": details})


def install_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(HTTPException)
    async def _http(_: Request, exc: HTTPException):  # noqa: ANN202
        detail = exc.detail
        if not isinstance(detail, dict) or "code" not in detail:
            detail = {"code": f"http_{exc.status_code}", "message": str(detail), "details": None}
        return JSONResponse(status_code=exc.status_code, content={"error": detail}, headers=getattr(exc, "headers", None))

    @app.exception_handler(RequestValidationError)
    async def _validation(_: Request, exc: RequestValidationError):  # noqa: ANN202
        details = [
            {"loc": [str(p) for p in e.get("loc", [])], "msg": e.get("msg"), "type": e.get("type")}
            for e in exc.errors()
        ]
        return JSONResponse(
            status_code=422,
            content={"error": {"code": "validation_error", "message": "Request failed validation.", "details": details}},
        )
