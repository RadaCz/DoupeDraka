# Sprint 30 — Combat reactions V1.1: rules integrity & E2E stability

**Baseline (committed):** `44066e3` = `origin/clean-main` (Sprint 29 combat reactions).  
**Sprint 30:** uncommitted working tree — hardening only, no new gameplay scope.

## Audit findings

| Issue | Root cause | Fix |
|-------|------------|-----|
| `ghoul-paralysis-combat` / `spell-save-combat` flakes in full E2E | Single `combat-saves` phase shared one API process + `E2E_RNG_SEED=27`; earlier specs consumed RNG | `frontend/e2e/run-tests.mjs` expands full run to **6 phases** (4 combat-saves specs each with fresh DB + API) |
| OA on defeated combatant | Missing guards before spending reactions | `service.py`: skip enemy/player OA when monster HP ≤ 0 or not in combat |
| Idempotency on combat move | Not covered for OA double-apply | `test_idempotent_opportunity_attack_not_reapplied_on_replay_key` |

**Documented (no code change):** `enemy_reaction_used` is per-fight single-combatant MVP (`combat_flags` on hero). Forced movement / teleport OA rules deferred (`VOLUNTARY_MOVEMENT_OA` contract in `combat_reactions.py`).

## Delivered (Sprint 30 delta)

- `app/engine/combat_reactions.py` — MVP module doc + `VOLUNTARY_MOVEMENT_OA`
- `app/engine/service.py` — OA guards for dead / out-of-combat targets
- `frontend/e2e/run-tests.mjs` — phased `combat-saves` isolation
- `tests/test_sprint30_combat_reactions_hardening.py` (4 tests)
- `tests/conftest.py` — regress integration list

## Validation (local, 2026-11-12)

| Command | Result |
|---------|--------|
| `.\scripts\run_tests.ps1 fast` | 658 passed, 2 skipped |
| `.\scripts\run_tests.ps1 diagnose` | 658 passed, 2 skipped |
| `.\scripts\run_tests.ps1 regress` | 190 passed |
| `.\scripts\run_tests.ps1 slow` | 21 passed |
| `.\scripts\run_tests.ps1 full` | 679 passed, 2 skipped |
| `python scripts/secret_scan.py` | OK |
| `cd frontend; npm run test:run` | 171 passed |
| `cd frontend; npm run build` | OK |
| `cd frontend; npm run test:e2e e2e/combat-reactions.spec.ts` | 2 passed |
| `cd frontend; npm run test:e2e` (6 phases) | **40 passed** (1 journey + 4 combat-saves + 35 smoke) |

| Suite | Tests |
|-------|-------|
| `test_sprint29_combat_reactions.py` | 11 passed |
| `test_sprint30_combat_reactions_hardening.py` | 4 passed |

**GitHub CI / PostgreSQL:** NOT RUN (no push this session). Alembic head unchanged — CI job only after push.

## Status legend

| Label | Sprint 30 |
|-------|-----------|
| Implemented | OA, Disengage, reaction flags (Sprint 29) + Sprint 30 guards & E2E phasing |
| Tested locally | Full matrix above |
| Verified in GitHub CI | **Pending push** |
| Deferred | Reach > 5 ft, multi-enemy reactions, Shield, forced move, teleport |

**Release verdict (local):** **READY FOR REVIEW** — commit Sprint 30 delta and push to confirm CI PostgreSQL + E2E job.
