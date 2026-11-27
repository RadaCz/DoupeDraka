# Soulad enginu se schválenými bojovými pravidly (Rada 27. 11. 2026)

**Baseline:** větev `main`, commit `87a097a` (lokálně ověřeno před tímto PR).  
**Rozsah auditu:** `app/engine/*`, `app/engine/service.py`, `app/api.py` (`combat_tactics`), frontend combat (`frontend/src/combat/*`, `gameActions.ts`).

**Legenda stavů:** SPLNĚNO · CHYBÍ · ODPORUJE · ČÁSTEČNĚ

---

## 1. Sprint / Dash

| Bod specifikace | Stav | Důkaz (soubory / řádky) | Test |
|-----------------|------|-------------------------|------|
| Univerzální **Action** Dash pro všechny třídy | **CHYBÍ** | Dash v boji jde jen přes `use_cunning_dash()` (rogue L2+, bonus action): `app/engine/class_features.py:377–399`; větvení v `app/engine/service.py:2254–2259`. Ne-rogue dostane „Cunning Action (Dash) requires rogue level 2.“ | `tests/test_combat_reject_before_roll_p0c.py` — `dash_non_rogue` (odmítnutí bez změny stavu); bez testu univerzální Action Dash |
| Přidá pohyb = rychlost postavy | **ČÁSTEČNĚ** | Rogue: `bonus_ft = speed`, přičte k `combat_movement_remaining_ft`: `class_features.py:387–390`. Univerzální Action varianta neexistuje. | `tests/test_sprint36_class_features.py::test_rogue_cunning_dash_adds_movement` |
| Rogue: Dash za **Bonus Action** (Cunning Action) | **SPLNĚNO** | `spend_bonus_action` před grantem: `class_features.py:384–386`; UI `economySlot: 'bonus'`: `frontend/src/combat/combatActions.ts:208–217`. | `test_sprint36_class_features.py::test_rogue_cunning_dash_adds_movement` |
| Správně již využitý pohyb, žádné dvojité přičítání | **SPLNĚNO** | Pohyb se odečítá v `apply_player_movement`: `combat_positioning.py:94–106`. Dash **přičítá** k aktuálnímu zbytku, neresetuje budget: `class_features.py:388–390`. Na začátku tahu hráče se budget nastaví na `speed`: `combat_positioning.py:75–76` voláno z `mark_player_turn_start` (`class_features.py:138–143`). | `tests/test_sprint27_ranged_combat.py::test_movement_budget_and_advance`; `test_sprint36_class_features.py::test_rogue_cunning_dash_adds_movement` |

**Poznámky k `movement_remaining`:** API/UI čtou `combat_tactics.movement_remaining_ft` z `positioning_facts` (`combat_positioning.py:147`, `api.py:37–39`). Frontend fallback bez API pole: `combatActions.ts:245–246`.

**Frontend:** i18n přiznává mezeru — „Dash a bonusové Disengage zatím nejsou v enginu“ ve smyslu SRD Action (`frontend/src/i18n.tsx:579–580`), přesto UI nabízí Dash jen rogue (`combatActions.ts:208–217`).

---

## 2. Dosah kouzel

### 2.1 Tabulka modeleovaných bojových kouzel (`MODELED_SPELL_EFFECTS` + `srd_spells.json`)

Data na **main** — engine **nepřepočítává** vzdálenost před castem; sloupce „main engine“ popisují skutečné chování.

| Kouzlo | Typ v enginu | Cílení / roll | Dosah v datech (SRD JSON) | Validace vzdálenosti na main | Test dosahu |
|--------|--------------|---------------|---------------------------|------------------------------|-------------|
| Burning Hands | `save_damage` | saving throw DEX | Self (15-foot cone) | **ne** — cast bez gate | `tests/test_sprint19_unified_combat.py` (save), `tests/test_spells.py::test_burning_hands_*` — bez distance |
| Sacred Flame | `save_damage` | saving throw DEX | 60 feet | **ne** | `tests/test_sprint19_unified_combat.py` — bez distance |
| Fire Bolt | `spell_attack` | attack roll | 120 feet | **ne** | `tests/test_spells.py` — bez distance |
| Eldritch Blast | `spell_attack` | attack roll | 120 feet | **ne** | bez testu dosahu |
| Magic Missile | `auto_damage` | auto | 120 feet | **ne** | bez testu dosahu |
| Scorching Ray | `multi_attack` | spell attack roll × paprsky | 120 feet | **ne** | bez testu dosahu |
| Vicious Mockery | `save_damage` | saving throw WIS | 60 feet | **ne** | bez testu dosahu |
| Bless, Cure Wounds, Healing Word, Mage Armor, Shield of Faith, Invisibility, Misty Step, Shield | neútočné / self / ally | dle druhu | různé | skip (není `ENEMY_DAMAGE_KINDS` v návrhu P0a) | — |

