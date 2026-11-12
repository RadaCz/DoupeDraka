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

_SLOW_TEST_NAMES = frozenset(
    {
        "test_main_story_reaches_level_3_without_search",
        "test_main_story_optional_crypt_still_level_3",
    }
)

_INTEGRATION_MODULES = frozenset(
    {
        "test_integration",
        "test_concurrency",
        "test_alembic_v004",
        "test_alembic_v005",
        "test_gameplay_integrity",
        "test_gameplay_consequences",
        "test_chapter_one",
        "test_chapter_one_boss",
        "test_chapter_one_journey",
        "test_character_creation_v2",
        "test_character_creation_mvp_matrix",
        "test_spells",
        "test_saving_throws_v1",
        "test_sprint15_story_progression",
        "test_sprint19_unified_combat",
        "test_class_identity_sprint21",
        "test_sprint22_chapter_one_completion",
        "test_sprint23_skill_challenges",
        "test_sprint24_background_features",
        "test_sprint25_combat_action_economy",
        "test_sprint26_racial_traits",
        "test_sprint27_ranged_combat",
        "test_sprint27_1_combat_integration",
        "test_sprint28_gameplay_journey_smoke",
        "test_sprint28_1_vault_e2e_combat_parity",
        "test_sprint29_combat_reactions",
        "test_sprint30_combat_reactions_hardening",
        "test_sprint31_spellcasting_integrity",
        "test_sprint32_spellcasting_gameplay",
        "test_sprint33_reactive_spellcasting",
        "test_sprint34_inventory_gameplay",
        "test_sprint34_1_combat_reaction_simulation",
        "test_api_systems",
        "test_auth",
        "test_engine",
        "test_quests_engine",
        "test_economy_balance",
        "test_equipment_armor_v1",
        "test_inventory_equipment",
        "test_rest_progression",
        "test_systems",
    }
)

_REGRESS_MODULES = frozenset(
    {
        name
        for name in _INTEGRATION_MODULES
        if name.startswith("test_sprint")
        or name
        in {
            "test_gameplay_integrity",
            "test_saving_throws_v1",
            "test_class_identity_sprint21",
            "test_character_creation_mvp_matrix",
            "test_chapter_one_journey",
        }
    }
)


def pytest_configure(config):
    config.addinivalue_line("markers", "unit: Sprint 28 fast layer")
    config.addinivalue_line("markers", "integration: Sprint 28 engine/API layer")
    config.addinivalue_line("markers", "slow: long parametrized simulations")
    config.addinivalue_line("markers", "regress: gameplay contract regressions")

    junit = os.environ.get("DOUPE_JUNIT", "").strip()
    if junit and not getattr(config.option, "junitxml", None):
        config.option.junitxml = junit
        report_dir = os.path.dirname(os.path.abspath(junit))
        if report_dir:
            os.makedirs(report_dir, exist_ok=True)


def pytest_collection_modifyitems(config, items):
    for item in items:
        mod = item.module.__name__.rsplit(".", 1)[-1]
        if item.name in _SLOW_TEST_NAMES and not item.get_closest_marker("slow"):
            item.add_marker(pytest.mark.slow)
            item.add_marker(pytest.mark.timeout(600))
        if mod in _INTEGRATION_MODULES or mod.startswith("test_sprint"):
            item.add_marker(pytest.mark.integration)
        elif item.get_closest_marker("slow"):
            item.add_marker(pytest.mark.integration)
        else:
            item.add_marker(pytest.mark.unit)
        if mod in _REGRESS_MODULES or mod.startswith("test_sprint"):
            item.add_marker(pytest.mark.regress)


@pytest.hookimpl(hookwrapper=True)
def pytest_runtest_makereport(item, call):
    outcome = yield
    report = outcome.get_result()
    if call.when != "call" or not report.failed:
        return
    longrepr = str(report.longrepr or "")
    if "Timeout" in longrepr or "timeout" in longrepr.lower():
        duration = getattr(report, "duration", None)
        os.environ["DOUPE_LAST_TIMEOUT_TEST"] = item.nodeid
        if duration is not None:
            os.environ["DOUPE_LAST_TIMEOUT_SEC"] = f"{duration:.2f}"
        os.environ["DOUPE_LAST_TIMEOUT_TRACE"] = longrepr[:4000]
        print(
            f"\n[pytest-timeout] {item.nodeid} duration={duration!s}s\n{longrepr[:2000]}\n",
            flush=True,
        )

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
