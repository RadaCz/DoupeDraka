# Sprint 28 — Engineering reliability & regression prevention

**Baseline HEAD (start):** `4f9f5bc` — Sprint 27.1 on `clean-main`.  
**Scope:** test layers, timeouts, runners, contract registry, CI artifacts — **no new gameplay rules**.

## Deliverables

| # | Item | Evidence |
|---|------|----------|
| 1 | Test layer markers (`unit` / `integration` / `slow` / `regress`) | `pytest.ini`, `tests/conftest.py` collection hooks |
| 2 | Per-test timeout (120s default; 600s slow sims) | `pytest-timeout` in `requirements-dev.txt` |
| 3 | PowerShell runners | `scripts/run_tests.ps1` |
| 4 | Gameplay contract registry | `docs/GAMEPLAY_CONTRACTS_V1.md` |
| 5 | Dependency map | `docs/ENGINE_DEPENDENCY_MAP_V1.md` |
| 6 | Developer workflow | `docs/DEVELOPMENT_WORKFLOW_V1.md` |
| 7 | Journey smoke (move → melee) | `tests/test_sprint28_gameplay_journey_smoke.py` |
| 8 | CI: job timeouts, JUnit + Playwright artifacts, slow job split | `.github/workflows/ci.yml` |

## Test matrix (local, 2026-11-11)

| Suite | Result |
|-------|--------|
| Fast (`not slow`) | **641 passed**, 2 skipped, ~67 s |
| Diagnose (`-x`, not slow) | green (script verified) |
| Regress (`-m regress`) | **173 passed** |
| Slow only | **21 passed** (Sprint 15 matrix) |
| Full pytest | **662 passed**, 2 skipped, ~58 s |
| Vitest | **green** (~29 s) |
| Build | **green** |
| Playwright E2E | **1 failed** — `chapter-one-quest.spec.ts` vault L3 (combat/journey; out of Sprint 28 scope to fix) |
| Secret scan | **OK** |
| Postgres subset | **NOT RUN** locally (no `PYTEST_DATABASE_URL`) |
| GitHub CI on this diff | **NOT VERIFIED** (push not done) |

## Audit highlights (§1)

| Topic | Finding |
|-------|---------|
| Slowest tests | Sprint 15 `simulate_main_path` (20 parametrized + optional crypt) — now `@pytest.mark.slow` + 600 s cap |
| Long-run causes | Full story sim loops in `tools/simulate_story_main_path.py` (combat until vault XP) |
| Shared state | `conftest` SQLite temp DB + autouse rate-limit reset; Postgres job isolated |
| Duplicates | Sprint files vs `test_gameplay_integrity` overlap by design (contracts vs general rules) |
| Playwright | Separate E2E layer; `frontend/e2e/run-tests.mjs` fresh DB per project |

## Diagnostic cycle

Before Sprint 28, a full `pytest -q` always included ~21 slow sims (~same wall clock as full suite).  
**Fast path** (`.\scripts\run_tests.ps1 fast`) excludes slow markers → **~67 s** vs full **~58 s** on this machine (slow sims are parallel-friendly; main win is fail-fast `diagnose` + CI split job).

## Status

**READY FOR REVIEW** for pytest layers, docs, runners, and CI workflow edits.  
**NOT READY** for release gate until Playwright `chapter-journey` vault L3 spec is green (pre-existing gameplay/E2E coupling, not fixed in this sprint).
