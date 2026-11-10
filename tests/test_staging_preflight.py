"""Unit tests for staging env and Compose exposure checks (no Telegram-token-shaped fixtures)."""

from pathlib import Path

import pytest

from scripts.staging_preflight import (
    check_lite_staging_env,
    check_local_compose_warnings,
    check_staging_compose_files,
    check_staging_network_bindings,
    merge_compose_port_bindings,
)


def _valid_lite_env() -> dict[str, str]:
    return {
        "DATABASE_URL": "postgresql+asyncpg://doupe:staging-db-secret@postgres:5432/doupedraka",
        "POSTGRES_USER": "doupe",
        "POSTGRES_PASSWORD": "staging-db-secret",
        "POSTGRES_DB": "doupedraka",
        "BOT_TOKEN": "staging-test-bot-token-not-a-telegram-secret",
        "BOT_API_TOKEN": "internal-shared-token",
        "MINI_APP_URL": "https://play.staging.example",
        "CORS_ORIGINS": "https://play.staging.example",
        "DB_BOOTSTRAP": "none",
        "LLM_PROVIDER": "fallback",
        "VITE_API_URL": "/api",
    }


def test_lite_staging_env_ok():
    assert check_lite_staging_env(_valid_lite_env(), label="test", mode="staging") == []


def test_lite_staging_rejects_sqlite():
    env = _valid_lite_env()
    env["DATABASE_URL"] = "sqlite+aiosqlite:///./data/dnd.db"
    errs = check_lite_staging_env(env, label="test", mode="staging")
    assert any("SQLite" in e for e in errs)


def test_lite_staging_rejects_bare_postgresql_url():
    env = _valid_lite_env()
    env["DATABASE_URL"] = "postgresql://doupe:staging-db-secret@postgres:5432/doupedraka"
    errs = check_lite_staging_env(env, label="test", mode="staging")
    assert any("asyncpg" in e for e in errs)


def test_lite_staging_rejects_db_password_mismatch():
    env = _valid_lite_env()
    env["POSTGRES_PASSWORD"] = "other-password"
    errs = check_lite_staging_env(env, label="test", mode="staging")
    assert any("password must match" in e for e in errs)


def test_lite_staging_rejects_missing_bot_token():
    env = _valid_lite_env()
    env["BOT_TOKEN"] = ""
    errs = check_lite_staging_env(env, label="test", mode="staging")
    assert any("BOT_TOKEN" in e for e in errs)


def test_lite_staging_rejects_placeholder():
    env = _valid_lite_env()
    env["BOT_TOKEN"] = "your_telegram_bot_token_here"
    errs = check_lite_staging_env(env, label="test", mode="staging")
    assert any("placeholder" in e for e in errs)


def test_lite_staging_rejects_http_mini_app_url():
    env = _valid_lite_env()
    env["MINI_APP_URL"] = "http://play.staging.example"
    errs = check_lite_staging_env(env, label="test", mode="staging")
    assert any("HTTPS" in e for e in errs)


def test_lite_staging_requires_cors_match():
    env = _valid_lite_env()
    env["CORS_ORIGINS"] = "https://other.example"
    errs = check_lite_staging_env(env, label="test", mode="staging")
    assert any("CORS_ORIGINS" in e for e in errs)


def test_lite_staging_rejects_create_all():
    env = _valid_lite_env()
    env["DB_BOOTSTRAP"] = "create_all"
    errs = check_lite_staging_env(env, label="test", mode="staging")
    assert any("DB_BOOTSTRAP" in e for e in errs)


def test_lite_staging_rejects_llm_provider_auto():
    env = _valid_lite_env()
    env["LLM_PROVIDER"] = "auto"
    errs = check_lite_staging_env(env, label="test", mode="staging")
    assert any("LLM_PROVIDER" in e for e in errs)


def test_staging_rejects_public_postgres_port():
    from scripts.staging_preflight import PortPublish

    bindings = {
        "postgres": [PortPublish("0.0.0.0", 5432, 5432)],
        "api": [],
        "frontend": [
            __import__("scripts.staging_preflight", fromlist=["PortPublish"]).PortPublish("127.0.0.1", 5173, 80)
        ],
        "bot": [],
    }
    errs = check_staging_network_bindings(bindings)
    assert any("postgres" in e for e in errs)


def test_staging_rejects_public_api_port():
    from scripts.staging_preflight import PortPublish

    bindings = {
        "postgres": [],
        "api": [PortPublish("0.0.0.0", 8000, 8000)],
        "frontend": [PortPublish("127.0.0.1", 5173, 80)],
        "bot": [],
    }
    errs = check_staging_network_bindings(bindings)
    assert any("api" in e for e in errs)


def test_staging_rejects_public_frontend_binding():
    from scripts.staging_preflight import PortPublish

    bindings = {
        "postgres": [],
        "api": [],
        "frontend": [PortPublish("0.0.0.0", 5173, 80)],
        "bot": [],
    }
    errs = check_staging_network_bindings(bindings)
    assert any("loopback" in e.lower() or "127.0.0.1" in e for e in errs)


def test_staging_accepts_loopback_frontend_only():
    from scripts.staging_preflight import PortPublish

    bindings = {
        "postgres": [],
        "api": [],
        "frontend": [PortPublish("127.0.0.1", 5173, 80)],
        "bot": [],
    }
    assert check_staging_network_bindings(bindings) == []


def test_static_staging_compose_merge_no_public_db_api():
    root = Path(__file__).resolve().parents[1]
    base = (root / "docker-compose.yml").read_text(encoding="utf-8")
    overlay = (root / "docker-compose.staging.yml").read_text(encoding="utf-8")
    merged = merge_compose_port_bindings(base, overlay)
    assert merged.get("postgres") == []
    assert merged.get("api") == []
    assert merged.get("bot") == []
    fe = merged.get("frontend") or []
    assert len(fe) == 1
    assert fe[0].host_ip == "127.0.0.1" and fe[0].host_port == 5173


def test_staging_compose_files_static_pass():
    errors, source = check_staging_compose_files(docker_config=None)
    assert source.startswith("static")
    assert errors == []


def test_local_compose_warnings_list_dev_ports():
    warnings = check_local_compose_warnings()
    assert any("5432" in w for w in warnings)
