# Sprint 17 — Equipment, Armor & Armor Class V1

**Git HEAD (start / report):** `ebb4cd8ade948540bd97cfd557326b64cfc37236` (`clean-main`)  
**Commit / push:** none (per sprint scope)  
**Date:** 2026-11-11

## Summary

Single authoritative SRD 5.1 armor class in `app/engine/equipment.py`, with weapon / armor / shield slots on `item_instances`, equip & unequip through existing action API, combat reads `character.armor_class`, character UI shows worn gear and AC from server state.

## Changed files (Sprint 17 scope)

| Area | Files |
|------|--------|
| Engine | `app/engine/equipment.py`, `app/engine/service.py`, `app/engine/intent.py` |
| API | `app/api.py` (`load_character_state` on read) |
| Frontend | `frontend/src/types.ts`, `characterSheet.ts`, `CharacterInventoryPanel.tsx`, `CharacterScreen.tsx`, `game/equipmentRules.ts`, `game/inventoryCatalog.ts`, `i18n.tsx`, `styles/character-v2.css` |
| E2E | `frontend/e2e/inventory-equip.spec.ts` |
| Tests | `tests/test_equipment_armor_v1.py`, `tests/test_engine.py` |
| Docs | `docs/SPRINT_17_EQUIPMENT_ARMOR_V1.md`, `docs/PRODUCT_GAP_REGISTER_V1.md`, `docs/MASTER_PLAN_STATUS.md` |

(Unrelated local changes — staging 15.3 docs, `data/`, pytest logs — untouched by this sprint.)

## Implemented rules

### Armor class (`compute_armor_class`)

- Unarmored: `10 + DEX mod`.
- Light: base + full DEX.
- Medium: base + DEX capped at +2.
- Heavy: base only (no DEX).
- Shield: +2 when equipped and proficient (one slot; no stacking).
- Non-proficient or failed Strength requirement: worn armor does not apply (falls back to unarmored for body AC).

### Slots

- `equipped_slot`: `weapon` | `armor` | `shield` (legacy `equipped: true` → weapon via `migrate_item_instances`).
- Equip replaces prior item in the same slot.
- Item must be in `inventory`.

### Actions (intent)

- Equip: `equip <item>` (weapon / armor / shield routed in `equip_item_from_query`).
- Unequip: `unequip armor`, `unequip shield`, or `unequip <shield label>` (`UNEQUIP_PATTERN` in `intent.py`).

### Character creation

- `apply_starting_equipment`: adds class body armor if missing (`STARTING_BODY_ARMOR`), builds instances, auto-equips first proficient body armor and shield in inventory, `refresh_armor_class`.
- MVP packages unchanged (`guardian` still grants `shield`); fighter typical AC **18** (chain 16 + shield 2).

### Persistence

- `load_character_state` on API read migrates legacy instances and refreshes AC (does not auto-save until next action).

### Combat

- Enemy attacks already compare against `character.armor_class` (`service.py`); value updates after equip/unequip before next attack.

## Frontend

- Character sheet: weapon, armor, shield cards; AC from API.
- Inventory: Armor & shields section; equip / unequip; proficiency & STR hints (`equipmentRules.ts`); CS/EN strings.
- UI updates from committed action response (existing flow), not optimistic.

## Test results (local)

| Suite | Result |
|-------|--------|
| `python -m pytest -q` | **536 passed**, 2 skipped |
| `npm run test -- --run` (Vitest) | **153 passed** |
| `npm run build` | **OK** |
| Playwright E2E | **Not re-run in this pass** — extend `inventory-equip.spec.ts` (shield unequip → AC drop); run full matrix before release |

## Gap register updates

- **Equipment / AC from worn gear:** **PARTIAL → IMPLEMENTED** (MVP armor set: leather, studded, scale, chain, shield; no full SRD catalog).
- **Inventory UI:** **PARTIAL → IMPLEMENTED** for weapon + armor + shield equip.
- Still **REFERENCE_ONLY / deferred:** bows, full armor list, accessory slots, attunement, dual-wield, weapon unequip.

## Known limits

- No `unequip weapon` (only swap via equip another weapon).
- `equipmentRules.ts` proficiency mirrors four MVP classes only (display hints; engine is authoritative).
- Legacy saves: AC recalculated on load; armor may need re-equip if old payload had class-tuple AC without slots.
- Chain mail Strength 13 enforced on equip only, not on forced migration.
- Staging 15.3 docs not modified.

## Acceptance checklist

| # | Criterion | Status |
|---|-----------|--------|
| 1 | Single AC function | Done |
| 2 | Armor & shield equippable | Done |
| 3 | Equip/unequip via API | Done |
| 4 | Combat uses live AC | Done |
| 5 | Character UI + AC | Done |
| 6 | MVP class starting gear | Done (tests) |
| 7 | Legacy payload migrate | Done |
| 8 | Backend tests | Done |
| 9 | Vitest | Done |
| 10 | Production build | Done |
| 11 | E2E | Spec updated; full run pending |
| 12 | Chapter One E2E | Not regression-tested in this pass |

## Working tree (audit)

Sprint 17 modifies engine, API, frontend, tests, and docs listed above. Other local untracked/modified artifacts (staging logs, `data/`, 15.3 reports) remain as before — no `git commit`, `push`, `reset`, or `stash`.
