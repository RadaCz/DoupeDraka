# Sprint 24 — Background features in play V1

**Datum:** 2026-11-11  
**Git baseline (start):** `32ebfd7` (`origin/clean-main`)  
**Předchozí:** [`SPRINT_23_SKILL_CHECKS_PLAYER_AGENCY_ACCEPTANCE.md`](SPRINT_23_SKILL_CHECKS_PLAYER_AGENCY_ACCEPTANCE.md)

## Cíl

Šest MVP backgroundů má engine-authoritative jednorázové schopnosti v Chapter One — informační / sociální / přístupové, bez XP/gold exploitů.

## Sprint 23 fix

Bandit Camp Stealth s `bandit_camp_alerted`: `success = selected_roll.total >= dc` po výběru nižšího hodu (disadvantage).

## Background features

| Background | Feature | Lokace | Akce (chip) | Flag |
|------------|---------|--------|-------------|------|
| Acolyte | Shelter of the Faithful | Shrine | `seek shelter of the faithful` | `bg_acolyte_shelter_used` |
| Criminal | Criminal Contact | Goblin Market | `use criminal contact` | `bg_criminal_contact_used` |
| Folk Hero | Rustic Hospitality | Sunken Corridor | `call on rustic hospitality` | `bg_folk_hero_hospitality_used` |
| Sage | Researcher | Vault of Echoes | `use researcher training` | `bg_sage_researcher_used` |
| Soldier | Military Rank | Bandit Camp | `invoke military rank` | `bg_soldier_rank_used` |
| Hermit | Discovery | Underground River | `share hermit discovery` | `bg_hermit_discovery_used` |

Modul: `app/engine/background_features.py`. Hook v `service.resolve_action` po skill challenges.

## Testy

| Vrstva | Soubor |
|--------|--------|
| Unit + integration engine | `tests/test_sprint24_background_features.py` |
| Vitest | `backgroundFeatures.test.ts` |
| E2E (2 backgrounds) | `frontend/e2e/background-features.spec.ts` |

## Verifikace (lokální)

| Vrstva | Výsledek |
|--------|----------|
| pytest | **620 passed**, 2 skipped |
| Vitest | **163 passed** |
| build / secret_scan | OK |
| E2E (3 fáze) | **33/33 passed** |

## Otevřené

- Fyzický Telegram QA **NOT TESTED**
- Lidský playtest zábavy **NOT VERIFIED**

## Navržený commit message

```
feat(gameplay): engine background features for chapter one MVP

Model six SRD background gifts with idempotent quest flags; fix bandit
stealth disadvantage success; UI chips and character sheet status.
```
