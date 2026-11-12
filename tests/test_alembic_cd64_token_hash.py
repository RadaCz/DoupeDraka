"""PostgreSQL: cd64a95bf304 migrates plaintext api_keys.token → SHA-256 token_hash."""

from __future__ import annotations

import hashlib
import os
import secrets
import subprocess
import uuid
from pathlib import Path

import pytest
from sqlalchemy import create_engine, inspect, text

ROOT = Path(__file__).resolve().parents[1]


def _hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


def _require_postgres_url() -> str:
    url = os.environ.get("PYTEST_DATABASE_URL", "").strip()
    if not url or "postgresql" not in url:
        pytest.skip("PYTEST_DATABASE_URL must be a PostgreSQL URL for migration regression")
    return url.replace("postgresql+asyncpg://", "postgresql://", 1)


def _admin_url(sync_url: str) -> str:
    head, _slash, tail = sync_url.rpartition("/")
    return f"{head}/postgres"


def _run_alembic(database_url: str, *args: str) -> None:
    env = {**os.environ, "DATABASE_URL": database_url.replace("postgresql://", "postgresql+asyncpg://", 1)}
    result = subprocess.run(
        ["alembic", *args],
        cwd=ROOT,
        env=env,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        raise AssertionError(
            f"alembic {' '.join(args)} failed:\n{result.stdout}\n{result.stderr}"
        )


@pytest.mark.filterwarnings("ignore::DeprecationWarning")
def test_cd64_hashes_plain_tokens_preserves_auth_and_idempotent_upgrade():
    base_sync = _require_postgres_url()
    db_name = f"mig_cd64_{uuid.uuid4().hex[:10]}"
    admin_engine = create_engine(_admin_url(base_sync), isolation_level="AUTOCOMMIT")
    test_url = base_sync.rsplit("/", 1)[0] + f"/{db_name}"

    engine = None
    try:
        with admin_engine.connect() as conn:
            conn.execute(text(f'CREATE DATABASE "{db_name}"'))

        _run_alembic(test_url, "upgrade", "auth001")
        plain_a = secrets.token_urlsafe(24)
        plain_b = secrets.token_urlsafe(24)
        blank_row_token = ""

        engine = create_engine(test_url)
        with engine.begin() as conn:
            user_id = conn.execute(
                text(
                    "INSERT INTO users (username, hashed_password, created_at) "
                    "VALUES ('plain-key-user', 'x', NOW()) RETURNING id"
                )
            ).scalar_one()
            conn.execute(
                text(
                    "INSERT INTO api_keys (token, user_id, created_at) VALUES (:t, :uid, NOW())"
                ),
                {"t": plain_a, "uid": user_id},
            )
            conn.execute(
                text(
                    "INSERT INTO api_keys (token, user_id, created_at) VALUES (:t, :uid, NOW())"
                ),
                {"t": plain_b, "uid": user_id},
            )
            conn.execute(
                text(
                    "INSERT INTO api_keys (token, user_id, created_at) VALUES (:t, :uid, NOW())"
                ),
                {"t": blank_row_token, "uid": user_id},
            )

        _run_alembic(test_url, "upgrade", "cd64a95bf304")

        with engine.connect() as conn:
            hashes = {
                row.token_hash
                for row in conn.execute(text("SELECT token_hash FROM api_keys ORDER BY token_hash")).all()
            }
            assert _hash_token(plain_a) in hashes
            assert _hash_token(plain_b) in hashes
            assert plain_a not in hashes
            assert plain_b not in hashes
            assert blank_row_token not in hashes
            assert len(hashes) == 2

            cols = {c["name"] for c in inspect(engine).get_columns("api_keys")}
            assert "token" not in cols
            assert "token_hash" in cols

        _run_alembic(test_url, "upgrade", "head")
        with engine.connect() as conn:
            count = conn.execute(text("SELECT COUNT(*) FROM api_keys")).scalar_one()
            assert count == 2
    finally:
        if engine is not None:
            engine.dispose()
        with admin_engine.connect() as conn:
            conn.execute(
                text(
                    "SELECT pg_terminate_backend(pid) FROM pg_stat_activity "
                    "WHERE datname = :dbname AND pid <> pg_backend_pid()"
                ),
                {"dbname": db_name},
            )
            conn.execute(text(f'DROP DATABASE IF EXISTS "{db_name}"'))
        admin_engine.dispose()
