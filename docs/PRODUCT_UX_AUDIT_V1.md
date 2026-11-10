# PRODUCT UX AUDIT V1 — Doupě Draka

**Datum:** 2026-11-09  
**Branch:** `clean-main` · **HEAD:** `cebbe66` (+ lokální UX práce)  
**Autor:** audit z kódu, testů a design dokumentace (ne telefonní playtest)

## Metodika

- Prohlédnuty: `PROJECT_BRAIN.md`, `ROADMAP.md`, `design/miniapp-screens.md`, `docs/TELEGRAM_PHONE_QA.md`, `docs/ENGINE.md`, `docs/ARCHITECTURE.md`, frontend (`App.tsx`, `GameScreens.tsx`, `sharedPlayUI.tsx`), API (`app/api.py`), engine (`app/engine/`).
- Každá položka: **typ**, **priorita**, **důkaz v kódu**, **backend?**

Legenda priorit: **P0** blokuje / ztráta postupu · **P1** zásadní UX · **P2** významné · **P3** kosmetika  

Typy: **BUG** · **DUPLICITA** · **IA** (informační architektura) · **CHYBÍ** · **NEPODPOROVÁNO** · **VYSVĚTLENÍ**

---

## Inventář funkcí (shrnutí)

| Oblast | Implementace | UI | Persist | Backend |
|--------|----------------|-----|---------|---------|
| Vytvoření postavy (wizard + presety) | `CharacterWizard`, `POST /characters` | Ano | DB | Ano |
| Tah / akce | `takeAction` → SSE stream | Play | Events + character | Ano |
| Boj | `in_combat`, combatant | Play chrome | Engine | Ano |
| Cestování | `travel to X` | Map + chips | `location` | Ano (`locations.py`) |
| Úkoly kap. 1 | `quest_flags` | Quest panel | Character payload | Ano (`quests.py`) |
| Mapa | Graf + fog | `MapScreen`, `chapterOneMap.ts` | visited + flags | Částečně (uzly engine, layout UI) |
| Deník | `GET /events`, SSE merge | Play + Journal | DB events | Ano |
| Inventář / equip | `InventoryList` | Character + sheet menu | Engine | Ano |
| Kouzla (MVP) | `known_spells`, cast | Tools + Play picker | Engine | Modeled subset only |
| Nastavení tier | Lite/Normal/(Pro off) | Settings | `users` | Ano (`/economy`) |
| Kampaň (tón, obtížnost) | PATCH settings | Campaign | Character | Ano |
| Pozvánka | Client share | Home (dříve) | — | **Ne** (žádný referral API) |
| Platby / top-up | Admin API | Disabled notice | — | Nepřipojeno |

---

## A. Přehled / Hub

| ID | Priorita | Typ | Problém | Důkaz |
|----|----------|-----|---------|--------|
| A1 | P1 | DUPLICITA | Seznam „Other adventurers“ na Hub **a** „Switch adventurer“ na Postavě | `GameScreens.tsx` (historicky obě) |
| A2 | P1 | DUPLICITA | Více cest „nový hrdina“: CTA, textové tlačítko, preset grid, More | `HomeScreen`, `create`, presety |
| A3 | P2 | IA | Hub neukazoval poslední beat ani aktivní krok úkolu — hráč neví „proč pokračovat“ | Chyběl `events` na Hub |
| A4 | P2 | DUPLICITA | Mapa + Úkoly na Hub **a** v More **a** (dříve) v záložce Postavy | více `navigate('map'/'quests')` |
| A5 | P0 | BUG | Safe area — titulky pod Telegram Close (viz `TELEGRAM_PHONE_QA.md`) | CSS/telegramWebApp — oprava v lokálním sprintu, **telefon NOT TESTED** |
| A6 | P2 | VYSVĚTLENÍ | „Continue adventure“ = přechod na `screen=game`, ne nový save | `App.tsx` navigate |

**Hlavní vstup do hry:** tlačítko **Continue adventure** → záložka **Adventure** (dříve Play).

---

## B. Postava

| ID | Priorita | Typ | Problém | Důkaz |
|----|----------|-----|---------|--------|
| B1 | P1 | DUPLICITA | Záložka Quests v Character hub vs samostatná Quest obrazovka | `CharacterScreen` tabs (odstraněno ve V1) |
| B2 | P2 | IA | Kouzla: jedna věta „No spells known“ bez rozdílu caster/non-caster | `CharacterScreen` |
| B3 | P2 | IA | Inventář v `<details>` — použitelné, ale bez jednotné karty položky na úrovni designu | `InventoryList.tsx` |
| B4 | P3 | IA | Schopnosti pouze jako ABIL grid — bez skill/lore z enginu | MVP scope |

Backend: staty, HP, sloty, inventář, equip — **plně engine**.

---

## C. Deník

| ID | Priorita | Typ | Problém | Důkaz |
|----|----------|-----|---------|--------|
| C1 | P2 | DUPLICITA | Play journal + Journal screen + Campaign „Recent journal“ | tři povrchy |
| C2 | P1 | IA | Celá stránka roste — chybí scrollovatelný kontejner na Journal | `JournalScreen` (V1: `journal-scene-scroll`) |
| C3 | P2 | IA | Žádné kategorie (příběh / boj / úkol) — těžké čtení na dlouhé session | `journalBlocks.tsx` umí oddělit mechanics |
| C4 | P1 | BUG* | Možná duplicita beatů po reconnect — client `mergeJournalAfterRefresh` | `journalFormat.ts` — vyžaduje stress test |
| C5 | P2 | VYSVĚTLENÍ | Hráč vidí `event.action` i v Play — částečně skryto `isExploreActionRedundant` | `journalDisplay.ts` |