### 2.2 Bod po bodu specifikace

| Bod | Stav | Důkaz | Test |
|-----|------|-------|------|
| Sacred Flame 60 ft, Fire Bolt 120 ft | **ČÁSTEČNĚ** | Hodnoty v `app/engine/srd_spells.json:818`, `1749`; enforcement **chybí** v `_cast_spell` (`service.py:1208+`, žádný range check před slotem). | bez testu na main |
| Burning Hands: Self 15 ft kužel | **ODPORUJE** | Data: `srd_spells.json:244` („Self (15-foot cone)“). Engine modeluje jen `save_damage` bez geometrie kužele (`spells.py:93`). Na main lze castnout na libovolnou `combat_distance_ft`. | viz PR #35 níže |
| Všechna bojová kouzla správný dosah | **CHYBÍ** | Pouze distance v JSON + dokumentace `docs/SPELLCASTING_CONTRACT_V1.md:78` („not full spell range enforcement“). | `tests/test_combat_reject_before_roll_p0c.py` — **bez** případů cast beyond range |
| Neplatný dosah nesmí spotřebovat Action ani slot | **CHYBÍ** | `_begin_player_combat_action` / cast může rezervovat action před resolve; bez range gate slot může zmizet po úspěšném castu i mimo dosah. | bez testu |
| Serverová validace před změnou stavu | **CHYBÍ** | Kontrast: útok má `evaluate_player_attack_range` (`combat_range.py:47–98`, `service.py:2077–2083`). Kouzla ne. | `tests/test_sprint27_ranged_combat.py::test_attack_out_of_range_no_action_spent` — jen zbraně |
| Jednotky ft., UI může metry | **ČÁSTEČNĚ** | Engine používá `combat_distance_ft`, UI `ft.` (`CombatUI.tsx:47`). Kouzla v combat decku nemají range z API na main. | bez testu |

### 2.3 API `combat_tactics` (main)

`character_api_payload` na main (`api.py:37–40`) vrací pozicování + `weapon_range`, **ne** `spells[]`. Frontend neblokuje cast podle vzdálenosti (`combatActions.ts` — jen modeled spell list).

### 2.4 Otevřené PR **#35** (`cursor/combat-p0a-spell-range-3a94`)

| Oblast | Hodnocení |
|--------|-----------|
| Modul | `app/engine/combat_spell_range.py` — `parse_srd_range_ft` umí `Self` + `(\d+)-foot cone` → **15 ft** (`combat_spell_range.py:52–56`). |
| Burning Hands | `evaluate_spell_enemy_range`: povolí cast pokud `distance_ft <= 15` (`combat_spell_range.py:96–104`). Test: `test_burning_hands_fifteen_vs_twenty` — 15 ft OK, 20 ft deny bez slotu. **ČÁSTEČNĚ:** kužel se redukuje na „nepřítel max 15 ft přímo“, bez úhlu/šířky kužele; pro schválenou specifikaci MVP přijatelné, ale není to plná SRD geometrie. |
| Sacred Flame / Fire Bolt | Parametrizované testy 60 / 120 ft (`test_sacred_flame_*`, `test_offensive_spell_*`). |
| Hook v `service.py` | Kontrola před spotřebou slotu (~ř. 1462 v branch diff). |
| API | `combat_tactics.spells[]` s `range_ft`, `can_cast`, `denial`. |
| Co na #35 ještě chybí vs. spec | Explicitní dokumentace kužele v denial textu; případně rozlišení „touch“ heal vs. combat; sladění s `COMBAT_RULES_APPROVED.md` jako jediný zdroj pravdy (branch maže `COMBAT_SPEC_B_C.md` — merge řešit zvlášť). |

---

## 3. Útěk (Flee)

