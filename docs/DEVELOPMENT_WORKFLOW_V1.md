# Development workflow V1 (Sprint 28)

## Sprint start

1. Confirm `git rev-parse HEAD` matches `origin/clean-main` (no reset/stash).  
2. Read contract row in `docs/GAMEPLAY_CONTRACTS_V1.md` for the sprint domain.  
3. Note dependencies in `docs/ENGINE_DEPENDENCY_MAP_V1.md`.

## Implement

- **Smallest change** that satisfies one acceptance bullet.  
- Map impact: which chain in the dependency map moves?  
- No direct calls to private engine helpers from new product code (tests included).

## Test locally (PowerShell, repo root)

| Goal | Command |
|------|---------|
| Fast diagnostic (default) | `.\scripts\run_tests.ps1 fast` |
| Stop on first failure | `.\scripts\run_tests.ps1 diagnose` |
| Gameplay regressions | `.\scripts\run_tests.ps1 regress` |
| Slow story sims only | `.\scripts\run_tests.ps1 slow` |
| Full pytest | `.\scripts\run_tests.ps1 full` |
| Frontend unit | `cd frontend; npm run test -- --run` |
| Build | `cd frontend; npm run build` |
| E2E | `cd frontend; npm run test:e2e` |
| Secret scan | `python scripts/secret_scan.py` |

JUnit XML lands in `reports/junit-<mode>.xml` when using `run_tests.ps1`.

**Postgres-only checks:** set `PYTEST_DATABASE_URL` to a dev Postgres URL, run `alembic upgrade head`, then `python -m pytest -q tests/test_concurrency.py tests/test_alembic_v005.py`.

## When to widen the suite

| Change type | Minimum |
|-------------|---------|
| Copy / UI only | Vitest for touched components |
| Engine rules | `regress` + relevant sprint file from map |
| API contract | `test_integration` + auth tests |
| Combat movement/range | `test_sprint27*`, `test_sprint28_gameplay_journey_smoke`, consider slow Sprint 15 |
| DB schema | Alembic revision + Postgres job tests |

## READY FOR REVIEW

- Fast pytest green (`not slow`).  
- Targeted regressions from dependency map green.  
- If combat/API/DB: full pytest or CI-equivalent.  
- Docs touched if contracts or gaps changed.  
- **No commit/push** until reviewer or explicit user approval (team rule).

## Commit / push

Only after READY FOR REVIEW and explicit request. Prefer one sprint-themed commit message; never force-push `clean-main`.
