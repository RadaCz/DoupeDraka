# Ruleset v1 — SRD 5.1, kapitola 1 (closed beta)

**Rozhodnutí (DoupěDraka Designer, 20. 11. 2026):** Ruleset v1 končí na **úrovni 3**. L4–5 se v kapitole 1 nenabízí. Důvod: engine má `MAX_MVP_LEVEL = 3`, testy pokrývají jen L1–3 a L4–5 by vyžadovaly ASI, Extra Attack (L5 Fighter), Uncanny Dodge (L5 Rogue), Destroy Undead (L5 Cleric) a kouzla 3. úrovně, které nejsou modelované.

**Ověřeno proti:** `main` @ `b46f85e` (CI run #98 zelený).
**Autorita:** o pravidlech a výsledcích rozhoduje engine. AI vypravěč smí jen vyprávět výsledky enginu, nesmí si domýšlet hody, zásahy, poškození ani efekty.
**Kód:** `app/engine/ruleset_v1.py` (`MAX_MVP_LEVEL`, `MVP_RACES`, `MVP_CLASSES`, `validate_mvp_creation`, `public_summary`); `/reference` vrací `mvp_playable`.

## 1. Hratelné volby postavy

| Volba | Hratelné | Zdroj v kódu |
|---|---|---|
| Rasy | Human, Elf, Dwarf, Halfling | `MVP_RACES` |
| Povolání | Fighter, Rogue, Cleric, Wizard | `MVP_CLASSES` |
| Úrovně | 1–3 | `MAX_MVP_LEVEL = 3`, `tests/test_sprint35_level_progression.py` |
| Fighting Style | Defense, Dueling | `class_features.py` |
| Cleric doména | jen Life | `class_features.py` |
| Rogue Expertise | 2 dovednosti z profesí | `class_features.py` |
| Vlastnosti | standard array | `docs/RULESET_v1.md` (Sprint 20) |

Ostatní rasy a povolání z katalogu SRD jsou jen referenční (`mvp_playable: false`). Subclass (Martial Archetype, Roguish Archetype, Arcane Tradition) a lineage na L3 jsou **jen popisné**, bez mechaniky.

## 2. Postup úrovní

- Prahy XP dle `XP_THRESHOLD`; XP se může přenést přes více úrovní (pokryto testem do L3).
- HP při level-upu: průměr kostky životů zaokrouhlený nahoru + CON, minimálně 1 (`level_progression.py`).
- Proficiency bonus +2 na L1–3.
- Na L3 se XP zastaví pod prahem L4 (test level cap); sheet podle `docs/RULESET_v1.md` XP na stropu skrývá.

## 3. Schopnosti povolání (modelované)

| Povolání | L1 | L2 | L3 |
|---|---|---|---|
| Fighter | Fighting Style, Second Wind (bonusová akce, 1d10 + level) | Action Surge (obnova na krátký odpočinek) | archetyp jen popisně |
| Rogue | Expertise, Sneak Attack (výhoda nebo skrytí) | Cunning Action: Dash, Disengage, Hide (bonusová akce) | archetyp jen popisně; Sneak Attack dle `sneak_attack_dice` |
| Cleric | Life doména (doménová kouzla Bless, Cure Wounds), Disciple of Life | Channel Divinity: Turn Undead, Preserve Life (obnova na krátký odpočinek) | sloty 4×1. + 2×2. úroveň |
| Wizard | kniha kouzel vs. připravená kouzla, Arcane Recovery | — | Arcane Tradition jen popisně; sloty 4×1. + 2×2. úroveň |

Pozn.: Hide v boji je v kódu podmíněný Rogue L2 (`try_hide_in_combat`), ne L1.

## 4. Souboj

- **Ekonomika tahu:** akce, bonusová akce, reakce (`combat_action_economy.py`). Volné akce bez nákladu.
- **Reakce:** opportunity attack při dobrovolném opuštění dosahu; Disengage jej ruší; nepřítel má jednu reakci za kolo. Vynucený pohyb a teleport OA nespouští (`combat_reactions.py`).
- **Pozice a dosah:** zjednodušený model (`combat_positioning.py`, `combat_range.py`, `combat_move.py`); podrobnosti neověřeny v tomto auditu.
- **Iniciativa:** zjednodušená, v boji je jeden aktivní protivník.
- **Záchranné hody:** `saving_throws.py`, `spell_saves.py`.
- **Stavy:** jen `paralyzed` (ghoul; opakovaný CON hod DC 10 na konci tahu postiženého; max. 10 kol; automatický neúspěch STR/DEX hodů; útoky proti mají výhodu), `turned` (Turn Undead) a jednorázová nevýhoda na další útok (Vicious Mockery).
- **Koncentrace:** Bless, Shield of Faith, Invisibility. Po zásahu CON hod DC max(10, ½ poškození); končí při neschopnosti, 0 HP, pádu a dlouhém odpočinku (`concentration.py`).

## 5. Kouzla

Hratelná jsou **jen** kouzla v `MODELED_SPELL_EFFECTS`:

- Triky: Fire Bolt, Sacred Flame, (Vicious Mockery, Eldritch Blast — mimo MVP povolání)
- 1. úroveň: Bless, Shield of Faith, Mage Armor, Shield (reakce), Burning Hands, Cure Wounds, Healing Word (bonus), Magic Missile
- 2. úroveň: Misty Step (bonus), Invisibility, Scorching Ray

Ostatní kouzla v seznamech povolání a v `srd_spells.json` jsou jen katalog.

## 6. Odpočinek, inventář, svět

- Krátký a dlouhý odpočinek; obnova schopností dle tabulky výše.
- Výbava a zbroj přes instance předmětů (`equipment.py`), obchod v Goblin Market.
- Cestování po grafu lokací, questové flagy (zvon, vault, kapitola 1), Bell Warden vyžaduje L3.

## 7. Neslibovat hráči

- L4 a výš, ASI, featy, Extra Attack, Uncanny Dodge, Destroy Undead, kouzla 3. úrovně
- Subclass mechaniky, další Cleric domény, Wizard tradice
- Plná iniciativa s více protivníky, death saves, ostatní stavy
- Kouzla mimo `MODELED_SPELL_EFFECTS`
- Multiplayer

## 8. Zjištěné mezery k rozhodnutí (návrh, neověřeno v UI)

1. **Cleric L3 nemá žádné kouzlo 2. úrovně** (`LEVEL_TWO_SPELL_LISTS["cleric"] = ()`), ale dostává 2 sloty 2. úrovně. Ověřit, zda je lze použít na zesílení kouzel 1. úrovně; jinak jde o mrtvý zdroj.
2. **Startovní kouzla Wizarda obsahují nemodelovaná kouzla** (Sleep, Detect Magic, Light, Mage Hand) a Cleric (Guidance, Spare the Dying). Ověřit, že je UI nenabízí jako sesílatelná v boji, nebo je jasně označí jako „jen příběhově“.
3. `docs/RULESET_v1.md` uvádí Hide u Rogue jako L1; kód jej vyžaduje L2. Sjednotit text.
