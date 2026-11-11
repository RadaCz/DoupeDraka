# Sprint 19 / 19.1 — Unified Combat, Monster Saves & Conditions

**Baseline HEAD:** `0f1dd12` (`clean-main`)  
**Sprint 18 parent:** `1c6de60` (ancestor of HEAD)  
**Commit / push:** none

## Summary

Unified saving throw resolution for **players** and **monsters**, spell save DC via `spell_save_dc()`, and `resolve_spell_save_damage()` for modeled save spells.

**Conditions V1:** `paralyzed` (ghoul on-hit CON save fail), `disadvantage_next_attack` (Vicious Mockery fail). Persisted on `CharacterState.conditions` / `MonsterState.conditions`.

**Sprint 19.1 rule fixes:** repeat CON save at **end of player turn**; paralyzed player turn still advances (save + enemy); melee-only auto-crit vs paralyzed (`enemy_attack_is_melee`); removed `__e2e/paralyze`.

## Tests (local, 2026-11-11)

| Suite | Result |
|-------|--------|
| `python -m pytest -q` | **564 passed**, 2 skipped |
| `python scripts/secret_scan.py` | OK |
| `npm run test -- --run` | **153 passed** |
| `npm run build` | OK |
| `npm run test:e2e -- --project=combat-saves` | **3 passed** |
| Full E2E (~26 specs) | not re-run |
| GitHub Actions | unverified until push |

## E2E

- Playwright project **`combat-saves`** runs **before** chapter journey (fresh `E2E_RNG_SEED=27` stream).
- `ghoul-paralysis-combat.spec.ts` — UI creation, API grind to L2, real `attack ghoul` until `paralyzed`, UI composer blocked attack, optional repeat-save journal line.
- `spell-save-combat.spec.ts` — Burning Hands during active kobold fight.
- Sacred Flame / Vicious Mockery: **pytest** (`test_sprint19_unified_combat.py`, `test_spells.py`); no bard MVP wizard E2E.

## Key files

- `app/engine/saving_throws.py`, `spell_saves.py`, `conditions.py`, `combat_effects.py`, `encounters.py` (`enemy_attack_is_melee`)
- `app/engine/service.py`, `models.py`
- `tests/test_sprint19_unified_combat.py`
- `frontend/e2e/ghoul-paralysis-combat.spec.ts`, `spell-save-combat.spec.ts`, `playwright.config.ts`

## Acceptance

**NOT READY** until full E2E matrix + GHA on commit. Mechanics and combat-saves project: **green locally**.
