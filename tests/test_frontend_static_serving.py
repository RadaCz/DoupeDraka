import tempfile
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.database_url import normalize_database_url
from app.frontend_static import mount_frontend_app
from app.http_middleware import strip_api_and_v1_prefix


def test_settings_normalizes_postgres_url(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "postgres://u:p@db.example/railway")
    from app.settings import Settings

    settings = Settings()
    assert settings.database_url == "postgresql+asyncpg://u:p@db.example/railway"


def test_normalize_database_url_unit():
    assert normalize_database_url("postgresql://x") == "postgresql+asyncpg://x"


@pytest.fixture()
def spa_client(tmp_path):
    dist = tmp_path / "dist"
    dist.mkdir()
    (dist / "index.html").write_text("<!doctype html><html><body>ok</body></html>", encoding="utf-8")
    assets = dist / "assets"
    assets.mkdir()
    (assets / "app.js").write_text("console.log(1)", encoding="utf-8")

    app = FastAPI()
    app.middleware("http")(strip_api_and_v1_prefix)

    @app.get("/health")
    def health():
        return {"status": "ok"}

    @app.get("/reference")
    def reference():
        return {"ruleset": {}}

    mount_frontend_app(app, dist)
    yield TestClient(app), dist


def test_root_serves_index_when_dist_exists(spa_client):
    client, _dist = spa_client
    response = client.get("/")
    assert response.status_code == 200
    assert "text/html" in response.headers.get("content-type", "")
    assert "ok" in response.text


def test_health_still_json_with_dist(spa_client):
    client, _dist = spa_client
    response = client.get("/health")
    assert response.status_code == 200
    assert response.headers.get("content-type", "").startswith("application/json")


def test_reference_still_json_with_dist(spa_client):
    client, _dist = spa_client
    response = client.get("/reference")
    assert response.status_code == 200
    assert response.headers.get("content-type", "").startswith("application/json")


def test_unknown_api_path_returns_json_404(spa_client):
    client, _dist = spa_client
    response = client.get("/api/does-not-exist")
    assert response.status_code == 404
    assert response.json() == {"detail": "Not Found"}


def test_spa_fallback_for_client_route(spa_client):
    client, _dist = spa_client
    response = client.get("/play/session")
    assert response.status_code == 200
    assert "text/html" in response.headers.get("content-type", "")
    assert "ok" in response.text


def test_static_asset_served(spa_client):
    client, _dist = spa_client
    response = client.get("/assets/app.js")
    assert response.status_code == 200
    assert "console.log" in response.text


def test_spa_fallback_blocks_path_traversal(spa_client, tmp_path):
    client, dist = spa_client
    secret = tmp_path / "secret.txt"
    secret.write_text("BOT_TOKEN=leaked", encoding="utf-8")
    attempts = [
        "../secret.txt",
        "assets/../../secret.txt",
        "..%2f..%2fsecret.txt",
        "%2e%2e%2fsecret.txt",
        "%2e%2e/secret.txt",
        "foo%2F..%2F..%2Fsecret.txt",
    ]
    for path in attempts:
        response = client.get(f"/{path}")
        assert response.status_code == 200
        assert "text/html" in response.headers.get("content-type", "")
        assert "BOT_TOKEN=leaked" not in response.text
        assert "ok" in response.text


def test_mount_skipped_without_index():
    app = FastAPI()

    @app.get("/health")
    def health():
        return {"status": "ok"}

    empty = Path(tempfile.mkdtemp())
    mount_frontend_app(app, empty)
    client = TestClient(app)
    assert client.get("/health").json() == {"status": "ok"}
    assert client.get("/").status_code == 404