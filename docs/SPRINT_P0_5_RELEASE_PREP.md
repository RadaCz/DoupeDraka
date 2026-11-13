# P0.5 — Release preparation (pre-staging)

**HEAD:** `894917b812efb5fb280972a9a4397fc789cbd973`  
**Prepared:** 2026-11-13 — **nothing staged, no commits, no push.**

## Pre-flight blocker (fix before `git add app/api.py`)

| Issue | Detail |
|-------|--------|
| **UTF-8 BOM** | Working tree `app/api.py` line 1 is `﻿import asyncio` (BOM). Must restore plain `import asyncio` before any commit touching `api.py`. |

## CI change (prepared in working tree, uncommitted)

| File | Change |
|------|--------|
| `.github/workflows/ci.yml` | `Playwright E2E` **step** `timeout-minutes`: **15 → 20** (job already `timeout-minutes: 20`; full suite ~12.0 min observed). **Commit I** with other ops. |

## Targeted tests run (P0.5)

| Scope | Command | Result |
|-------|---------|--------|
| P0.1 + harness + tests F/A | `pytest` rng + runner + integration + spells + alembic_v004 | **10 passed** |
| P0.2 combat UI | `npm run test -- --run src/combat/combatEconomy.test.ts src/combat/combatActions.test.ts` | **12 passed** |
| Billing (commit E, deferred) | `pytest tests/test_sprint37_4_billing_settlement.py -q` | **3 passed** (SQLite only) |
| PostgreSQL v006 | — | **NOT RUN** (Docker unavailable on host) |

---

## Commit plan (execute in order after approval)

### **A** — `feat(e2e): stable per-identity RNG (P0.1)`

| Files | Hunks / scope |
|-------|----------------|
| `app/e2e_rng.py` | **full file** (`build_e2e_rng_identity`) |
| `app/engine/rng_state.py` | **full file** |
| `app/api.py` | **Only:** remove BOM if still present; `from .e2e_rng import build_e2e_rng_identity, parse_e2e_rng_base`; `commit_action_turn` block `e2e_identity` + `bind_engine_rng(..., e2e_identity)` (~1250–1255). **Exclude** all billing imports and `recover_*` / `ledger_ref` / `billing_status`. |
| `tests/test_rng_e2e_seed.py` | **full file** |

**`git add -p` note:** Import hunk at line ~24 bundles billing + e2e — **split hunk** in patch editor (accept `build_e2e_rng_identity` lines only for A).

**Test:** `python -m pytest tests/test_rng_e2e_seed.py -q`

---

### **B** — `fix(combat-ui): offer End turn when action or bonus spent (P0.2)`

| Files | Hunks |
|-------|--------|
| `frontend/src/combat/combatEconomy.ts` | **Only** `shouldOfferEndTurn`: `return actionUsed \|\| bonusUsed` (lines ~33–37). **Not** `BONUS_ACTION_SPELLS`. |
| `frontend/src/combat/combatEconomy.test.ts` | **full** |
| `frontend/src/combat/combatActions.test.ts` | **full** |

**Test:** `cd frontend && npm run test -- --run src/combat`

---

### **C** — `test(e2e): Bell Warden UI driver and combat-reactions (P0.2)`

| Files | Hunks in `chapter-one-e2e-helpers.ts` |
|-------|--------------------------------------|
| `frontend/e2e/bell-warden-ui.spec.ts` | **full** |
| `frontend/e2e/combat-reactions.spec.ts` | **full** |
| `chapter-one-e2e-helpers.ts` | `reviveIfFallen` (MVP `long rest` at hp=1); `clickCombatDeckButtonAwaitState`; `combatProgressSignature` (if BW loop uses it); `endCombatTurnViaUiIfSpent`; `settleFreshPlayerTurnAfterEngage`; `completeBellWardenBossViaUI` (all hunks ~821–1177); `prepareBellWardenUiFight`, `travelToSafeRestHub`, `healCharacterToFullForBossFixture`, `bossLoopSnapshot`; related constants (`COMBAT_DECK`, token refresh). |

**Exclude:** `ghoulUiPlayerCombatTurn`, `startGhoulCombatForUi`, `earnBanditEvidenceViaEngine` / scavenge hunks.

**Test:** `cd frontend && npm run test:e2e -- --project=chapter-journey e2e/bell-warden-ui.spec.ts e2e/combat-reactions.spec.ts`

---

### **D** — `fix(e2e): ghoul harness and UI paralysis loop (P0.3)`

| Files | Hunks |
|-------|--------|
| `frontend/e2e/run-tests.mjs` | Ghoul phase `225000ms` constants |
| `frontend/e2e/playwright.config.ts` | Split ghoul `testMatch` + `180_000` timeout |
| `frontend/e2e/ghoul-paralysis-combat.spec.ts` | **full** |
| `chapter-one-e2e-helpers.ts` | `ghoulUiPlayerCombatTurn`, `startGhoulCombatForUi`; export `combatProgressSignature` / `endCombatTurnViaUiIfSpent` if not already in C (avoid duplicate — if C took `endCombatTurn`, D adds only ghoul-specific callers). |
| `tests/test_e2e_runner_phase_timeouts.py` | **new file** |

**P0.3 bandit/inventory (same commit or D1):** `earnBanditEvidenceViaEngine`, `earnChapterOneShopGold` scavenge `72` hunks.

**Test:** `pytest tests/test_e2e_runner_phase_timeouts.py -q`; `npm run test:e2e -- --project=combat-saves e2e/ghoul-paralysis-combat.spec.ts`

---

### **F** — `fix(test): contract alignment (P0.3)`

| Files |
|-------|
| `tests/test_integration.py` | `monkeypatch` on `e2e_hooks_enabled` |
| `tests/test_spells.py` | `len(leveled) == 4` |

