# Sprint 16 — Character Creation V2 & RPG Foundation

**Baseline HEAD:** `50a88900756792d72284b40fb162f5639a5c29e9` (`clean-main`, synced with `origin`)  
**Constraints honored:** no commit, push, deploy, economy/narration pricing changes, E3 D6, new chapters.  
**Also uncommitted from Sprint 15.3/15.3.1:** staging doc truth-sync (`docs/STAGING_*.md`, sprint reports).

## Git & working tree

| Check | Status |
|-------|--------|
| HEAD `50a8890` | **PASS** |
| Branch `clean-main` | **PASS** |
| Destructive git | **PASS** (none) |
| Untracked preserved | **PASS** (`data/`, pytest logs, `tools/audit_cs_suspects.py`) |

## What changed

### Engine & API
| File | Change |
|------|--------|
| `app/engine/character_creation.py` | **NEW** — SRD MVP: 6 backgrounds, class skill picks, equipment packages, spell validation, standard array |
| `app/engine/models.py` | New persisted fields (`background`, `skill_proficiencies`, `saving_throw_proficiencies`, `speed`, personality, `equipment_package`) with defaults |
| `app/engine/service.py` | `create_character()` uses creation pipeline; `skill_check` / `skill_modifier`; explore cues; **Halfling Lucky** on attacks |
| `app/engine/spells.py` | `apply_creation_spell_choices()` when API sends explicit picks |
| `app/engine/reference.py` | MVP backgrounds with `key` + `mvp_playable` |
| `app/schemas.py` / `app/api.py` | Extended `CharacterCreate`; `/reference.character_creation` |

### Frontend
| File | Change |
|------|--------|
| `frontend/src/CharacterWizard.tsx` | 9-step wizard (race → class → background → abilities → skills → gear → spells → identity → review) |
| `frontend/src/character/creation.ts` | Standard array helpers |
| `frontend/src/types.ts` | Character + `CharacterCreationReference` types |
| `frontend/src/screens/CharacterScreen.tsx` | Background + skill list on sheet |

### Tests & docs
| File | Change |
|------|--------|
| `tests/test_character_creation_v2.py` | **NEW** (9 tests) |
| Gold/assertion updates for starting background gold | `test_engine.py`, `test_economy_balance.py`, `test_quests_engine.py`, `test_integration.py`, `test_gameplay_integrity.py` |
| `docs/PRODUCT_GAP_REGISTER_V1.md` | **NEW** |
| `PROJECT_BRAIN.md`, `ROADMAP.md` | Sprint 16 status (actual completed work, not plans) |

## Implemented vs still missing (player-visible)

| Mechanic | Sprint 16 |
|----------|-----------|
| Standard array + racial ASI | **IMPLEMENTED** |
| 6 MVP backgrounds (skills, gear, start gold) | **IMPLEMENTED** |
| Class skill picks (4 MVP classes) | **IMPLEMENTED** |
| Equipment packages | **PARTIAL** (inventory labels; armor not dynamic AC) |
| Wizard/cleric spell picks at create | **IMPLEMENTED** when sent from wizard |
| Skill proficiency on rolls | **PARTIAL** (explore-related skill cues) |
| Halfling Lucky (attack d20) | **IMPLEMENTED** |
| Elf Perception proficiency | **IMPLEMENTED** |
| Dwarf/Human trait mechanics | **REFERENCE_ONLY** |
| Background features | **REFERENCE_ONLY** (narrative) |
| Class features (Fighting Style, Sneak Attack, …) | **MISSING** / deferred |
| Preset/quick paths | **IMPLEMENTED** (engine defaults; presets keep optimized arrays) |

## Verification

| Suite | Result |
|-------|--------|
| `python -m pytest -q` | **PASS** — **516 passed**, 2 skipped |
| `npm run test:run` (Vitest) | **PASS** — **153 passed** |
| `npm run build` | **PASS** |
| Playwright E2E | **NOT VERIFIED** (not run this sprint) |
| `secret_scan.py` | **NOT RUN** (no code change requirement beyond docs) |

## Sprint 17 follow-ups

1. Model **armor from inventory** into AC (fighter chain vs leather package).
2. Expand **skill checks** beyond explore cues (social, travel, quest).
3. **Racial traits:** Dwarf poison save/resistance, Darkvision flags (even if narrative-first).
4. **Background features:** one mechanical hook each (e.g. Criminal contact stub).
5. **Wizard CS/EN copy** for new wizard steps; mobile layout pass.
6. **E2E** `chapter-one-quest` on this tree after review.
7. Commit bundle: Sprint 15.3 docs + Sprint 16 code (user approval).

## PRODUCT_GAP_REGISTER

See [`PRODUCT_GAP_REGISTER_V1.md`](PRODUCT_GAP_REGISTER_V1.md) — narrator tiers: Lite free offline; Normal 1 ⚡ per delivered narration; Pro deferred; `LLM_PROVIDER=fallback` = Lite only.

## STOP

No commit or push. Awaiting review.
