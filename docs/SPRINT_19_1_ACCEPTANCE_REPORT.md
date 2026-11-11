# Sprint 19.1 — Git Truth, SRD Rules & Acceptance

**Date:** 2026-11-11  
**HEAD (committed):** `0f1dd12` (`docs(staging): align deployment runbooks…`)  
**Branch:** `clean-main` = `origin/clean-main`  
**Sprint 19 work:** uncommitted working tree on top of `0f1dd12`  
**Commit / push:** none (per instruction)

---

## A. Git truth

| Check | Result |
|-------|--------|
| `git rev-parse HEAD` | `0f1dd12177d05042d9f006a46e5f425838421168` |
| `git rev-parse origin/clean-main` | same |
| `merge-base 0f1dd12 1c6de60` | `1c6de60` |
| `merge-base --is-ancestor 1c6de60 HEAD` | **yes** (exit 0) |
| Relationship `0f1dd12` vs `1c6de60` | `1c6de60` (Sprint 18) → `0f1dd12` (staging docs); not divergent forks |
| Sprint 19 base | Correct — builds on `0f1dd12` which already contains Sprint 18 |

**Working tree (Sprint 19 + 19.1):** modified engine, API, frontend, tests, docs; new `conditions.py`, `spell_saves.py`, E2E specs, `docs/RULESET_v1.md`, acceptance docs.

**Preserved (do not delete):** untracked `data/`, `tools/`, local `.pytest-*` / `.e2e-*` logs.

---

## B. Rules fixed (SRD 5.1)

| Item | Fix |
|------|-----|
| Paralysis repeat save | Moved from start of player turn to **end of player turn** (`_close_player_combat_turn` before enemy turn) |
| Paralyzed turn | Blocked action still runs end-of-turn save + enemy turn (`_finish_paralyzed_player_turn`) |
| Melee crit vs paralyzed | Any **melee** hit (not natural 20 only) is critical; `RANGED_ATTACK_MONSTERS` for future ranged foes |
| Removed false crit | Dropped “advantage ⇒ crit” coupling |
| Debug endpoint | Removed `POST …/__e2e/paralyze` |
| Unified saves | Unchanged architecture; tests extended (9 in `test_sprint19_unified_combat.py`) |

---

## C. Tests (local)

| Suite | Command | Result |
|-------|---------|--------|
| Backend | `python -m pytest -q` | **564 passed**, 2 skipped |
| Secret scan | `python scripts/secret_scan.py` | OK |
| Frontend unit | `cd frontend && npm run test -- --run` | **153 passed** |
| Build | `cd frontend && npm run build` | OK |
| E2E combat-saves | `npm run test:e2e -- --project=combat-saves` | **3 passed** (ghoul paralysis, vault DEX save, Burning Hands) |
| Full E2E matrix (~26 specs) | `npm run test:e2e` | **NOT re-run** this pass |
| PostgreSQL / Alembic on GHA | — | **NOT VERIFIED** (no push) |

---

## D. Documentation

| File | Change |
|------|--------|
| `docs/SPRINT_19_1_ACCEPTANCE_REPORT.md` | this report |
| `docs/SPRINT_19_UNIFIED_COMBAT_CONDITIONS_V1.md` | updated for 19.1 |
| `docs/PRODUCT_GAP_REGISTER_V1.md` | conditions/saves/E2E status |
| `docs/MASTER_PLAN_STATUS.md` | Sprint 19.1 note |
| `docs/RULESET_v1.md` | pointer + 19.1 combat bullets |
| `design/RULESET_v1.md` | paralysis timing + melee crit |

---

## E. Acceptance

**Verdict: NOT READY**

| # | Criterion | Status |
|---|-----------|--------|
| 1 | Git history explained | **OK** |
| 2 | No lost local changes | **OK** (read-only git) |
| 3 | Paralysis SRD + end-of-turn save | **OK** (pytest + ghoul E2E) |
| 4 | Melee/ranged crit | **OK** (pytest; ranged set empty) |
| 5 | Unified saves | **OK** (pytest) |
| 6 | Three save spells | **OK** (pytest); **Sacred Flame / Mockery UI E2E** only via pytest (no MVP bard UI path) |
| 7 | Ghoul stable E2E | **OK** in `combat-saves` project (real fight; up to 8 ghoul exchanges; no debug endpoint) |
| 8 | Full E2E matrix | **NOT RUN** |
| 9 | Regression suites | **OK** locally |
| 10 | PG/Alembic CI | **UNVERIFIED** |
| 11 | Docs | **OK** |
| 12 | No commit/push | **OK** |

**Blockers:** full Playwright matrix; GitHub Actions on current diff; optional CombatUI condition chip when resyncing play view after API-only turns.

**Sprint 19 commit readiness:** Implementation is logically ready for a **single dedicated commit** after you approve; CI should run on that commit.
