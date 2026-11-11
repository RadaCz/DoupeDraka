# Sprint 23 — Meaningful skill checks & player agency V1

**Datum:** 2026-11-11  
**Git baseline (committed):** `9e7fbac` (`origin/clean-main`) — Sprint 22 merged  
**Sprint 23:** lokální working tree (necommitováno)  
**Předchozí:** [`SPRINT_22_CHAPTER_ONE_GAMEPLAY_ACCEPTANCE.md`](SPRINT_22_CHAPTER_ONE_GAMEPLAY_ACCEPTANCE.md) (`9e7fbac`)

## Cíl

Fail-closed action resolution, engine-authoritative skill challenges s trvalými důsledky, volitelná výprava **Bandit Camp** (stealth / social / combat), UI chips + testy — bez nového quest frameworku ani LLM rozhodování.

## Akční resolution (engine)

| Vstup | Chování |
|-------|---------|
| Známý intent (explore, travel, combat, spell, NPC, quest) | Existující resolver |
| Scoped inspect / discovery | `discoveries.py` |
| Bandit Camp skill fráze @ camp | `skill_challenges.try_skill_challenge` |
| Neznámý / nepodporovaný text | Bez hodu, `state_changed=False`, žádné XP/gold/spell slot |
| TALK bez NPC | Bez generického Cha DC 12 |

`parse_action_intent` → neznámý text = **UNKNOWN** (ne CHECK).

## Skill challenges — Bandit Camp

| ID | Skill | DC | Úspěch | Neúspěch |
|----|-------|-----|--------|----------|
| `bandit_camp_stealth` | Stealth (Dex) | 13 | `bandit_shrine_evidence`, +20 gp, *Shrine goods ledger*, `bandit_stealth_challenge_done` | `bandit_camp_alerted`; social DC +2; hráč může jinou cestu |
| `bandit_camp_social` | Deception / Persuasion / Intimidation (Cha) | 14 (+2 if alerted) | Stejná evidence (idempotent) | challenge done, alert; bez evidence |
| Combat | — | — | Captain kill @ camp → `bandit_captain_defeat_rewards` | — |

Volitelné — **nepovinné** pro Vault / Bell Warden / 200 XP main path.

## MUST HAVE tests

| Soubor | Pokrytí |
|--------|---------|
| `tests/test_sprint23_skill_challenges.py` | unknown action, talk, stealth/social/combat, persistence, proficiency |
| `tests/test_intent.py` | UNKNOWN intent |
| `tests/test_engine.py` | fail-closed unknown phrases |
| `frontend/e2e/bandit-camp-skill.spec.ts` | travel → notice → skill path → `bandit_shrine_evidence` |

Zachováno: `chapter-one-quest`, `class-identity`, `combat-saves`, `character-to-adventure`.

## Verifikace (lokální, 2026-11-11)

| Vrstva | Výsledek |
|--------|----------|
| Full `pytest -q` | **602 passed**, 2 skipped |
| Vitest | **161 passed** |
| `npm run build` | OK |
| `secret_scan` | OK |
| E2E full (3 fáze) | **32/32 passed** (chapter-one, combat-saves, smoke incl. `bandit-camp-skill`) |
| Baseline CI run #64 (`9e7fbac`) | **GREEN** (user-reported; pytest 596, PG 10, Vitest 161, E2E 31) |

## NOT in scope

Kapitola 2, nové třídy/rasy, AI quest engine, NPC DB memory, redesign, staging deploy.

## Navržený commit message

```
feat(gameplay): fail-closed actions and Bandit Camp skill challenges

Remove generic skill/charisma fallbacks; add engine skill challenges at Bandit
Camp with stealth, social, and combat evidence paths; UI chips and E2E.
```
