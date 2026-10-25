import time
from types import SimpleNamespace

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi.testclient import TestClient

from app.auth.dependencies import Principal
from app.auth.jwt_verifier import Auth0JWTVerifier
from app.auth.permissions import require_owned
from app.config import Settings
from app.errors import ApiError
from app.main import create_app


@pytest.fixture
def auth_api(tmp_path):
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    settings = Settings(database_path=str(tmp_path / "test.sqlite3"),
                        auth0_domain="test.auth0.com", auth0_audience="https://clarity-api")
    app = create_app(settings)

    class Keys:
        def get_signing_key_from_jwt(self, token):
            return SimpleNamespace(key=key.public_key())

    app.state.jwt_verifier = Auth0JWTVerifier(settings.auth0_domain, settings.auth0_audience, Keys())

    def token(**changes):
        claims = {"sub": "auth0|alice", "iss": "https://test.auth0.com/",
                  "aud": "https://clarity-api", "iat": int(time.time()), "exp": int(time.time()) + 300}
        claims.update(changes)
        return jwt.encode(claims, key, algorithm="RS256")

    with TestClient(app) as client:
        yield client, token


def test_private_route_rejects_anonymous_and_demo_bypass(auth_api):
    client, _ = auth_api
    assert client.get("/health").status_code == 200
    assert client.get("/api/me").status_code == 401
    assert client.get("/api/me", headers={"X-Fork-Demo-Session": "a" * 32}).status_code == 401


def test_valid_token_resolves_verified_identity(auth_api):
    client, token = auth_api
    response = client.get("/api/me", headers={"Authorization": f"Bearer {token()}"})
    assert response.status_code == 200
    assert response.json() == {"sub": "auth0|alice", "auth_mode": "auth0"}


@pytest.mark.parametrize("claims", [
    {"aud": "another-api"}, {"iss": "https://attacker.example/"},
    {"exp": 1}, {"sub": ""}, {"iat": int(time.time()) + 3600},
])
def test_invalid_claims_are_rejected(auth_api, claims):
    client, token = auth_api
    assert client.get("/api/me", headers={"Authorization": f"Bearer {token(**claims)}"}).status_code == 401


def test_forged_signature_is_rejected(auth_api):
    client, _ = auth_api
    other = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    forged = jwt.encode({"sub": "auth0|alice", "iss": "https://test.auth0.com/",
                         "aud": "https://clarity-api", "iat": int(time.time()),
                         "exp": int(time.time()) + 300}, other, algorithm="RS256")
    assert client.get("/api/me", headers={"Authorization": f"Bearer {forged}"}).status_code == 401


def test_foreign_records_are_hidden():
    with pytest.raises(ApiError) as error:
        require_owned({"owner_sub": "auth0|bob"}, Principal("auth0|alice", "auth0"))
    assert error.value.status_code == 404
