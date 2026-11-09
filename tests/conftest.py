"""Shared test fixtures.

The suite never touches the player's live database.

``DATABASE_URL`` is rewritten to a throwaway SQLite file under the system temp
directory *before* ``app.db.engine`` is imported, so every module that binds the
engine lands on the scratch file instead of ``./data/dnd.db``.

pytest-asyncio runs in strict mode here, so the schema is created through
``asyncio.run`` inside a plain session fixture rather than an async one --
autouse async fixtures are not supported by pytest itself.
"""

import asyncio
import os
import tempfile
import uuid

assert not os.environ.get("PYTEST_CURRENT_TEST"), "conftest imported mid-run"

_TEST_DB_DIR = tempfile.mkdtemp(prefix="doupe-tests-")
_TEST_DB_PATH = os.path.join(_TEST_DB_DIR, f"test-{uuid.uuid4().hex}.db")
_LIVE_DB = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data", "dnd.db"))

_postgres = os.environ.get("PYTEST_DATABASE_URL", "").strip()
_USE_ALEMBIC_DB = bool(_postgres)
if _postgres:
    os.environ["DATABASE_URL"] = _postgres
else:
    os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///" + _TEST_DB_PATH.replace(os.sep, "/")
os.environ.setdefault("LLM_PROVIDER", "fallback")

import pytest  # noqa: E402

import app.api as app_api  # noqa: E402
import app.db as app_db  # noqa: E402
from app.db import Base as _Base  # noqa: E402


def _assert_isolated() -> None:
    """Hard stop if anything points the engine at the player's live database."""
    url = str(app_db.engine.url)
    if os.path.abspath(_LIVE_DB) in url or "data/dnd.db" in url.replace("\\", "/"):
        raise RuntimeError(
            "Refusing to run the suite against the live database: " + url
        )


_assert_isolated()


@pytest.fixture(scope="session", autouse=True)
def isolated_database():
    _assert_isolated()

    if not _USE_ALEMBIC_DB:
        async def create() -> None:
            async with app_db.engine.begin() as connection:
                await connection.run_sync(_Base.metadata.create_all)

        asyncio.run(create())
    yield _TEST_DB_PATH

    async def dispose() -> None:
        await app_db.engine.dispose()

    asyncio.run(dispose())
    try:
        os.remove(_TEST_DB_PATH)
    except OSError:
        pass


@pytest.fixture(autouse=True)
def clear_rate_limit_counters():
    app_api.limiter.reset()
    yield
    app_api.limiter.reset()


@pytest.fixture(autouse=True)
def reset_async_engine_pool_between_tests():
    """Postgres CI: drop asyncpg connections bound to a closed event loop."""
    yield
    if _USE_ALEMBIC_DB:
        asyncio.run(app_db.engine.dispose())