**Dependencies:** Commit **G** (or G before F if spells test must match committed `character_creation.py`).

**Test:** `python -m pytest tests/test_integration.py::test_e2e_fallen_hook_is_hidden_in_normal_runs tests/test_spells.py::test_character_initialization_assigns_class_ability_and_selected_spells -q`

---

### **G** — `feat(chars): G-09 spell picks and bonus-action economy`

| Files |
|-------|
| `app/engine/character_creation.py` |
| `app/engine/spells.py` |
| `app/engine/combat_action_economy.py` |
| `app/engine/saving_throws.py` |
| `app/engine/service.py` | Misty Step `teleport` vs combat escape (~1477–1508) |
| `frontend/src/combat/combatEconomy.ts` | **Only** `BONUS_ACTION_SPELLS` line |
| `tests/test_character_creation_v2.py`, `tests/test_rest_progression.py` |
| `design/RULESET_v1.md`, `docs/RULESET_v1.md`, `docs/SPELLCASTING_CONTRACT_V1.md` |
| E2E: `class-identity.spec.ts`, `cleric-channel-divinity.spec.ts`, `combat-action-economy.spec.ts`, `reactive-spellcasting.spec.ts`, `rogue-cunning-action.spec.ts`, `spell-save-combat.spec.ts`, `spellcasting-gameplay.spec.ts`, `spellcasting-integrity.spec.ts` |

**Test:** `python -m pytest tests/test_character_creation_v2.py tests/test_rest_progression.py -q`

---

### **H** — `docs: sprint P0.1–P0.5 closure`

| Files |
|-------|
| `docs/SPRINT_P0_1_BELL_WARDEN_ROOT_CAUSE.md` |
| `docs/SPRINT_P0_2_BELL_WARDEN_COMPLETE.md` |
| `docs/SPRINT_P0_3_FULL_SUITE_STABILIZATION.md` |
| `docs/FINAL_CHANGE_AUDIT.md` |
| `docs/SPRINT_P0_5_RELEASE_PREP.md` |

---

### **I** — `chore(ci): align Playwright E2E step timeout with suite duration`

| Files |
|-------|
| `.github/workflows/ci.yml` | step `timeout-minutes: 20` |

---

### **E** — `feat(billing): receipt ledger settlement (Sprint 37.4)` — **DEFER**

Ship only after **PostgreSQL** `alembic upgrade head` + `alembic check` on clean DB (CI `backend-postgres` or local Docker).

| Untracked / mixed files |
|------------------------|
| `app/billing_settlement.py` |
| `alembic/versions/v006_receipt_billing_settlement.py` |
| `app/db.py` (billing columns bootstrap) |
| `app/api.py` (all billing hunks: imports, `atomic_*`, `recover_held_receipt_billing`, `reconcile_*`, `replay_receipt`, receipt `billing_status`, debit `ledger_ref`) |
| `tests/test_sprint37_4_billing_settlement.py` |
| `tests/test_memory_hardening.py` |
| `tests/test_alembic_v004.py` (v006 head) |

---

## Explicitly **exclude** from all commits

| Path | Reason |
|------|--------|
| `data/` | Local SQLite DB |
| `?? .e2e-*`, `?? .pytest-*`, `?? .vitest-gate.txt` | Local logs |
| `docs/product-reality-check*`, `docs/AUDIT_*`, `docs/TEST_STRATEGY_*` | Audit WIP |
| `scripts/audit_secret_hygiene.py`, `tools/audit_cs_suspects.py` | Unreviewed |
| `tests/test_audit_g01_halfling_lucky.py` | Untracked; tie to G-09 only after review |
| `tests/test_sprint37_3_1_bell_warden_e2e.py` | Optional; not in P0 gate |
| `ROADMAP.md`, `frontend/nginx.conf`, `scripts/secret_scan.py` | UNKNOWN scope |
| `frontend/src/App.tsx`, `CharacterScreen.tsx`, `characterSheet.ts` | UI sheet; not P0-validated as set |

---

## `chapter-one-e2e-helpers.ts` hunk map (git diff)

| Approx old line | Commit | Topic |
|---------------|--------|--------|
| 195 | C | `reviveIfFallen` MVP recovery |
| 526–543 | D | Bandit evidence sequence |
| 702 | D | Scavenge max 72 |
| 812–868 | C | Stream-bound deck clicks, progress sig |
| 879–1177 | C | Bell Warden UI loop |
| 1369–1455 | D | Ghoul UI + API prep |
| 1523+ | C | `bossLoopSnapshot`, `prepareBellWardenUiFight` |

---

## PostgreSQL evidence

| Check | Status |
|-------|--------|
| Local Docker | **Unavailable** (`docker` not on PATH) |
| SQLite `test_sprint37_4` | **3 passed** (schema via `init_db` + `_migrate_billing_settlement`) |
| CI `backend-postgres` | **Pending push** — will run `alembic upgrade head` + v005/cd64 tests only (**v006 not in CI until E**) |

---

## Command script (after approval — do not run until user says so)

```powershell
# Fix BOM once (manual edit or):
# (Get-Content app/api.py -Raw).TrimStart([char]0xFEFF) | Set-Content app/api.py -NoNewlineEncoding utf8

# For each commit A → D → F → G → H → I:
#   git add -p <files>   # per tables above
#   git commit -m "..."
#   <run listed tests>

# Commit E later, after Postgres proof:
#   git add app/billing_settlement.py alembic/versions/v006_*.py app/db.py ...
#   git add -p app/api.py   # billing hunks only
#   pytest tests/test_sprint37_4_billing_settlement.py ...

# Push (when approved):
#   git push origin clean-main
```
