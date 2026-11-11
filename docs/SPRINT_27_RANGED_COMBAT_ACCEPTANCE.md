# Sprint 27 — Ranged combat & tactical positioning V1

**Git baseline:** `cfb2199` (Sprint 26 committed)  
**Working tree:** Sprint 27 — **not committed** unless user asks

## Pre-implementation audit (summary)

| Topic | Before Sprint 27 |
|-------|------------------|
| Weapon ranges | None — all melee implicit 5 ft |
| Combat distance | Not stored |
| Player ranged | Spells only; bows UI-only |
| Kobold | Melee swing + spittle on hit |
| Movement in combat | Flee (action) only |
| Action economy | Sprint 25 intact |

## Implemented

### Weapon model (`equipment.py`, SRD 5.1 feet)

| Weapon | Damage | Type | Normal / Long | Notes |
|--------|--------|------|---------------|-------|
| Shortsword, longsword, rapier, mace, dagger, quarterstaff | per SRD dice | melee 5 ft | — | Finesse where SRD |
| Dagger, handaxe, javelin, spear | + thrown ranges | 20–120 ft | thrown |
| Shortbow / longbow | piercing ranged | 80/320, 150/600 | ammunition: arrow |
| Light / heavy crossbow | piercing ranged | 80/320, 100/400 | ammunition: bolt |

Fighter **archer** package: longbow + shortsword + 20 arrows. Rogue **scout**: shortbow + arrows.

### Range rules (`combat_range.py`)

- Attack denied beyond max range — **no Action spent** (checked before `reserve_combat_cost`)
- Long range: disadvantage
- Ranged weapon within 5 ft: disadvantage
- Ammunition consumed on resolved attack (arrows decrement)

### Positioning (`combat_positioning.py`)

- `combat_distance_ft`, `combat_movement_remaining_ft` on `CharacterState` (persisted)
- Opening distances: default **5 ft** melee; **kobold 60 ft**
- Player **advance / step back** (`COMBAT_MOVE` intent) — uses movement only, not Action
- Movement resets on player turn start (with Sprint 25 economy)
- Enemy melee closes; **kobold** ranged profile (80/320), listed in `RANGED_ATTACK_MONSTERS`

### UI

- `CombatTacticsStrip` — distance, movement left, weapon range, disadvantage hint
- Combat deck: Advance / Step back chips
- API `combat_tactics` on character payload in combat

### Sprint 26 QA follow-up

- E2E `racial-traits-four-races.spec.ts` — four ancestries wizard + sheet section

## DEFERRED

| Item | Reason |
|------|--------|
| Opportunity attacks | No reaction trigger flow |
| Loading / heavy property enforcement beyond disadvantage text | No reload action |
| Crossbow bolt inventory in creation packages | Only arrows in fighter/rogue packs |
| Grid / zones | Explicit non-goal |
| Spell range gates | Spells unchanged (chapter balance) |

## Tests (local agent pass)

| Gate | Result |
|------|--------|
| `tests/test_sprint27_ranged_combat.py` | 8 tests |
| Sprint 25 + 19 combat regressions | Re-run with full suite |
| Vitest `combatRange.test.ts` | pending in full npm test |
| Playwright | +4 race spec; full matrix pending |
| GitHub CI Sprint 26 | **Not verified** (`gh` unavailable locally) |

## Chapter One

Melee encounters default 5 ft — chapter journey unchanged. Kobold opens at 60 ft for ranged skirmish.
