"""Ownership checks. Missing and foreign records both return 404 so that ids
cannot be enumerated across users."""
from __future__ import annotations

from typing import Any

from app.auth.dependencies import Principal
from app.errors import ApiError


def require_owned(record: Any, principal: Principal, *, owner_field: str = "owner_sub", what: str = "record") -> Any:
    if record is None:
        raise ApiError(404, "not_found", f"{what.capitalize()} not found.")
    owner = record[owner_field] if not isinstance(record, dict) else record.get(owner_field)
    if owner != principal.sub:
        raise ApiError(404, "not_found", f"{what.capitalize()} not found.")
    return record
