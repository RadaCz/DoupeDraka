"""PostgreSQL regression: v005 backfill from a v004-era nullable timestamp schema."""

from __future__ import annotations

import os
import subprocess
import uuid
from pathlib import Path

import pytest
from sqlalchemy import create_engine, inspect, text

ROOT = Path(__file__).resolve().parents[1]


def _require_postgres_url() -> str:
    url = os.environ.get("PYTEST_DATABASE_URL", "").strip()
    if not url or "postgresql" not in url:
        pytest.skip("PYTEST_DATABASE_URL must be a PostgreSQL URL for migration regression")
    return url.replace("postgresql+asyncpg://", "postgresql://", 1)


def _admin_url(sync_url: str) -> str:
    """Connect to the maintenance DB to create an isolated test database."""
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
def test_v005_upgrade_backfills_nulls_preserves_rows_and_passes_check():
    """Simulate legacy NULL timestamps at v004, then upgrade and verify NOT NULL + alembic check."""
    base_sync = _require_postgres_url()
    db_name = f"mig_v005_{uuid.uuid4().hex[:10]}"
    admin_engine = create_engine(_admin_url(base_sync), isolation_level="AUTOCOMMIT")
    test_url = base_sync.rsplit("/", 1)[0] + f"/{db_name}"

    try:
        with admin_engine.connect() as conn:
            conn.execute(text(f'CREATE DATABASE "{db_name}"'))

        _run_alembic(test_url, "upgrade", "v004")

        engine = create_engine(test_url)
        with engine.begin() as conn:
            conn.execute(
                text(
                    "INSERT INTO users (username, hashed_password, energy_tenths, model_tier, created_at) "
                    "VALUES ('legacy-null', 'hash', 1000, 'lite', NULL)"
                )
            )
            row = conn.execute(text("SELECT id, username FROM users WHERE username = 'legacy-null'")).one()
            legacy_id = row.id
            conn.execute(
                text(
                    "INSERT INTO api_keys (user_id, token_hash, created_at) "
                    "VALUES (:uid, 'legacy-key-hash', NULL)"
                ),
                {"uid": legacy_id},
            )

        _run_alembic(test_url, "upgrade", "head")
        _run_alembic(test_url, "check")

        with engine.connect() as conn:
            refreshed = conn.execute(
                text("SELECT created_at FROM users WHERE id = :id"),
                {"id": legacy_id},
            ).one()
            assert refreshed.created_at is not None
            nulls = conn.execute(
                text(
                    "SELECT COUNT(*) FROM users WHERE created_at IS NULL"
                )
            ).scalar_one()
            assert nulls == 0
            api_key_created = conn.execute(
                text("SELECT created_at FROM api_keys WHERE token_hash = 'legacy-key-hash'")
            ).one()
            assert api_key_created.created_at is not None

        inspector = inspect(engine)
        for table, column in (
            ("users", "created_at"),
            ("energy_transactions", "created_at"),
            ("api_keys", "created_at"),
            ("characters", "updated_at"),
            ("action_receipts", "created_at"),
            ("analytics_events", "created_at"),
            ("events", "created_at"),
        ):
            col = next(item for item in inspector.get_columns(table) if item["name"] == column)
            assert col["nullable"] is False, f"{table}.{column} should be NOT NULL after v005"

        _run_alembic(test_url, "downgrade", "v004")
        _run_alembic(test_url, "upgrade", "head")
    finally:
        engine.dispose() if "engine" in locals() else None
        with admin_engine.connect() as conn:
            conn.execute(
                text(
                    f'SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = :dbname AND pid <> pg_backend_pid()'
                ),
                {"dbname": db_name},
            )
            conn.execute(text(f'DROP DATABASE IF EXISTS "{db_name}"'))
        admin_engine.dispose()
