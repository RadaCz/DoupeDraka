# Sprint 27.1 — Combat integration & gameplay recovery

**Baseline commit:** `f6d7ea0` (Sprint 27 ranged)  
**Working tree:** Sprint 27.1 fixes (**not committed** unless user asks)

## Problem (post–27.0)

- `apply_player_movement()` existed but no `COMBAT_MOVE` intent / `resolve_action` path.
- UI tests expected Advance / Step back chips; engine did not execute them.
- Encounter distance init was partial (explore random fights skipped kobold 60 ft setup).
- Enemy `_enemy_turn` ignored distance (kobold melee at 60 ft).
- Simulation helper bypassed engine with direct `apply_player_movement()`.
- Ammunition consumed only on hit (not on resolved ranged attack).

## Implemented (27.1)

| Area | Change |
|------|--------|
| Intent | `COMBAT_MOVE` + `combat_move.py` (advance / step back EN+CS, invalid 0 ft → reject) |
| Engine | `_resolve_combat_move` — movement only, no Action spent, no auto end turn |
| Distance | `ensure_encounter_distance()` — idempotent while combat active |
| Encounters | Explore random combat, fresh attack, vault descent use ensure |
| Enemy AI | Ranged kobold at distance; melee foes close before striking |
| Attacks | Thrown parse; ammo on resolved ranged attack; quarterstaff not thrown |
| Simulation | `combat_turn_helpers` uses `advance N ft` via `resolve_action` |
| Frontend | Advance / Step back in `buildCombatActions()` (7 base actions + end turn) |
| Tests | `tests/test_sprint27_1_combat_integration.py` |

## Deferred

- Opportunity attacks, loading property, full COMBAT_MOVE in free-text composer without chips.
- Dedicated Playwright for “movement + attack same turn” (Vitest + engine tests cover core).

## Verification (local agent)

| Gate | Result |
|------|--------|
| `test_sprint27_1_combat_integration.py` | 4 passed |
| `test_sprint27_ranged_combat.py` | 8 passed |
| `test_sprint15_story_progression.py` | 28 passed |
| `test_sprint25_combat_action_economy.py` | 10 passed |
| Vitest `combatActions` + `combatRange` | run in agent pass |
| Full `pytest tests/` | **661 passed**, 2 skipped (~59s) |
| Playwright E2E | not re-run this pass |
| GitHub CI | not verified |
