"""Independent Auth0 access-token verification for the FastAPI resource server.

The API never trusts the browser or the Next.js BFF to tell it who the user is:
it verifies signature (JWKS, RS256), issuer, audience, expiry and the presence
of ``sub`` on every private request.
"""
from __future__ import annotations

from typing import Any, Protocol

import jwt


class SigningKeyProvider(Protocol):
    def get_signing_key_from_jwt(self, token: str) -> Any: ...


class TokenVerificationError(Exception):
    pass


class Auth0JWTVerifier:
    ALGORITHMS = ["RS256"]

    def __init__(self, domain: str, audience: str, key_provider: SigningKeyProvider | None = None):
        self.issuer = f"https://{domain}/"
        self.audience = audience
        self._keys = key_provider or jwt.PyJWKClient(
            f"https://{domain}/.well-known/jwks.json", cache_keys=True, lifespan=3600, timeout=5
        )

    def verify(self, token: str) -> dict[str, Any]:
        try:
            signing_key = self._keys.get_signing_key_from_jwt(token)
            key = getattr(signing_key, "key", signing_key)
            claims = jwt.decode(
                token,
                key,
                algorithms=self.ALGORITHMS,
                audience=self.audience,
                issuer=self.issuer,
                leeway=30,
                options={"require": ["exp", "iat", "iss", "aud", "sub"]},
            )
        except jwt.PyJWTError as exc:  # includes expired, bad audience/issuer/signature
            raise TokenVerificationError(type(exc).__name__) from exc
        except Exception as exc:  # JWKS fetch failures etc. Never leak token contents.
            raise TokenVerificationError("jwks_unavailable") from exc
        sub = claims.get("sub")
        if not isinstance(sub, str) or not sub or len(sub) > 255:
            raise TokenVerificationError("invalid_sub")
        return claims
