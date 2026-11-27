# Combat Fáze A — kompletní audit (docs only)

**Repo:** RadaCz/DoupeDraka  
**Baseline branch:** `main`  
**Baseline HEAD:** `bfa4048c3f7e5d350bea4400bb432dba432e1b7e`  
**Working tree při auditu:** čistý (`nothing to commit`)  
**CI na baseline HEAD:** [run #187](https://github.com/RadaCz/DoupeDraka/actions/runs/45849117440) — 6/6 jobů `success` (`backend`, `backend-slow`, `backend-postgres`, `docker-alembic`, `frontend`, `e2e`)

## Baseline testů (lokálně na HEAD, stejné příkazy jako CI)

| Vrstva | Příkaz | Výsledek |
|--------|--------|----------|
| Backend pytest (fast) | `python3 -m pytest -q -m "not slow"` | **907 passed**, 3 skipped, 21 deselected |
| Backend pytest (slow) | `python3 -m pytest -q -m slow` | **21 passed** |
| Frontend Vitest | `cd frontend && npm run test -- --run` | **344 passed** (77 souborů) |
| Playwright E2E | `cd frontend && E2E_PYTHON=python3 npm run test:e2e` | **119 passed**, 8 skipped |

Pre-existing failures: **žádné** v tomto běhu.

Legenda důkazů: **OVĚŘENO** = čtení kódu nebo test v repu na HEAD. **NOT VERIFIED** = nebylo spuštěno manuálně v Mini App / produkci.

---

## Doplněk Designera

### D1. Stav boje z enginu po tahu — payload a pole

API vrací postavu v `ActionResponse.character` (`app/schemas.py:58–77`) po každém `POST /characters/{id}/actions` i v `GET /characters/{id}`. Sestavení: `character_api_payload()` (`app/api.py:30–41`) = `asdict(CharacterState)` + `race_features` + volitelně `combat_tactics` **jen když** `in_combat`.

**Příklad JSON** (odvozen od `CharacterState` + `combat_tactics`, odpovídá polím v `app/engine/models.py` a testům `tests/test_sprint27_1_combat_integration.py`):

```json
{
  "in_combat": true,
  "combat_turn": "player",
  "combat_round": 1,
  "combat_distance_ft": 60,
  "combat_movement_remaining_ft": 25,
  "speed": 30,
  "combat_flags": {
    "action_used": false,
    "bonus_action_used": false,
    "reaction_used": false
  },
  "combatant": {
    "name": "Kobold skirmisher",
    "hp": 5,
    "max_hp": 5,
    "armor_class": 12,
    "template_key": "kobold"
  },
  "spell_slots": { "1": 2 },
  "max_spell_slots": { "1": 2 },
  "combat_reaction_pending": {},
  "combat_tactics": {
    "distance_ft": 60,
    "movement_remaining_ft": 25,
    "speed_ft": 30,
    "weapon_range": {
      "distance_ft": 60,
      "can_attack": false,
      "weapon_key": "mace",
      "weapon_type": "melee",
      "attack_mode": "melee",
      "normal_ft": 5,
      "long_ft": null,
      "denial": "Mace cannot reach — 60 ft away (melee reach 5 ft). Move closer first."
    }
  },
  "resolution": { "beats": [] }
}
```

`resolution` je součást odpovědi akce, ne trvalého stavu postavy.

| Pole | Typ / zdroj | Posílá API? | Poznámka |
|------|-------------|-------------|----------|
| `in_combat`, `combat_turn`, `combat_round` | string/bool/int, engine | **Ano** (kořen payloadu) | Frontend: `Character` částečně typovaný (`combat_round` v TS chybí, E2E ho čte z API). |
| `combat_distance_ft`, `combat_movement_remaining_ft` | int ft | **Ano** (kořen) | Duplicitně v `combat_tactics` při boji. UI primárně čte `combat_tactics` (`combatRange.ts:18–19`). |
| `combat_flags.action_used` / `bonus_action_used` / `reaction_used` | dict bool | **Ano** | Ekonomika: frontend odvozuje `readCombatEconomy()` (`combatEconomy.ts:14–22`). `economy_snapshot()` existuje jen v engine (`combat_action_economy.py:54–66`) — **ne** v API. |
| Vzdálenost k nepříteli | `combat_distance_ft` skalar | **Ano** (1 nepřítel) | Solo MVP — žádné pole „vzdálenost ke každému nepříteli“. |
| Dosah zbraně (normal/long) | `combat_tactics.weapon_range` | **Ano** (jen equipnutá zbraň) | `combat_range_facts()` (`combat_range.py:160–174`). |
| Dosah kouzel | — | **Ne** | V boji engine neporovnává `combat_distance_ft` s `range` kouzla z katalogu (**NOT VERIFIED** pro všechny modeled spells; grep bez zásahu v `service.py` u cast). |
| Munice | inventář + denial při útoku | **Částečně** | Stav munice není samostatné pole; odmítnutí v eventu (`service.py:2382–2390`). |
| `spell_slots` / `max_spell_slots` | dict | **Ano** | UI filtruje kouzla podle slotů (`spellbook.ts:55–58`). |
| `combat_reaction_pending` | dict | **Ano** | Okno Shield (`reactive_spells.py`, testy sprint 33). |
| Structured beats | `resolution` v odpovědi akce | **Ano** (per turn) | `turn_resolution.py` beats pro Combat V2 UI (`combatResolution.ts`). |

### D2. Tabulka akcí — odmítnutí před spotřebou Action/Bonus/Reaction

HTTP kód u většiny bojových zamítnutí: **200** + `ActionResponse` s `events` a `state_changed` implicitně přes obsah (engine `TurnResult.state_changed`). Výjimky transportu: **400** prázdná akce, **404** cizí postava, **409** pád / idempotency, **422** limit events (`api.py:1169–1192`).

| Akce (UI / intent) | Odmítnutí před spotřebou? | Mechanismus / text (soubor:řádek) | Spotřeba i při neúspěchu |
|--------------------|---------------------------|-------------------------------------|---------------------------|
| **Attack** mimo dosah | **Ano** | `evaluate_player_attack_range` → denial, `state_changed=False` (`service.py:2376–2380`; test `test_attack_out_of_range_no_action_spent`) | Ne |
| **Attack** bez munice | **Ano** | `has_ammunition` (`service.py:2382–2390`) | Ne |
| **Attack** mimo tah hráče | **Ano** | `_require_player_combat_turn` (`service.py:433–440`) | Ne |
| **Attack** paralyzovaný | **Ano** | `_begin_player_combat_action` / paralyzed (`service.py:443–455`) | Ne |
| **Advance / step back** (COMBAT_MOVE) | **Ano** (před pohybem) | špatný tah, mimo boj, 0 ft (`service.py:1087–1096`) | Ne; pohyb nebere Action (`test_sprint27_1`:40) |
| **Pohyb** nad budget | **Ano** | `apply_player_movement` (`combat_positioning.py:96–97`) | Ne |
| **Cast** (slot / třída / turn) | **Ano** | validace před `reserve_combat_cost` (`service.py:1429–1459`, `test_sprint31_spellcasting_integrity.py:37–40`) | Ne (slot) |
| **Cast** v boji bez ekonomie | **Ano** | `reserve_combat_cost` fail (`service.py:1468–1485`) | Ne |
| **Defend** | Částečně | turn/paralysis před `reserve_combat_cost`; pak spend action (`service.py:2510–2523`) | Akce spotřebována i když jen „dodge“ setup |
| **Flee** | **Ne** (P0) | `reserve_combat_cost` **před** DEX check (`service.py:2681–2698`) | **Ano** — neúspěšný útěk má `state_changed=True` a action_used |
| **Dash** (`cunning_dash`) | **Ano** před bonusem | třída/level/boj (`class_features.py:380–386`) | Ne |
| **Dash** u non-Rogue | **Ano** | stejná větev → „requires rogue level 2“ (`class_features.py:380–381`) | Ne |
| **Disengage** (Rogue bonus) | Částečně | bonus spend až po checks (`service.py:1039–1052`) | Ne při fail před spend |
| **Disengage** (Action) | Po turn checks | `reserve_combat_cost` action (`service.py:1059–1061`) | Spend i když jen flag disengage |
| **Second Wind / Hide** | Po turn checks | uvnitř feature funkce spend bonus | Hide fail = no spend (**OVĚŘENO** v class_features) |
| **Channel Divinity** v boji | Po turn checks | action reserve (`service.py:2266–2268`) před efektem | Ne při fail reserve |
| **End turn** | N/A | nebere pool | — |
| **Decline reaction** | **Ano** | bez spend (`reactive_spells`) | Ne |
| **Shield** reaction | Po validaci | spend reaction při úspěchu cast | **NOT VERIFIED** všechny failure větve |
| **Use potion** | Po turn checks | `reserve_combat_cost` action (`service.py:1133+`) | Spend při úspěšném použití |
| **UNKNOWN intent** | **Ano** | fallback zprávy (`service.py:2757+`) | Ne |

### D3. UI vs engine — nesoulad akcí

**UI nabízí, engine neumí / jinak:**

| UI akce | Problém | Priorita | Důkaz |
|---------|---------|----------|-------|
| **Disengage (Cunning)** u Rogue | UI vždy ukazuje jedno tlačítko; engine volí bonus vs Action podle `FLAG_BONUS_USED` (`service.py:1039–1052`) — hůře čitelné než dvě akce | P2 | |
| Kouzla mimo `MODELED_SPELL_EFFECTS` | V sheetu existují, combat deck filtruje `effect_modeled` — OK | — | `spellbook.ts:158–165` |
| Level-up text o Dash | UI copy tvrdí „Dash … nejsou v enginu“ | **P1** | `frontend/src/i18n.tsx:579–580` vs `use_cunning_dash` (`class_features.py:377`) |

**Engine umí, UI v combat decku nemá:**

| Engine intent / akce | UI | Priorita |
|----------------------|-----|----------|
| `retreat N ft` (numeric) | pouze „step back {15|moveStep} ft“ | P2 | `combat_move.py:17–20` |
| **Thrown** útok (sloveso throw/hodit) | žádné dedikované tlačítko | P2 | `combat_range.py:13–16` |
| **Arcane Recovery** | jen mimo combat v `gameActions.ts` | P1 (OK mimo boj) |
| **Equip** v boji | jen text composer | P2 |
| Univerzální **Dash** (SRD Action) | **neexistuje** — viz D4 | **P0** |

### D4. Dash — univerzální vs Rogue Cunning Action

**OVĚŘENO:** Univerzální SRD Dash jako Action pro všechny třídy **není** implementován.

- Jediná implementace: `use_cunning_dash()` — vyžaduje `rogue` + `level >= 2`, spend **bonus action**, přidá `speed` ft k `combat_movement_remaining_ft` (`class_features.py:377–398`).
- Intent mapuje `DASH_COMBAT_PATTERN` na `class_feature=cunning_dash` (`intent.py:325–326`); Fighter/Wizard s textem „dash“ dostanou stejnou větev → odmítnutí „requires rogue level 2“ (`service.py:2254–2259`).
- Obecná akce Dash v `BONUS_ACTION_CLASS` / action economy **chybí** (`combat_action_economy.py:21`).

**Závěr:** Dash = pouze Rogue Cunning Action (bonus), ne běžná Action pro všechny.

### D5. Jednotky — ft v enginu, m v českém UI

| Oblast | Jednotka | Převod | Důkaz |
|--------|----------|--------|-------|
| Engine / API | **ft** | — | `combat_distance_ft`, `combat_tactics.*_ft` |
| Combat UI (V2) | **ft** (cs: překlad `ft.` → „stop“) | **Žádný převod na m** | `CombatUI.tsx:43–47`, `CombatBattlefieldTrack.tsx:53`, `i18n.tsx:235` |
| Character wizard / darkvision | cs → **m** (`ft * 0.3`, mapa 30→9 m, 60→18 m) | `wizardDisplay.ts:3–20` |
| Composer texty „advance N ft“ | **ft** posílané do enginu | — | `combatActions.ts:327` |
| E2E API helpers | **ft** | — | `chapter-one-e2e-helpers.ts:15–23` |

**Riziko (P2):** Hráč na cs v boji vidí „stop“ (ft), jinde „m“ — není unify. **NOT VERIFIED:** zda engine někde přijímá „m“ v move příkazu (regex jen ft/stopy v `combat_move.py:7–19`).

---

## Oblasti auditu (oddíl 3 zadání) — shrnutí

### Backend

| Oblast | Existuje | E2E funguje | Jen UI / návrh | Nedokončené / chyby | Testy |
|--------|----------|-------------|----------------|---------------------|-------|
| `app/engine/` core | `service.py` `resolve_action`, RNG, turn flow | Ano — pytest + chapter E2E | — | Flee spotřebuje Action před neúspěchem **P0** | `test_integration.py`, sprint 27–38 |
| Intent routing | `intent.py` | Ano | — | `UNKNOWN` → obecná zpráva | intent + service tests |
| Movement | `combat_positioning.py`, `combat_move.py` | Ano | — | Jen 1 nepřítel | `test_sprint27_1_*` |
| Range / ammo | `combat_range.py` | Ano pro zbraně | — | Kouzla bez distance gate **P0** | `test_sprint27_ranged_combat.py` |
| Action economy | `combat_action_economy.py` | Ano | Frontend odvozuje flags | API neposílá `economy_snapshot` **P2** | `test_sprint25_*` |
| Class features | `class_features.py` | Částečně | Wizard Tradition deferred | Dash jen Rogue **P0** | `test_sprint36_*`, E2E rogue/cleric |
| Monsters / AI | `encounters.py`, profiles v positioning | Kobold 60 ft + ranged **OVĚŘENO** | — | Jedna aktivní bestie | `test_kobold_enemy_ranged_at_distance` |
| Spells | `spells.py` MODELED 15 efektů | Ano pro subset | Katalog SRD bez efektu | Dosah kouzla v boji | sprint 31–33, E2E spell |
| Equipment | `equipment.py` | AC/weapon attack | — | — | sprint 17 tests |
| Reactions / OA | `combat_reactions.py` | Ano | — | Sim helper auto-decline jen v testech | sprint 29–30, E2E |
| Persistence | `encode_character_state` | Ano | — | Denied akce stejně inkrementují `turn_count` a journal **P1** | `test_concurrency.py`, idempotency tests |
| API | `POST .../actions`, stream, idempotency | Ano | — | HTTP 200 i při reject | `api.py:943+` |

### Frontend (`frontend/src/combat/`)

| Komponenta | Účel | Poznámka |
|------------|------|----------|
| `CombatScreen.tsx` | layout boje | Skládá strip, moment, deck, battlefield |
| `CombatUI.tsx` | `CombatHeroStrip`, `CombatMoment`, `CombatActionDeck`, `CombatArena` | Hlavní V2 |
| `CombatBattlefieldTrack.tsx` | vzdálenost vizuál | **ft**, ne m |
| `combatActions.ts` | deck model | Disable attack při `can_attack=false` **OVĚŘENO** |
| `combatEconomy.ts` | lokální ekonomika | Odvozeno z flags |
| `TurnDeltaStrip` | sdílené | Adventure + combat |
| `CombatChronicleFold` | historie | |
| Telegram MainButton | `telegramWebApp.ts`, `App.tsx` | Journal composer, **ne** combat deck — **NOT VERIFIED** combat-specific MainButton |
| Safe areas / keyboard | `play.css`, `theme-dark.css`, `mobile-helpers.ts` | E2E `mobile-text-first.spec.ts` |

### Testy a dokumentace

- **Pytest combat:** `test_sprint19_unified_combat.py` … `test_sprint38_*`, `test_combat_turn_resolution.py`, helpers `combat_turn_helpers.py`.
- **Vitest:** `combatV2.acceptance.test.tsx`, `combatActions.test.ts`, battlefield AC16 testy.
- **Playwright:** `combat-reactions.spec.ts`, `rogue-cunning-action.spec.ts`, `combat-action-economy.spec.ts`, chapter journey combat loops.
- **Starší audity:** `GAMEPLAY_COMPLETENESS_AUDIT_V1.md`, `GAMEPLAY_CONTRACTS_V1.md` — užitečné, ale **nepřebírat bez re-verifikace** (tento dokument je autorita pro Fázi A na HEAD výše).

---

## Fáze E — scénáře 1–24

| # | Stav | Důkaz |
|---|------|-------|
| 1 Warrior vs melee | **Funguje** | základní attack flow `service._resolve_attack_turn` |
| 2 Warrior vs kobold 60 ft | **Částečně** | Vzdálenost OK (`ENCOUNTER_START_DISTANCE_FT kobold:60`); warrior nemá ranged bez změny výzbroje — hráč musí advance; UI disable attack **OVĚŘENO** |
| 3 Rogue Cunning Action | **Funguje** | dash/hide/disengage bonus; E2E `rogue-cunning-action.spec.ts` |
| 4 Cleric bojové kouzlo | **Částečně** | Sacred Flame modeled; bez distance check |
| 5 Wizard kouzlo na dálku | **Částečně** | Fire Bolt spell attack; distance k nepříteli neovlivňuje cast v kódu |
| 6 Útok mimo dosah | **Funguje** | denial bez action spend (`test_attack_out_of_range_no_action_spent`) |
| 7 Pohyb + útok | **Funguje** | COMBAT_MOVE pak attack v testech / E2E vault helper |
| 8 Opakovaný pohyb | **Funguje** | kumulace `movement_remaining` |
| 9 Dash + pohyb | **Částečně** | Jen Rogue bonus dash; žádný universal Dash |
| 10 Nedostatek munice | **Funguje** | `has_ammunition` gate |
| 11 Nedostatek slotů | **Funguje** | cast blocked, UI `no_slots` |
| 12 Lektar | **Funguje** | `use potion`, action economy |
| 13 Čekající reakce | **Funguje** | `combat_reaction_pending`, E2E reactive |
| 14 Odmítnutí reakce | **Funguje** | `decline reaction` |
| 15 Nepřítel na tahu | **Funguje** | combat_turn enemy, UI wait |
| 16 Smrt hráče | **Funguje** | death_state, E2E `fallen.spec.ts` |
| 17 Smrt nepřítele | **Funguje** | `_exit_combat`, XP |
| 18 Vítězství | **Funguje** | boss / chapter flags |
| 19 Útěk | **Částečně** | funguje, ale failed flee **spotřebuje Action P0** |
| 20 Refresh | **Funguje** | persisted state; testy reload |
| 21 Přerušení spojení | **NOT VERIFIED** | idempotency existuje, bez simulace sítě v tomto auditu |
| 22 Dvojité odeslání | **Funguje** | `Idempotency-Key`, `test_sprint36_1_channel_idempotency.py` pattern |
| 23 Malý displej | **Částečně** | screenshot/E2E 320–430 existují; combat-specific polish P2 |
| 24 Dlouhý název / narace | **NOT VERIFIED** | truncation v UI — neauditováno pixelově |

---

## Registr nálezů (priorita + důkaz)

| ID | P | Nález | Důkaz |
|----|---|-------|-------|
| N1 | **P0** | Univerzální Dash (SRD Action) chybí; jen Rogue Cunning Dash | `class_features.py:377–381` |
| N2 | **P0** | Kouzla v boji bez kontroly vzdálenosti k cíli | absence v `service.py` cast path; D1 tabulka |
| N3 | **P0** | Neúspěšný **Flee** spotřebuje Action před hodem | `service.py:2681–2698` |
| N4 | **P1** | Zastaralý cs/en copy: „Dash … nejsou v enginu“ | `i18n.tsx:579–580` |
| N5 | **P1** | Odmítnutá akce stále zapisuje journal event + `turn_count++` | `api.py:1272–1281` |
| N6 | **P1** | Preserve Life v combat decku jako action v boji — mimo CD kontext hráče | `combatActions.ts:181–192` |
| N7 | **P2** | Ekonomika jen z `combat_flags`, ne server snapshot | `combatEconomy.ts` vs `economy_snapshot` |
| N8 | **P2** | Boj cs UI v stopách, wizard v metrech | D5 |
| N9 | **P2** | `combat_round` v API bez TS typu | `types.ts` vs E2E |

**Počty:** P0 **3**, P1 **3**, P2 **3** (ověřené nálezy na HEAD).

### Top 5 P0

1. **N1** — chybí univerzální Dash Action.  
2. **N2** — spell range vs `combat_distance_ft` v enginu.  
3. **N3** — Flee consume-before-fail.  
4. **(z režimu boje)** Kobold 60 ft + melee warrior — mechanicky řešitelné pohybem, ale UX taktické hinty chybí (Fáze C) — `combatActions` má jen `denial` string, ne generovanou radu.  
5. **Solo vzdálenost** — žádný model více nepřátel (blokuje Fáze B 4.8 multi-foe).

---

## Shrnutí P0 / P1 / P2

| Priorita | Počet | Témata |
|----------|-------|--------|
| P0 | 3 | Dash, spell distance, flee economy |
| P1 | 3 | i18n copy, journal on reject, CD UI |
| P2 | 3 | economy snapshot API, jednotky, typy |

## Návrh pořadí malých PR (jen návrh, bez implementace)

1. **Docs/spec** — SRD Dash jako Action + spell range pravidla (schválení Rady).  
2. **P0 engine** — Flee: reserve action až po úspěšném útěku; universal Dash nebo explicitní „deferred“ v UI.  
3. **P0 engine** — Spell range gate v `resolve_cast` pro modeled combat spells.  
4. **P1 UX** — Opravit `i18n.tsx` Dash copy; taktický hint z `combat_tactics` (Designer 5.3).  
5. **P1 API/UX** — Journal/turn_count při `state_changed=false` (product decision).  
6. **P2** — `economy_snapshot` do `combat_tactics`; sjednocení m/ft v combat cs UI.

---

*Audit dokončen na branchi práce pro Fázi A. Žádný kód, test ani konfigurace mimo tento markdown a `COMBAT_OVERHAUL_BRIEF.md` nebyly měněny.*