*Označeno jako riziko, ne potvrzený bug v automatických testech.

SSE: jen v rámci **action streamu**, ne samostatný journal feed (`App.tsx`).

---

## D. Mapa

| ID | Priorita | Typ | Problém | Důkaz |
|----|----------|-----|---------|--------|
| D1 | P2 | IA | Vizuálně „graf uzlů“, ne klasická mapa — ale odpovídá datům | `CHAPTER_ONE_LAYOUT`, `map-graph` |
| D2 | P1 | NEPODPOROVÁNO | **Žádné souřadnice v API** — layout 100% client | `chapterOneMap.ts` vs `GET /reference` locations |
| D3 | P2 | IA | Zamčené trasy — UI `mapLockReason` musí držet krok s `travel_allowed` | `locations.py`, `chapterOneMap.ts` |
| D4 | P3 | CHYBÍ | Označení lokací s aktivním úkolem na mapě | pouze quest panel text |

Engine: 9 uzlů kap. 1, `connections`, gating vault/pit — **ano**.

---

## E. Kouzla a pravidla

| ID | Priorita | Typ | Problém | Důkaz |
|----|----------|-----|---------|--------|
| E1 | P1 | VYSVĚTLENÍ | Tools míchá celý SRD katalog s „modeled“ — hráč může chtít cast ne-modeled | `effect_modeled`, warning v composer |
| E2 | P2 | IA | „Moje kouzla“ vs „Dostupná“ není odděleno v UI — jen filtr v Tools | `ToolsScreen` |
| E3 | P2 | NEPODPOROVÁNO | Získávání nových kouzel mimo level-up / engine grant — **žádný spell shop UI** | engine only |
| E4 | P2 | IA | `mana` field na postavě vs ⚡ credits — dokumentováno, stále matoucí pro nováčka | `PROJECT_BRAIN.md` |

MVP: 8 caster tříd, omezená sada efektů — **engine truth**.

---

## F. Nastavení a kampaň

| ID | Priorita | Typ | Problém | Důkaz |
|----|----------|-----|---------|--------|
| F1 | P1 | IA | Nastavení účtu vs kampaně roztříštěno (Settings / Campaign / character PATCH) | tři obrazovky |
| F2 | P2 | VYSVĚTLENÍ | Lite/Normal dobře popsáno v Settings — Pro skryto/disabled | `api.py` `_available_narration_tiers` |
| F3 | P2 | VYSVĚTLENÍ | `narration_language` vs UI `app_locale` — sync přes PATCH | dokumentováno |
| F4 | P3 | CHYBÍ | Pravidla kouzel per-kampaň — není v engine | — |

Billing: ⚡ jen při změně stavu + paid narrace — **testováno** (`test_api_systems.py`).

---

## G. Boj

| ID | Priorita | Typ | Problém | Důkaz |
|----|----------|-----|---------|--------|
| G1 | P1 | IA | Výsledky v journalu mohou působit technicky — mechanics v `JournalResultBody` | `journalBlocks.tsx` |
| G2 | P2 | IA | Adventure vs Combat screen — stejný composer; design doc chtěl oddělený combat row | `AdventureScreen` / `CombatScreen` |
| G3 | P2 | BUG | `onCancelTurn` v UI, **nepředáno** z `App.tsx` | `sharedPlayUI.tsx` |
| G4 | P3 | NEPODPOROVÁNO | Heavy Attack / Aim — **jen návrh** | `design/COMBAT_TACTICS_PROPOSAL_V1.md` |
| G5 | P2 | IA | „Explore“ chip vždy první i když NPC dialog dává smysl | `gameActions.ts` (V1: `primaryPlayChipKey`) |

Engine akce: attack, defend, flee, cast (modeled), potion, rest — **fungují**.

---

## H. Pozvánky (Fáze 7)

| ID | Priorita | Typ | Problém | Důkaz |
|----|----------|-----|---------|--------|
| H1 | P1 | NEPODPOROVÁNO | Žádný referral endpoint, žádná attribution po `startapp=invite` | `adventureShare.ts`, ROADMAP deferred |
| H2 | P1 | BUG | Staré Home tlačítko nepoužívalo `shareText` / clipboard feedback | opraveno `InviteShareCard` |
| H3 | P2 | VYSVĚTLENÍ | Vyžaduje `VITE_TELEGRAM_BOT_USERNAME` pro deep link | build env |

---

## Telefonní checklist (manuální)

Viz `docs/TELEGRAM_PHONE_QA.md` + níže v `PRODUCT_UX_REDESIGN_V1.md` §9.

---

## Souhrn priorit (top 10)

1. **P0** Safe area Telegram (fyzický retest)  
2. **P1** Duplicitní správa hrdinů a vstupy na mapu/úkoly  
3. **P1** Deník — scroll a kategorie  
4. **P1** Bojová čitelnost (prose vs mechanics)  
5. **P1** Pozvánka — upřesnit limity, opravit share UX  
6. **P2** Hub jako „kampaň domů“ (beat + quest)  
7. **P2** Mapa — backend požadavky pro quest pins  
8. **P2** Kouzla — třídění Moje / Dostupná / Pravidla  
9. **P2** Settings — sloučit účet vs kampaň  
10. **P3** Vizuální mapa / ilustrace  

---

## Co audit **ne** tvrdí

- Že je gameplay „hotový“ pro closed beta bez telefonu.  
- Že referral systém existuje.  
- Že Pro tier funguje.  
- Že mapa má serverové souřadnice.
