# Sprint 25 — Combat action economy V1

**Git baseline (start):** `53a6fedf862c3e64c29fde4c28b13d037e9bc46a` (`origin/clean-main`, Sprint 24 committed; CI #66 GREEN)  
**Working tree:** Sprint 25 implementation (not committed unless user asks)

## Summary

Engine-authoritative **Action / Bonus Action / Reaction** pools per player combat turn, persisted in `CharacterState.combat_flags` via `app/engine/combat_action_economy.py`. Combat UI reads the same flags (no client-side rules).

## IMPLEMENTED

| Area | Detail |
|------|--------|
| **Economy module** | `action_used`, `bonus_action_used`, `reaction_used`; reset on `mark_player_turn_start` / new player turn after enemy phase |
| **Spells** | Healing Word = bonus (no auto end turn); damage/cantrip spells = action + enemy phase when action spent |
| **Class features** | Second Wind, Hide = bonus; Arcane Recovery blocked in combat |
| **Weapons & defense** | Attack, Defend, Flee, potion in combat = action |
| **Turn flow** | Enemy after both pools spent, action with no bonus offer, or explicit **end turn** (`should_advance_enemy_after_player_activity` + `END_TURN` intent) |
| **Fail-closed** | Denied economy does not spend slots or change HP |
| **Persistence** | Flags round-trip via `encode_character_state` / reload |
| **UI** | `CombatActionEconomyStrip` + disabled reasons on combat deck (EN/CS) |
| **Tests** | `tests/test_sprint25_combat_action_economy.py`, updated `test_spells.py`, Vitest `combatEconomy.test.ts` |
| **E2E** | `frontend/e2e/combat-action-economy.spec.ts` (fighter Second Wind → attack; needs CI stack) |

## PARTIAL

| Area | Gap |
|------|-----|
| **Spell deck UX** | Multi-spell picker assumes per-spell slot at cast time; sole-spell chip uses correct slot |
| **Reaction UI** | Strip shows availability; no player-facing reaction actions yet |
| **Physical Telegram QA** | NOT TESTED |

## DEFERRED (backlog)

| Item | Reason |
|------|--------|
| **Opportunity attacks** | No grid/movement trigger in MVP |
| **Shield / Counterspell / Hellish Rebuke** | No lawful reaction trigger ordering |
| **Ready action** | Not modeled |
| **Bonus-action spells beyond Healing Word** | Not in modeled combat set yet |

## Verification (local, Sprint 25.2 — 2026-11-11)

| Gate | Result | Notes |
|------|--------|-------|
| `pytest tests/` | **634 passed**, 2 skipped (~57s) | Simulation loops use `resolve_combat_action_for_simulation` after economy change |
| Vitest | **167 passed** | |
| `vite build` | **OK** | |
| Playwright full matrix | **34 passed** (chapter-journey + combat-saves + e2e-smoke) | After `closeCombatTurnIfStalled` in E2E helpers |
| `python scripts/secret_scan.py` | **OK** | |

**CI / Telegram QA:** not re-verified in this pass.

**Regression fix (25.2):** Boss/combat loop tests hung when fighter spent Action but still had Bonus (Second Wind) — enemy never advanced until explicit `end turn` or simulation helper closes the turn.

## Sprint 24 doc sync

Sprint 24 acceptance updated to **committed** baseline `53a6fed` (was `32ebfd7` start-only).
