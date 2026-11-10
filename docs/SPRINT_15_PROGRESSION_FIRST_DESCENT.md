# Sprint 15 — Story-Paced Progression & First Descent V1

**Datum:** 2026-11-10  
**Baseline:** `dc08808` (lokální změny, **bez commit/push**)  
**Cíl:** L3 z hlavní cesty bez povinného `search` grindu; první vstup do Vaultu = herní moment.

---

## 1. XP rozpočet (před → po)

### Před (hlavní cesta bez bojů mimo explore grind)

| Zdroj | XP | level_up |
|-------|-----|----------|
| Vrácení zvonu | 30 | ano |
| Odemčení vault route | 0 | — |
| První sestup do Vaultu | 0 | — |
| **Součet před bývalým pit grindem** | **30** | L1 |

→ Na L3 chybělo **~170 XP** z opakovaného `search`/bojů (viz Sprint 14 sim).

### Po (povinná hlavní cesta, bez Crypt)

| Pořadí | Událost | XP | Flag (idempotence) |
|--------|---------|-----|---------------------|
| 1 | Vrácení zvonu | 30 | `bell_quest_complete` |
| 2 | Caldus odhalí vault | **50** | `story_xp_vault_route_awarded` |
| 3 | First descent — porazit kobolda | **35** | combat + `_vault_descent_cleared_kill` |
| 4 | First descent — story bonus | **85** | `vault_first_descent_story_awarded` |
| **Celkem** | | **200** | **L3** (0 XP v baru) |

Volitelně Crypt: **+10** (nyní s `level_up` smyčkou přes `apply_xp_with_level_ups`).

**Boss:** 180 XP, tier 3 gate, HP/Rewards **beze změny**.

Kobold (5 HP) místo skeletonu: krátký deterministický souboj pro všechny MVP třídy; stále engine combat.

---

## 2. Průchody čtyř tříd (simulace)

Nástroj: `tools/simulate_story_main_path.py`  
Cesta: bell arc → travel Vault → first descent combat (bez `search`).

| Class | Seeds 0,1,7,42,99 | L≥3 | Poznámka |
|-------|-------------------|-----|----------|
| fighter | 5/5 OK | ano | combat_turns 1–3 |
| wizard | 5/5 OK | ano | 1–4 tahy |
| cleric | 5/5 OK | ano | 1–4 tahy |
| ranger | 5/5 OK | ano | 1–4 tahy |

Crypt volitelný (seed 42): všechny třídy **L3**, +10 XP v baru.

---

## 3. First Descent (design)

- **Trigger:** `travel` do `The Vault of Echoes` při `vault_unlocked`, dokud není `vault_first_descent_story_awarded`.
- **Souboj:** `build_monster(..., "kobold")`, `in_combat` jako u explore encounteru.
- **Reprise:** po útěku/padnutí lze vstoupit znovu — text „echoes still hunt…“, nový spawn dokud není udělen story bonus.
- **Journal:** discovery line + combat facts + XP řádky.

---

## 4. Progression guidance

- Nový quest krok `vault_first_descent` (engine + `questProgress.ts`).
- Hint: alespoň **úroveň 3** před Bell Wardenem.
- Caldus vault reveal: doplněn text o nutnosti zkušenosti před jámou.
- Existující `attack_block_message` pro L&lt;3 na Wardenovi beze změny.

---

## 5. Změněné soubory

| Soubor | Změna |
|--------|--------|
| `app/engine/chapter_one_progression.py` | **nový** — XP, descent, idempotence |
| `app/engine/quests.py` | vault XP, crypt level_up, quest step |
| `app/engine/service.py` | `_travel` + monster, descent reward hook, `_grant_xp` multi-level, crypt level_up |
| `frontend/src/questProgress.ts` | krok vault_first_descent |
| `frontend/src/i18n/gameDisplay.ts` | CS řádky nového XP |
| `frontend/e2e/chapter-one-quest.spec.ts` | bez `ensureLevelAtLeast` |
| `frontend/e2e/chapter-one-e2e-helpers.ts` | `completeVaultDescentViaEngine` |
| `tools/simulate_story_main_path.py` | **nový** |
| `tests/test_sprint15_story_progression.py` | **nový** |

---

## 6. Testy

| Běh | Výsledek |
|-----|----------|
| `pytest tests/test_sprint15_story_progression.py` | 30 passed |
| `pytest tests/test_chapter_one.py tests/test_quests_engine.py` | regrese OK |
| `pytest tests/test_gameplay_integrity.py tests/test_chapter_one_boss.py` | 21 passed |
| `vitest questProgress.test.ts` | (+ nový test descent step) |
| E2E `chapter-one-quest.spec.ts` | upraveno, **ne spuštěno** v tomto sprintu |

Idempotence: unit (vault route / story XP) + stream duplicitní idempotency key (stav postavy).

---

## 7. Akceptační kritéria

| # | Kritérium | Splněno |
|---|-----------|---------|
| 1 | L3 bez povinného search grindu | **ANO** (sim 4×5 seedů) |
| 2 | Crypt volitelný | **ANO** |
| 3 | První sestup smysluplný + trvalý flag | **ANO** |
| 4 | XP ne dvakrát | **ANO** (flagy) |
| 5 | 4 třídy sim | **ANO** |
| 6 | Boss beze změny gate/reward | **ANO** (testy) |
| 7 | Hráč ví co dál | **ANO** (quest hint; **device playtest NOT TESTED**) |

---

## 8. Rizika / otevřené

- **L4–L5** stále vyžadují dobrovolný explore (záměr).
- Velmi špatné RNG v souboji může vyžadovat **reprise** cestu do vaultu (sprint akceptuje).
- E2E a Telegram QA na zařízení **NOT TESTED** po změně.
- `_grant_xp` nyní může levelovat vícekrát v jednom grantu — ovlivňuje jen velké XP balíky; regrese boss OK.

---

*Sprint 16 nezačínán. Commit/push dle uživatele.*
