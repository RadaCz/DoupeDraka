"""Shared test fixtures.

The suite never touches the player's live database.

``DATABASE_URL`` is rewritten to a throwaway SQLite file under the system temp
directory *before* ``app.db.engine`` is imported, so every module that binds the
engine lands on the scratch file instead of ``./data/dnd.db``.

pytest-asyncio runs in strict mode here, so the schema is created through
``asyncio.run`` inside a plain session fixture. Async autouse drain uses
``pytest_asyncio.fixture`` so only ``@pytest.mark.asyncio`` tests pay the cost.
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
# Session fixture runs init_db(); disable FastAPI startup bootstrap to avoid parallel SQLite writers.
os.environ["DB_BOOTSTRAP"] = "none"
# aiosqlite + TestClient use many ephemeral event loops; never pool SQLite across them.
os.environ["DOUPE_TEST_DB"] = "1"

import pytest  # noqa: E402
import pytest_asyncio  # noqa: E402

import app.api as app_api  # noqa: E402
import app.db as app_db  # noqa: E402
def _assert_isolated() -> None:
    """Hard stop if anything points the engine at the player's live database."""
    url = str(app_db.engine.url)
    if os.path.abspath(_LIVE_DB) in url or "data/dnd.db" in url.replace("\\", "/"):
        raise RuntimeError(
            "Refusing to run the suite against the live database: " + url
        )


_assert_isolated()


def _patch_asyncio_run_for_telemetry() -> None:
    """asyncio.run() tests must not close the loop before fire-and-forget analytics DB tasks finish."""

    original_run = asyncio.run

    def run(main, *, debug=None):
        async def wrapped():
            try:
                return await main
            finally:
                from tests._async_drain import drain_pending_asyncio_tasks

                await drain_pending_asyncio_tasks()

        return original_run(wrapped(), debug=debug)

    asyncio.run = run  # type: ignore[misc, assignment]


_patch_asyncio_run_for_telemetry()


@app_api.app.middleware("http")
async def _drain_test_analytics_after_http_request(request, call_next):
    """Finish scheduled analytics on the same loop TestClient uses for this request."""
    try:
        return await call_next(request)
    finally:
        from app.telemetry import drain_scheduled_analytics_events

        await drain_scheduled_analytics_events()


@pytest.fixture(scope="session", autouse=True)
def isolated_database():
    _assert_isolated()

    if not _USE_ALEMBIC_DB:
        from app.db import init_db

        async def bootstrap() -> None:
            await init_db()
            # Close aiosqlite worker/loop pairing from bootstrap before tests open their own loops.
            await app_db.engine.dispose()

        asyncio.run(bootstrap())
    yield _TEST_DB_PATH

    async def shutdown() -> None:
        await app_db.engine.dispose()

    asyncio.run(shutdown())
    try:
        os.remove(_TEST_DB_PATH)
    except OSError:
        pass


@pytest_asyncio.fixture(autouse=True)
async def drain_analytics_after_asyncio_test():
    """Runs on pytest-asyncio's loop after each @pytest.mark.asyncio test."""
    yield
    from app.telemetry import drain_scheduled_analytics_events

    await drain_scheduled_analytics_events()


@pytest.fixture(autouse=True)
def clear_rate_limit_counters():
    app_api.limiter.reset()
    yield
    app_api.limiter.reset()


@pytest.fixture(autouse=True)
def reset_async_engine_pool_between_tests():
    """Postgres: drop asyncpg handles bound to a closed loop.

    SQLite tests use NullPool (no cross-loop reuse). Per-test dispose here races
    aiosqlite worker threads and can raise 'Event loop is closed' on teardown.
    """
    yield
    if _USE_ALEMBIC_DB:
        asyncio.run(app_db.engine.dispose())