| Bod | Stav | Důkaz | Test |
|-----|------|-------|------|
| Action, d20 + DEX mod vs DC 10 | **SPLNĚNO** | `FLEE_DC = 10` (`service.py:119`); `ability_check` = d20 + mod (`service.py:1933–1935`); resolve `service.py:2674–2698`. | `tests/test_engine.py::test_failed_flee_keeps_the_fight_going`; `tests/test_combat_turn_resolution.py::test_flee_fail_beat_matches_journal` (dc 10) |
| Úspěch: opuštění souboje | **SPLNĚNO** | `_exit_combat`, `combat_over`, monster `None`: `service.py:2709–2714`. | `test_engine.py::test_fleeing_ends_the_fight_and_clears_the_combatant` |
| Neúspěch: Action spotřebována | **SPLNĚNO** | `reserve_combat_cost(..., "action")` **před** hodem: `2681–2683`; při fail `state_changed=True`, monster zůstane. | `test_combat_reject_before_roll_p0c.py::test_failed_flee_roll_still_consumes_action` |
| Zrušení před hodem: žádný hod / Action | **SPLNĚNO** | Blokace mimo tah hráče nebo bez action: `2676–2683`, `test_combat_reject_before_roll_p0c` — `flee_enemy_turn`, `flee_action_already_used`. | výše |
| Neúspěch **neukončí celý tah** automaticky | **SPLNĚNO** | Větev Flee **nevolá** `_maybe_advance_enemy_after_player_action` (`service.py:2674–2698` vs. např. cast `1715`). Po neúspěchu `combat_turn` zůstává `"player"` (ověřeno runtime: L2 rogue může použít bonus). UI má Flee chip (`combatActions.ts:378–383`). | `test_engine.py::test_failed_flee_keeps_the_fight_going`; runtime ověření v tomto auditu (bez dedikovaného E2E) |
| Idempotence | **ČÁSTEČNĚ** | Obecné `Idempotency-Key` + `ActionReceipt` v API (`api.py:1172–1179`, `commit_action_turn`). Žádný test specificky pro `flee`. | `tests/test_idempotency_receipt_binding.py` — obecné, ne flee |

**Poznámka:** `_finalize_turn_result` jen připojí beats (`turn_resolution.py:358–382`); neposouvá nepřítele po flee fail.

---

## 4. Ranged disadvantage

| Bod | Stav | Důkaz | Test |
|-----|------|-------|------|
| Nevýhoda na ranged **weapon** attacks | **ČÁSTEČNĚ** | `evaluate_player_attack_range`: `distance <= 5` + ranged → `disadvantage`, reason `ranged in melee` (`combat_range.py:81–85`). Aplikováno v `attack_advantage_roll` při útoku (`service.py:2092–2093`). | `tests/test_sprint27_ranged_combat.py::test_ranged_melee_disadvantage` |
| Nevýhoda na ranged **spell** attacks | **CHYBÍ** | Spell attack v `_cast_spell` jde `self.roll("1d20", ability_bonus)` bez range disadvantage (`service.py:1542–1543`). | bez testu |
| Podmínka: do 5 ft, vidí, nepřítel není incapacitated | **CHYBÍ** | Jen vzdálenost ≤ 5 ft; žádná kontrola „vidí“ ani `incapacitated` (`combat_range.py:83–85`). | bez testu |
| Nevztahuje se na Sacred Flame / Burning Hands (save, ne spell attack roll) | **SPLNĚNO** | Uložené jako save v `spells.py:93–103`; disadvantage engine pro ně neaplikuje (žádná logika = odpovídá výjimce). | implicitně — bez testu |
| Nevrstvení při více nepřátelích | **SPLNĚNO** | Solo combatant model — jeden `combat_distance_ft`, jedna boolean nevýhoda. | `test_sprint27_ranged_combat.py::test_ranged_melee_disadvantage` |

**Frontend:** zobrazí `disadvantage_reason` jen pro zbraň (`CombatUI.tsx`, `combatRange.ts:25`).

---

## Implementation rules (meta)

