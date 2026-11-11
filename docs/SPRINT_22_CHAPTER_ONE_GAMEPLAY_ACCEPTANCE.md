# Sprint 22 — Chapter One gameplay depth & completion V1

**Datum:** 2026-11-11  
**Git baseline:** `c542f75` (`origin/clean-main`) · working tree: Sprint 22 změny necommitované  
**Předchozí:** Sprint 21 class identity (`c542f75`)

## Cíl

Ověřit a dotáhnout **dokončitelnost** Chapter One bez umělého grindu — hlavní příběh, Vault, Bell Warden, persistence a vedení hráče.

## Audit hlavní cesty (skutečný engine)

| Krok | Spuštění | Engine stav | Journal / UI |
|------|-----------|-------------|--------------|
| Start | create → Whispering Cellar | `visited_locations` | mapa, deník |
| Caldus | chip / `talk … bell` @ Shrine | `bell_quest_accepted` | quest strip |
| Nib | travel Market → `ask Nib` | `bell_acquired`, inventory bell | chip |
| Return bell | chip / `return … Caldus` | `bell_quest_complete`, +30 XP, +10 gp | quest advance |
| Vault hint | `talk Caldus` after return | `vault_unlocked`, +50 XP (idempotent) | map unlock Vault/Pit |
| First descent | travel Vault | kobold encounter, +35 XP on kill | combat |
| Story milestone | kill / clear descent | +85 XP once (`vault_first_descent_story_awarded`) | **L3+** without search grind |
| Pit | map when `vault_unlocked` | travel allowed | lock copy if sealed |
| Bell Warden | L3+, pit, chip L3+ | `chapter_one_complete`, +25 gp | journal + QuestChronicle |

**XP budget (main, no Crypt):** 30 + 50 + 35 (kobold) + 85 = **200** → level **3** (`tests/test_sprint15_story_progression.py`, `tools/simulate_story_main_path.py`).

**Volitelné:** Forgotten Crypt search → +10 XP, +15 gp once (`crypt_relic_claimed`).

**Grind ochrana:** exploration gold **1× per location** (`gold_scavenge_*` flags); quest XP idempotent; boss gold idempotent (`tests/test_sprint22_chapter_one_completion.py`).

## Sprint 22 změny v kódu

1. **UI:** chip „Face the Bell Warden“ pouze při **level ≥ 3** (stejná brána jako engine).
2. **Testy:** idempotentní boss odměny, persistence `chapter_one_complete`, idempotentní bell return XP.
3. **Tool:** `simulate_story_main_path` — MVP třídy fighter/rogue/cleric/wizard.

Žádná změna XP tabulek ani obtížnosti bosse — auditem potvrzeno Sprint 15.

## E2E

- `chapter-one-quest.spec.ts` — UI chips + map → Caldus/Nib → vault → descent (engine combat) → pit L3+ → boss → journal „Chapter complete“ (~2.5–3 min chapter phase).
- Zachovány: class-identity, combat-saves, character-to-adventure.

## Verifikace (lokální, 2026-11-11)

| Vrstva | Výsledek |
|--------|----------|
| Chapter pytest subset + Sprint 22 new | **36+ passed** (viz běh agenta) |
| Full `pytest -q` | viz finální report |
| Vitest (gameActions.talk) | **8 passed** |
| `secret_scan` / `npm run build` | viz finální report |
| E2E full | viz finální report |
| GitHub Actions na tomto commitu | **NEOVĚŘENO** (`gh` nedostupný) |
| Fyzický Telegram | **NOT TESTED** |

## NOT in scope

- Kapitola 2, nové lokace, dialogový strom, LLM quest authoring, multiplayer, redesign UI.

## Navržený commit message

```
fix(chapter-one): gate Bell Warden chip until level 3 and add completion tests

Sprint 22 audit confirms story XP path; add idempotent boss/persistence tests.
```
