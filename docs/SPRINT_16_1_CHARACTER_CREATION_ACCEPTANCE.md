# Sprint 16.1 — Character Creation Acceptance, Rules Audit & E2E

**Date:** 2026-11-11  
**Repo HEAD (unchanged):** `50a88900756792d72284b40fb162f5639a5c29e9` (`clean-main`, synced with `origin/clean-main`)  
**Policy:** No commit, push, or deploy in this sprint.

---

## 1. Working tree split

### Sprint 16 — gameplay / character creation (this audit scope)

| Area | Files |
|------|--------|
| Engine | `app/engine/character_creation.py` (new), `models.py`, `service.py`, `spells.py`, `reference.py` |
| API | `app/api.py`, `app/schemas.py` |
| Frontend | `CharacterWizard.tsx`, `character/creation.ts`, `CharacterScreen.tsx`, `types.ts`, `i18n.tsx`, `App.test.tsx` |
| Tests | `tests/test_character_creation_v2.py` (new), assorted engine/API test updates |
| E2E | `frontend/e2e/telegram.ts`, `character-creation-wizard.spec.ts` (new), `adventure.spec.ts` |
| Product docs | `docs/PRODUCT_GAP_REGISTER_V1.md`, `docs/SPRINT_16_CHARACTER_CREATION_V2.md` |
| Planning | `PROJECT_BRAIN.md`, `ROADMAP.md` |

### Sprint 15.3 / 15.3.1 — staging documentation only (untouched in 16.1 logic)

- `docs/DEPLOYMENT.md`, `docs/STAGING_RUNBOOK_V1.md`, `docs/STAGING_DEVICE_VALIDATION_V1.md`
- `docs/SPRINT_15_3_STAGING_AND_PLAYER_VALIDATION.md`, `docs/SPRINT_15_3_1_DOCUMENTATION_TRUTH_SYNC.md` (untracked)

**Preserved:** `data/`, pytest flake logs, `tools/audit_cs_suspects.py`.

---

## 2. Audit summary (SRD 5.1 MVP 4×4)

| Rule area | Verdict | Evidence |
|-----------|---------|----------|
| Standard array 15–8, unique | **OK** | `validate_standard_array`, wizard step 4 |
| Racial ASI (Human +1 all, Elf DEX +2, Dwarf CON +2, Halfling DEX +2) | **OK** | `apply_racial_ability_increases`, `test_race_bonuses.py` |
| Background skills + no duplicate class picks | **OK** | `validate_class_skills` |
| Class save proficiencies stored | **OK** | `saving_throw_proficiencies()` on `CharacterState` |
| Player save rolls in play | **PARTIAL** | `saving_throw()` added; monster saves only in spell resolution today |
| Level-1 HP (hit die + CON mod) | **OK** | `create_character` |
| Starting equipment + background gold | **OK** | `EQUIPMENT_PACKAGES`, `parse_starting_gold`; parametrized tests ×6 backgrounds |
| Wizard/cleric spell picks | **OK** | `validate_spell_picks`, `apply_creation_spell_choices` |
| Skill proficiency in explore checks | **OK** | `skill_check`, `EXPLORE_SKILL_CUES` |
| Halfling Lucky | **FIXED in 16.1** | `_d20_check` → attack, ability checks, skill checks, `saving_throw()` |
| Elf Perception | **OK** | `assemble_skill_proficiencies` |
| Background features | **Narrative only** | UI label added; engine does not apply |
| Most racial traits (Darkvision, Dwarf resilience, etc.) | **REFERENCE_ONLY** | `reference.py` / UI — not in combat |

---

## 3. Fixes applied in Sprint 16.1

1. **Halfling Lucky** — unified `_d20_check()` for natural 1 reroll on attacks, ability checks, skill checks, and new `saving_throw()`; journal lines append lucky note.
2. **E2E wizard** — `completeCharacterWizard()` traverses 9-step flow; legacy `completeWizardFighter()` updated; Playwright card selectors use name prefix regex.
3. **New E2E** — `character-creation-wizard.spec.ts`: manual dwarf/fighter/soldier, elf wizard, quick generate, 375px overflow smoke.
4. **Regression E2E** — `adventure.spec.ts` accepts `Investigation check` (skill routing for “inspect”).
5. **UI honesty** — background feature footnote (narrative-only); spell step requires exact pick counts.
6. **CS copy** — wizard step strings and background names (partial; skills/spells still often EN in pills).

---

## 4. Test results

| Suite | Result |
|-------|--------|
| `pytest -q` | **523 passed**, 2 skipped |
| Vitest | **153 passed** |
| `npm run build` | **OK** (no duplicate-key warnings after i18n cleanup) |
| Playwright `character-creation-wizard.spec.ts` | **4/4 passed** |
| Playwright `adventure.spec.ts` (wizard + turn) | **passed** after investigation-check assertion |

**Note:** Full E2E matrix (chapter-one, mobile-viewports, visual) not re-run in 16.1; recommend CI run before merge.

---

## 5. Remaining gaps (→ Sprint 17)

- Player **saving throws** not invoked on monster actions / traps.
- **AC** from worn armor; fighting styles; most **class features**.
- **Human** Versatile / extra skill — reference only.
- **Halfling Nimbleness**, **Brave**, **Dwarf** resistance — not modeled.
- **Background features** — narrative only (by design until modeled).
- Skill routing still **keyword-cued** (not all SRD skills).
- Wizard **Czech** for skill/spell pill labels; diacritics pass on older strings.
- Staging HTTPS / device QA — still **NOT VERIFIED** (15.3 docs).

---

## 6. Commit readiness

| Question | Answer |
|----------|--------|
| HEAD at `50a8890`? | **Yes** |
| Destructive git used? | **No** |
| Engine authority preserved? | **Yes** |
| Old characters compatible? | **Yes** (defaults on new fields) |
| Pay-to-win / economy touched? | **No** |
| Ready to commit Sprint 16 + 16.1? | **Yes — after human review** |

Suggested commit split (optional):

1. `feat(character): SRD 5.1 creation v2 + 16.1 acceptance fixes`
2. `docs(staging): sprint 15.3 / 15.3.1 runbooks` (separate)

---

## 7. Updated gap register

See [`PRODUCT_GAP_REGISTER_V1.md`](PRODUCT_GAP_REGISTER_V1.md) (revision for 16.1).

---

**STOP** — Awaiting review. No commit/push/deploy.