| Bod | Stav | Komentář |
|-----|------|----------|
| Kontrola před implementací | **SPLNĚNO** | Tento dokument |
| API kontrakty + idempotence | **ČÁSTEČNĚ** | Existující; `combat_tactics.spells` přijde v #35 |
| Cílené testy | **ČÁSTEČNĚ** | Některé oblasti pokryty (útěk, zbraně), mezery u dosahu kouzel a spell disadvantage |
| Paralelní PR | **SPLNĚNO** | Navrženo níže |
| Žádné neodsouhlasené mechaniky | **SPLNĚNO** | Jen schválená pravidla v navržených PR |

---

## Navrhované pořadí malých PR (po mergi tohoto auditu)

### PR A — Dosah kouzel (vychází z #35)

**Cíl:** dokončit / sloučit `cursor/combat-p0a-spell-range-3a94` proti `COMBAT_RULES_APPROVED.md`.

| Soubory | Změna |
|---------|--------|
| `app/engine/combat_spell_range.py` | Zachovat; případně upřesnit text denial u kužele |
| `app/engine/service.py` | Range gate před slot/action |
| `app/api.py` | `combat_tactics.spells` |
| `frontend/src/combat/combatSpellRange.ts`, `combatActions.ts`, `combatRange.ts` | UI disable + denial |
| `tests/test_combat_p0a_spell_range.py` | Unit/integration |

**Testy:** unit parse range (cone, touch, feet); integration deny beyond range bez `action_used`/slot; API payload; Vitest `combatSpellRange.test.ts`; E2E `combat-p0a-spell-range-screenshots.spec.ts`.

**Doplnit oproti #35:** tabulkový test všech řádků z `MODELED_SPELL_EFFECTS` s `ENEMY_DAMAGE_KINDS`; dokumentovat kužel jako distance-cap.

---

### PR B — Univerzální Dash (Action) + zachovat Cunning Action

| Soubory | Změna |
|---------|--------|
| `app/engine/class_features.py` nebo nový `combat_dash.py` | `use_dash_action()` pro všechny; rogue L2+ ponechat `use_cunning_dash` |
| `app/engine/service.py`, `app/engine/intent.py` | Rozlišit bonus vs action dash |
| `app/engine/combat_action_economy.py` | Klasifikace cost |
| `frontend/src/combat/combatActions.ts`, `i18n.tsx` | Action chip pro všechny, bonus pro rogue |
| `frontend/src/character/classFeatures.ts` | Popis |

**Testy:** unit grant movement = speed, stack s užitým pohybem; rogue dash stále bonus; fighter dash action; reject bez action pool; integration advance po dash; E2E jeden tah s dash + move.

---

### PR C — Útěk (zpřesnění / idempotence)

Většina chování **už sedí**; PR jen pro mezery a důkazy.

| Soubory | Změna |
|---------|--------|
| `app/engine/service.py` | (volitelně) explicitní komentář / guard — flee fail neadvance enemy |
| `tests/test_combat_turn_resolution.py` | Assert `combat_turn==player` po fail |
| `tests/test_idempotency_*` nebo nový | Dva× stejný `flee` + `Idempotency-Key` |
| `frontend/e2e/` | Flee fail → hráč může bonus/end turn |

**Testy:** existující rozšířit; API idempotence flee.

---

### PR D — Ranged disadvantage (zbraně + spell attack)

| Soubory | Změna |
|---------|--------|
| `app/engine/combat_range.py` nebo `combat_disadvantage.py` | Sdílená funkce pro 5 ft + incapacitated hook |
| `app/engine/service.py` | `_cast_spell` spell_attack větev |
| `app/api.py` | (volitelně) flag v `combat_tactics` pro spell attacks |
| `frontend/src/combat/combatRange.ts` | Label pro spell attacks |

**Testy:** unit 5 ft on/off, incapacitated; Fire Bolt v melee disadvantage; Sacred Flame / Burning Hands bez; žádné double-disadvantage; integration s `attack_advantage_roll` pattern.

---

## Souhrnná tabulka (pro release reporting)

| § | Oblast | Shrnutí |
|---|--------|---------|
| 1 | Dash | CHYBÍ univerzální Action; rogue bonus OK; pohyb OK |
| 2 | Dosah kouzel | CHYBÍ na main; #35 pokrývá většinu včetně BH 15 ft jako distance-cap |
| 3 | Útěk | SPLNĚNO jádro; idempotence částečně |
| 4 | Ranged disadvantage | Částečně (jen ranged zbraně) |

*Dokument pouze audituje; žádný produkční kód v tomto PR se nemění.*