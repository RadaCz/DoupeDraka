# Sprint 33 — Reactive spellcasting (Shield) acceptance

## Scope (MVP)

- **Shield** (level 1, reaction): opens when an enemy attack roll would hit; player chooses **cast Shield** or **decline reaction**.
- Persisted `combat_reaction_pending` + `combat_turn: reaction` until resolved; reload-safe.
- +5 AC via `shield_active` in `compute_armor_class`; reapplies the **same** stored attack roll (no re-roll).
- Slot + reaction consumed only on successful Shield cast; decline spends neither.
- `shield_active` clears at **start of the player’s turn** (`reset_player_turn_economy`).
- Fighter/Rogue and non-casters cannot cast Shield even with hacked spell lists.

## Out of scope (documented)

- Magic Missile negation while Shield is active (enemy MM vs player not modeled).
- Auto-timeout of stale reaction windows (player must decline or Shield).
- Multi-enemy or non-attack reaction triggers.

## Key modules

| Area | Module |
|------|--------|
| Window + AC | `app/engine/reactive_spells.py` |
| Enemy pause | `app/engine/service.py` (`_resolve_enemy_hit_on_player`, `_resolve_shield_reaction_cast`) |
| Economy | `app/engine/combat_action_economy.py` (`REACTION_SPELLS`, reaction availability in combat) |
| UI | `frontend/src/combat/combatActions.ts`, `CombatUI.tsx` |

## Tests

- `tests/test_sprint33_reactive_spellcasting.py`
- `frontend/e2e/reactive-spellcasting.spec.ts` (reaction-only cast guard)

## Verdict

**READY FOR REVIEW** (local): Sprint 32 gate + Sprint 33 unit tests pass; full Playwright matrix not re-run in this session.
