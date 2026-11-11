# Sprint 20 — Character → Adventure (acceptance)

**Baseline:** `3102bf2` on `clean-main` (synced with `origin` at sprint start)  
**Sprint work:** local diff (not committed per sprint git rules)  
**Date:** 2026-11-11

## A. Verdict

**Sprint 20.1 (commit prep):** **READY FOR COMMIT** — automated gates below.

**Product / beta:** **NOT READY** — physical Telegram QA and facilitated 15‑min playtest **NOT DONE** (out of scope for this commit gate).

## B. What was already functional (pre–Sprint 20)

| Area | Evidence |
|------|----------|
| 9-step wizard + quick generate | `CharacterWizard.tsx`, `character_creation.py` |
| Standard array + racial ASI | `validate_standard_array`, wizard step 4 |
| 4 races / 4 classes / 6 backgrounds | `MVP_BACKGROUNDS`, `ruleset_v1` |
| Engine-authoritative create | `GameEngine.create_character`, API `POST /characters` |
| Character sheet V2 | HP, AC, XP, abilities, skills, gear, spells |
| Enter adventure → Whispering Cellar | `ENTER_ADVENTURE_BTN`, chapter-one entry |
| First turn E2E (fighter) | `adventure.spec.ts` |
| Creation E2E partial | `character-creation-wizard.spec.ts` |

## C. Sprint 20 changes

| Change | Purpose |
|--------|---------|
| Character sheet **Combat basics** block | Speed, proficiency bonus (display mirror), save proficiencies, initiative hint |
| Wizard identity step summary | Quick/step paths show race · class · background · abilities before name |
| `completeCharacterWizard` caster continues | Cleric/Wizard get spell step before identity |
| `tests/test_character_creation_mvp_matrix.py` | 16 race×class smoke creates |
| Rogue + Cleric pytest | `test_character_creation_v2.py` |
| `e2e/character-to-adventure.spec.ts` | Four classes: create → sheet → first `inspect` turn |
| Vitest | `proficiencyBonus`, sheet combat basics |

## D. Still not implemented / honest gaps

- Background **features** (Shelter of the Faithful, etc.) — narrative only; UI labeled.
- Most racial traits beyond ASI, speed, Halfling Lucky, Elf Perception — partial (`PRODUCT_GAP_REGISTER`).
- Class features beyond HD, saves, proficiencies, equipment, spell lists — thin.
- Ranged weapons, unequip-to-empty, full skill routing on free text — partial.
- Physical Telegram Mini App QA — **NOT TESTED**.
- Staging deploy — **NOT DEPLOYED**.
- `player-journey-hub` E2E — occasional RNG encounter flake in full matrix (Sprint 19.3).

## E. Test results (Sprint 20 local pass)

| Suite | Command | Result |
|-------|---------|--------|
| Backend pytest | `python -m pytest -q` | **582 passed**, 2 skipped |
| Secret scan | `python scripts/secret_scan.py` | OK |
| Vitest | `cd frontend && npm run test -- --run` | **158 passed** (41 files) |
| Build | `cd frontend && npm run build` | OK |
| E2E character-to-adventure | `npm run test:e2e -- character-to-adventure.spec.ts` | **4/4 passed** |
| E2E full matrix | `npm run test:e2e` (3 phases) | **30/30 passed** — log `.e2e-full-run-sprint201.txt` (~5 min) |
| GitHub Actions | — | **`gh` unavailable**; `3102bf2` push not re-checked; Sprint 20 diff **unpushed** |

## F. Changed files (Sprint 20 diff)

| Path | Kind |
|------|------|
| `frontend/src/screens/CharacterScreen.tsx` | Combat basics on sheet |
| `frontend/src/character/characterSheet.ts` | `proficiencyBonus`, save formatter |
| `frontend/src/styles/character-v2.css` | Sheet styles |
| `frontend/src/i18n.tsx` | CS labels |
| `frontend/src/CharacterWizard.tsx` | Identity-step build summary |
| `frontend/e2e/telegram.ts` | Caster wizard continue count |
| `frontend/e2e/character-to-adventure.spec.ts` | **NEW** 4-class E2E |
| `frontend/e2e/test-config.ts` | ID band `775_000_000` |
| `tests/test_character_creation_mvp_matrix.py` | **NEW** 16 creates |
| `tests/test_character_creation_v2.py` | Rogue + Cleric cases |
| `frontend/src/character/characterSheet.test.ts` | Unit tests |
| `frontend/src/screens/CharacterScreen.test.tsx` | Unit tests |
| `docs/SPRINT_20_CHARACTER_TO_ADVENTURE_ACCEPTANCE.md` | **NEW** |
| `docs/RULESET_v1.md`, `PRODUCT_GAP_REGISTER_V1.md`, `MASTER_PLAN_STATUS.md`, `GAMEPLAY_COMPLETENESS_AUDIT_V1.md` | Truth sync |

## G. Player journey checklist (15 min)

| Step | Status |
|------|--------|
| Create character (4 classes) | **OK** (engine + new E2E) |
| Understand sheet stats | **IMPROVED** (combat basics) |
| Enter Chapter One | **OK** |
| Talk / explore / combat | **OK** in engine; explore E2E sample |
| Journal + sheet reflect outcomes | **OK** (engine truth) |
| All classes distinct in MVP | **PARTIAL** (spells vs martial; features thin) |

## H. Git

- **Do not commit/push** this sprint without explicit user approval (sprint §11).
- Untracked logs/data remain excluded from any future commit.
