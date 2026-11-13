# Ruleset v1 (MVP) — SRD 5.1 kompatibilní základ

**Produktové rozhodnutí:** Jediný oficiální ruleset pro MVP je **SRD 5.1 (2014)**. Marketing ani UI neslibují plné D&D 5e ani 2024/5.5e pravidla.

**Implementace v kódu:** `app/engine/ruleset_v1.py` — `validate_mvp_creation()` při vytvoření postavy; `/reference` vrací `mvp_playable` u ras a tříd.

## Co hra skutečně modeluje

- Útoky, obrana, jednotné saving throws (hráč i monstrum u modeled kouzel a vybraných schopností)
- Minimální conditions: paralýza (ghoul — opakovaný CON save na **konci tahu** postiženého), nevýhoda na další útok (Vicious Mockery, spotřeba při rollu)
- Melee krit vs paralyzovaný: každý zásah zblízka je krit (`encounters.enemy_attack_is_melee`); výhoda sama o sobě nekrituje na dálku
- Omezený whitelist kouzel (`MODELED_SPELL_EFFECTS`) se sloty a cantrip škálováním
- Short/long rest, level 1–3 progression for chapter 1 closed beta (zjednodušené prahy XP; `MAX_MVP_LEVEL = 3`)
- Inventář jako seznam řetězců + obchod v Goblin Market
- Cestování po grafu lokací, quest flags (zvon, vault, kapitola 1)
- Tahové solo combat bez plné iniciativy roundů (initiative roll existuje, pořadí zjednodušené)

## Podporované volby postavy (MVP)

- **Třídy:** dle `CLASS_SPELL_LISTS` a character wizardu — bojové i casters s reálnými sloty jen kde engine inicializuje spellcasting.
- **Rasy:** Human, Elf, Dwarf, Halfling (+ další z wizardu označené jako dostupné).
- **Úrovně:** 1–3 v closed beta kapitoly 1. Backend odmítá level-up nad 3; UI nestaví progress k úrovni 4. Úrovně nad 3 zůstávají uzamčené, dokud nejsou modelované Extra Attack, Uncanny Dodge, Destroy Undead a kouzla 3. úrovně.

## Co je záměrně zjednodušené (neslibovat hráči)

- Plná akce / bonus / reakce / pohyb / koncentrace
- Kompletní conditions (kromě paralýzy a jednorázové nevýhody), death saves, ASI/feature stromy
- Inventář jako ItemDefinition/Instance
- Všechna kouzla z SRD katalogu — pouze ty s `MODELED_SPELL_EFFECTS`

## Rozšíření (až po vertikálním řezu)

1. Initiative queue a combat rounds
2. Structured quest objects v DB
3. Item instancing pro kapitolu 2

Každé rozšíření musí přidat unit testy s fixním RNG.
