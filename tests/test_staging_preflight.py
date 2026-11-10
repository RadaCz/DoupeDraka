"""Unit tests for staging env policy checks (no real secrets)."""

from scripts.staging_preflight import check_docker_compose_policy, check_lite_staging_env


def _valid_lite_env() -> dict[str, str]:
    return {
        "DATABASE_URL": "postgresql+asyncpg://doupe:secret@postgres:5432/doupedraka",
        "BOT_TOKEN": "100000000:ZZZZZZZZZZZZZZZZZZZZZZZZZZ",
        "BOT_API_TOKEN": "internal-shared-token",
        "MINI_APP_URL": "https://play.staging.example",
        "CORS_ORIGINS": "https://play.staging.example",
        "DB_BOOTSTRAP": "none",
        "LLM_PROVIDER": "fallback",
        "VITE_API_URL": "/api",
    }


def test_lite_staging_env_ok():
    assert check_lite_staging_env(_valid_lite_env(), label="test") == []


def test_lite_staging_rejects_sqlite():
    env = _valid_lite_env()
    env["DATABASE_URL"] = "sqlite+aiosqlite:///./data/dnd.db"
    errs = check_lite_staging_env(env, label="test")
    assert any("postgresql" in e for e in errs)


def test_lite_staging_requires_cors_match():
    env = _valid_lite_env()
    env["CORS_ORIGINS"] = "https://other.example"
    errs = check_lite_staging_env(env, label="test")
    assert any("CORS_ORIGINS" in e for e in errs)


def test_lite_staging_rejects_create_all():
    env = _valid_lite_env()
    env["DB_BOOTSTRAP"] = "create_all"
    errs = check_lite_staging_env(env, label="test")
    assert any("DB_BOOTSTRAP" in e for e in errs)


def test_docker_compose_warnings_non_fatal():
    # Committed compose may warn about exposed Postgres — function returns list only.
    warnings = check_docker_compose_policy()
    assert isinstance(warnings, list)
