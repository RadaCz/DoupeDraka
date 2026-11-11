# Sprint 18 — Saving Throws & Combat Effects V1

**Git HEAD (start):** `def6a938a48105a84c1cd8576600bc4f017e1182` (`clean-main`)  
**Date:** 2026-11-11  
**Commit / push:** none (per sprint scope)

## A. Git

| Item | Value |
|------|--------|
| Branch | `clean-main` |
| HEAD at report time | working tree on `def6a93` + Sprint 18 changes |
| Origin | synced at `def6a93` (no Sprint 18 push) |
| Staging 15.3 / logs / `data/` | untouched |

## B. Implementation

### Saving throw engine (`app/engine/saving_throws.py`)

- Structured `SavingThrowResult` (ability, dc, d20, advantage/disadvantage, modifiers, proficiency, success, source, Halfling Lucky).
- `perform_saving_throw()` uses project RNG (`GameEngine.rng`); advantage/disadvantage cancel; invalid ability/DC rejected.
- `GameEngine.saving_throw()` / `resolve_saving_throw()` delegate here (backward-compatible tuple API kept).
- Journal lines: `Saving throw — {Ability}. DC {n}.` + `Roll {d20} + … = {total} — success|failure.`

### Triggers

| Trigger | Implementation |
|---------|----------------|
| **Enemy ability** | **Ghoul** `on_hit` — Constitution DC 10, 1d4 on fail (`ghoul_paralyzing_claws`). |
| **Enemy spell** | **Kobold** `on_hit` — Dexterity DC 11, 1d4 on fail (`kobold_caustic_spittle`, once per combat). |
| **Trap / hazard** | **The Vault of Echoes** — first explore/look/search applies Dexterity DC 13, 2d6 (`vault_falling_stones`, quest flag). |
| **Player spells** | Existing `save_damage` on monster saves unchanged (e.g. Burning Hands vs enemy). |

### Combat

- Save rider damage during active combat cannot end the fight via hub respawn: at 0 HP with live enemy → **1 HP** + continue.
- Lethal enemy weapon hits still use existing defeat → safe hub respawn.

### Character / races

- MVP class save proficiencies unchanged (`saving_throw_proficiencies` at create).
- Halfling Lucky on saves via shared natural-1 reroll (one reroll, journal note).

### Frontend

- CS patterns for saving throw lines in `gameDisplay.ts`.
- Journal mechanic classifier already matches `Saving throw:`.

## C. Tests (local)

| Command | Result |
|---------|--------|
| `python -m pytest -q` | **555 passed**, 2 skipped |
| `python scripts/secret_scan.py` | OK |
| `npm run test:run` (Vitest) | **153 passed** |
| `npm run build` | OK |
| `npm run test:e2e -- saving-throw-combat.spec.ts` | **1 passed** (~17s) |
| Full E2E matrix (`npm run test:e2e`) | **24 passed** (~4.2 min) |

**Not verified:** PostgreSQL/Alembic on live PG (local SQLite/pytest).

### E2E (`saving-throw-combat.spec.ts`)

- UI wizard → engine quest chain (stream API) → **Vault of Echoes** → UI `look around the vault`.
- Asserts bilingual save lines + Dexterity + success/failure in the adventure journal.
- Engine fix: vault falling-stones hazard runs **before** exploration cooldown so travel-time encounters do not block the one-time trap.

## D. Changed files

- `app/engine/saving_throws.py` (new)
- `app/engine/combat_effects.py` (new)
- `app/engine/service.py`, `app/engine/models.py`
- `tests/test_saving_throws_v1.py` (new)
- `frontend/src/i18n/gameDisplay.ts`
- `frontend/e2e/saving-throw-combat.spec.ts` (new)
- `frontend/e2e/test-config.ts`
- `docs/SPRINT_18_SAVING_THROWS_COMBAT_EFFECTS_V1.md`
- `docs/PRODUCT_GAP_REGISTER_V1.md`, `docs/MASTER_PLAN_STATUS.md`

## E. Gap register (summary)

- **Player saving throws in play:** PARTIAL → **IMPLEMENTED** (engine + 3 in-game triggers; not every spell/trap in campaign).
- **Classes MVP saves:** **IMPLEMENTED** (stored + used on rolls).
- **Halfling Lucky on saves:** **IMPLEMENTED**.
- Dwarf resilience, Elf darkvision, broad condition system: unchanged / deferred.

## F. Known limits

- No player advantage/disadvantage from conditions yet.
- Bell Warden boss intentionally has no save rider (chapter stability).
- Save facts on `TurnResult.save_facts` for hazards; not yet exposed in API schema beyond events text.

## G. Next sprint proposal

**Sprint 19 — Class features & racial mechanics V1:** Fighting Style / Sneak Attack-scale hooks for Fighter & Rogue, Dwarf damage resistance on representative incoming damage, Elf perception cue — reusing saving-throw and damage pipelines.

## H. Acceptance

**READY FOR REVIEW** — pytest 555, Vitest 153, build OK, E2E 24/24, secret scan OK.

**No commit or push** performed.
