# Sprint P0.1 — Bell Warden E2E Root Cause Report

**Branch:** `clean-main` (working tree)  
**Scope:** Bell Warden UI E2E + E2E RNG determinism (P0.1)  
**Status:** Partial — RNG unit tests green; isolated Bell Warden UI **not** green (210s Playwright timeout).

## Root cause (240s runner timeout at `894917b`)

### Primary — non-reproducible E2E combat RNG

Before P0.1, `seed_for_character()` hashed `E2E_RNG_BASE + character.id`. Fresh E2E databases assign a **new random UUID** per run, so the Bell Warden combat roll stream was not stable across isolated CI runs even with a fixed `E2E_RNG_BASE`. That breaks the assumption behind deterministic boss UI automation and can change hit/miss timing, reaction windows, and turn economy.

**Fix:** Stable E2E identity `tg:{telegram_id}:{character_name}` via `build_e2e_rng_identity()` passed from `commit_action_turn` into `bind_engine_rng()`. Production (no E2E base) still uses UUID. Persisted `rng_state` still wins over derived seed.

**Evidence:** `pytest tests/test_rng_e2e_seed.py -q` → **6 passed**.

### Secondary — Bell Warden E2E harness hung instead of failing fast

Instrumented runs (`reports/bw-run3.log`, `bw-run6.log`) show:

1. **Prep:** `stabilizeForBellWardenFight` (50% HP) and travel without full heal left the hero wounded; replaced with `prepareBellWardenUiFight` (safe-hub long rest, then pit).
2. **Combat loop:** Prior loop reset `nonPlayerStreak` and swallowed `aria-busy` timeouts → up to **240s** runner kill with no diagnostic. New loop logs `[bw-ui]` lines, uses `combatProgressSignature` (HP, round, turn, flags, distance, movement), 8s enemy-turn stall cap, and surfaces `aria-busy` / stream timeouts.
3. **UI driver bugs found in logs:** Opening engagement often has `combat_round=2` and `action_used` already set; blind **Advance** with `moveLeft=0` was a no-op; **End turn** when attack was still available wasted player tempo; occasional stretches where Attack/End turn/Defend are disabled in UI while API still shows `combat_turn=player` → poll loops until Playwright **210s** test timeout (`apiRequestContext.get: Target page, context or browser has been closed`).

The **exact hang** at `894917b` is therefore explained as: **non-deterministic RNG** plus **silent loop / swallowed UI busy**, not a proven Bell Warden engine stat bug. No engine combat rule changes were made.

## Files changed (P0.1 intent)

| Area | Files |
|------|--------|
| E2E RNG | `app/e2e_rng.py`, `app/engine/rng_state.py`, `app/api.py` (bind site), `tests/test_rng_e2e_seed.py` |
| Bell Warden E2E | `frontend/e2e/chapter-one-e2e-helpers.ts`, `frontend/e2e/bell-warden-ui.spec.ts` |

Note: `git status` shows many **pre-existing** dirty unrelated files; this sprint did not intentionally modify billing, roadmap, or unrelated specs.

## Verification (§5)

| Step | Result |
|------|--------|
| A. `pytest tests/test_rng_e2e_seed.py -q` | **PASS** (6/6) |
| B. Bell Warden isolated ×3 fresh DB | **FAIL** — see below |
| C. Full `npm run test:e2e` | **Not run** (B not green) |
| D. Vitest / typecheck / build | Run locally in session — see agent summary (not GH Actions green) |

### Bell Warden isolated runs (fresh DB each)

| Run | Duration | Outcome |
|-----|----------|---------|
| 1 (`bw-run1.log`) | ~23s | FAIL — prep (partial HP at pit) |
| 2 (`bw-run2.log`) | ~19s | FAIL — prep |
| 3 (`bw-run3.log`) | ~224s | FAIL — 210s timeout; combat logged rounds 0–10, stuck on disabled deck |
| 4–7 (`bw-run4`–`bw-run6`) | ~23–232s | FAIL — prep fixed after `bw-run3`; combat progresses but **no victory** within 210s |

**Action sequence sample (deterministic identity, run 6, identical pattern across retries):**  
`action_surge → attack → end_turn → … → second_wind → attack` with boss HP trending `34→27→15→…` — proves logging and stable prep; **not** yet a reproducible **win** within 210s.

## Remaining work

1. Resolve UI/API desync when player turn has no enabled deck buttons (diagnose from `trace.zip` in `.playwright-results/`).
2. Re-run Bell Warden **3×** after green single run; compare `actionTrace` strings for bitwise-identical sequences across UUIDs.
3. Full E2E matrix + GH Actions before claiming repo green.

## Git (working tree)

Run at report time:

- `git status --short` — many modified files (P0.1 + pre-existing P1/P2 dirty tree).
- `git diff --stat` — includes `chapter-one-e2e-helpers.ts` (+~368 lines scope), `bell-warden-ui.spec.ts`, RNG files, plus unrelated hunks already in tree.

**No commit or push** (per instructions).
