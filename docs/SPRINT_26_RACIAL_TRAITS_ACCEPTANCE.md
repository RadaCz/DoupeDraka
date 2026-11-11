# Sprint 26 — Racial traits V1 (Human, Elf, Dwarf, Halfling)

**Git baseline (start):** `3573362` (`clean-main`, Sprint 25 committed)  
**Working tree:** Sprint 26 implementation (**not committed** unless user asks)

## Audit matrix (SRD 5.1 / Ruleset v1 MVP)

| Rasa | Vlastnost | Stav | Poznámka |
|------|-----------|------|----------|
| Human | Ability score increases (+1 všech šest) | **IMPLEMENTED** | `catalog.apply_racial_ability_increases` / `RACE_SPECS` |
| Elf | Darkvision 60 ft | **DATA CONTRACT** | `darkvision_range_ft` + `race_features.darkvision_ft` (bez světelného modelu v kapitole 1) |
| Elf | Keen Senses (Perception) | **IMPLEMENTED** | `assemble_skill_proficiencies` + `ensure_race_proficiencies` on load |
| Elf | Fey Ancestry | **IMPLEMENTED (tagged)** | Výhoda na save s tagy `charm` / `charmed` |
| Elf | Trance | **DEFERRED** | Bez spánkové / watch mechaniky |
| Dwarf | Darkvision 60 ft | **DATA CONTRACT** | stejné jako Elf |
| Dwarf | Dwarven Resilience | **IMPLEMENTED (tagged)** | Výhoda na poison save; `apply_poison_damage_resistance` na poison damage |
| Dwarf | Stonecunning | **IMPLEMENTED (tagged)** | `skill_check(..., stonework=True)` — dvojnásobná proficiency na History |
| Halfling | Lucky | **IMPLEMENTED** | Jednotný `halfling_lucky_reroll` v `_d20_check` + `perform_saving_throw` |
| Halfling | Brave | **IMPLEMENTED (tagged)** | Výhoda na save s tagy `fear` / `frightened` |
| Halfling | Halfling Nimbleness | **DEFERRED** | Bez gridu / pohybového modelu |

## Engine

| Soubor | Role |
|--------|------|
| `app/engine/race_features.py` | Autoritativní katalog, Lucky, save advantage, poison resistance, Stonecunning, hydrate on load |
| `app/engine/saving_throws.py` | `tags` na requestu; rasová výhoda + Lucky |
| `app/engine/service.py` | `_d20_check`, `skill_check(stonework=)` |
| `app/engine/combat_effects.py` | `save_tags`, `damage_type` → saves + poison resistance |
| `app/engine/reference.py` | `/reference` race traits s `modeled` / `deferred` |
| `app/api.py` | `character_api_payload` → `race_features` na GET/create/stream |

## UI

- **CharacterWizard** step 1: trait list + status (Active / Deferred / Reference)
- **CharacterScreen**: sekce Rasové vlastnosti z `race_features`
- **i18n** EN/CS pro statusy a Temnobys

## Testy

| Oblast | Soubor |
|--------|--------|
| Engine matrix | `tests/test_sprint26_racial_traits.py` (15 cases) |
| ASI (legacy) | `tests/test_race_bonuses.py` |
| Vitest | `frontend/src/character/raceTraits.test.ts` |
| E2E | `character-creation-wizard.spec.ts` (modeled badge + sheet sekce) |

## DEFERRED (legitimní)

- **Trance**, **Halfling Nimbleness**, **Dwarven Combat Training** — žádná odpovídající herní mechanika v MVP
- **Darkvision** jako gameplay bonus — čeká na model světla / vize v exploraci
- **Tagované save scénáře v obsahu** — engine připraven; kapitola 1 zatím nemusí vystavit poison/charm/frighten save u každé rasy (E2E nevyžaduje umělý scénář)

## Verification (local — agent pass)

| Gate | Result | Notes |
|------|--------|-------|
| `pytest tests/test_sprint26_racial_traits.py` | **15 passed** | |
| Full `pytest tests/` | **649 passed**, 2 skipped (~60s) | +1 integration assertion for combat-blocked rest RNG |
| Vitest | **170 passed** | |
| `vite build` | **OK** | |
| Playwright full matrix | **34 passed** (~5.5m) | wizard modeled badge + dwarf racial section on sheet |
| `secret_scan.py` | **OK** | |

**CI / GitHub:** NOT VERIFIED until push.
