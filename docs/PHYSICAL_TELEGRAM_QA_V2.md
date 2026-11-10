# Physical Telegram QA V2 — Doupě Draka

**Účel:** Připravit **přesný checklist** pro fyzické QA v oficiálním Telegram Mini App po **UX POLISH V1** (dark theme lock, CS `gameDisplay`, journal/combat lokalizace, safe-area kód beze změny chování enginu).

**Toto je pouze příprava.** Žádná položka níže není předvyplněná jako PASS. Agent **neprovedl** test na telefonu.

**Související dokumenty (nemazat):** [`PHYSICAL_TELEGRAM_QA_V1.md`](PHYSICAL_TELEGRAM_QA_V1.md), [`TELEGRAM_PHONE_QA.md`](TELEGRAM_PHONE_QA.md).

---

## A. Verze a metadata (vyplní tester před startem)

| Pole | Hodnota |
|------|---------|
| Datum / čas startu | |
| Tester | |
| **Zařízení** (model) | |
| **OS** + verze | |
| **Telegram** (verze aplikace) | |
| Telegram theme v nastavení | `light` / `dark` / `auto` |
| Viewport (š×v px, nebo Telegram WebApp) | |
| Jazyk UI testu | `EN` / `CS` / oba (dva běhy) |
| Narrator tier | `lite` / `normal` |
| Postava (jméno, třída, ID pokud viditelné) | |
| **Git HEAD** (`git rev-parse --short HEAD`) | očekáváno: `cebbe66` + lokální diff |
| **App build** (URL Mini App, staging/prod) | |
| WebView konzole (pokud dostupná) | chyby ano/ne + popis |
| Délka session (cíl ≥ 15 min) | |

**Screenshot povinně při každém FAIL a u kroků označených 📸**

Formát souboru: `YYYY-MM-DD_platform_krok_popis.png` (např. `2026-11-10_android_safe-area_home.png`).

---

## B. Co je nové oproti V1 (UX POLISH V1 — ověřit na telefonu)

| Oblast | Co testovat | Kód (orientace) |
|--------|-------------|-----------------|
| Dark theme | Žádné bílé karty při **světlém motivu Telegramu**; jednotné tmavé povrchy | `telegramWebApp.ts` (`locked-dark`), `--surface-card`, `polish/dark-surfaces.css` |
| CS zobrazení | Lokace v UI (např. *Potopená chodba*), předměty, combat mechanika v deníku | `i18n/gameDisplay.ts`, `journalBlocks.tsx` |
| Character | Držená zbraň bez zavádějícího **Equip**; tmavé karty inventáře | `CharacterInventoryPanel.tsx` |
| Journal (stránka) | Tmavé beat karty, ne bílé bloky | `journal-screen-v2`, `dark-surfaces.css` |
| Map | Kontrast current / adjacent / locked / visited; CS názvy míst | `map-v2.css`, `MapScreen.tsx` |
| Economy copy | CS diakritika: kredity vypravěče, dobití | `i18n.tsx` |

Engine/API akce zůstávají anglicky (`travel to The Sunken Corridor`, `equip shortsword`) — UI může zobrazovat překlad.

---

## C. Předpoklady (facilitátor)

| # | Předpoklad | Stav přípravy |
|---|------------|---------------|
| P1 | Bot: `MINI_APP_URL`, tlačítko Web App v BotFather | |
| P2 | API: platný `BOT_TOKEN` | |
| P3 | Closed beta: výchozí **Lite** (doporučeno); Normal jen s providerem + případný topup facilitátora | |
| P4 | Izolovaný testovací Telegram účet / nová postava | |
| P5 | Screenshoty povoleny; čas viditelný na status baru | |
| P6 | Pro krok **lektvar**: postava musí mít `healing potion` v inventáři (start Fighter **nemá** lektvar — získej ve hře, např. trh/Nib pokud engine nabídne, nebo jiná postava/stav) | |

**Automatické testy nenahrazují telefon** (viz §L).

---

## D. Navigace — obrazovky v aktuálním buildu

| Tab / vstup | `AppScreen` | Komponenta / poznámka |
|-------------|-------------|------------------------|
| Přehled | `home` | `HomeScreen` |
| Hra | `game` | Adventure / Combat (`AdventureScreen`, `CombatScreen`) |
| Postava | `character` | `CharacterScreen` V2 |
| Více | `more` | hub |
| Deník | `journal` | `JournalChronicle` |
| Úkoly | `quests` | `QuestChronicle` |
| Mapa | `map` | `MapScreen` V2 |
| Nástroje | `tools` | `ToolsScreen` |
| Nastavení | `settings` | economy, jazyk, tier |
| Kampaně | `campaign` | mood settings |
| Wizard | `create` | nová postava |

Spodní navigace: `home` · `game` · `character` · `more` (+ dílčí obrazovky z More).

**Telegram integrace (kód):** `applyTelegramViewport`, `bindTelegramChrome` — `contentSafeAreaInset` / `safeAreaInset`, `viewportChanged`, `--keyboard-offset` (`telegramWebApp.ts`).

---

## E. Checklist — safe-area a klávesnice

Každý řádek: **PASS** / **FAIL** / **BLOCKED** / **NOT TESTED** (výchozí **NOT TESTED**).

| ID | Kontrola | Očekávání | Výsledek | 📸 | Poznámka |
|----|----------|-----------|----------|----|---------|
| SA1 | Horní safe area | Čas systému a Close **nejsou** překryté obsahem | NOT TESTED | 📸 | Na `home` a `game` |
| SA2 | Spodní safe area | Bottom nav nesedí pod home indikátor / gesto | NOT TESTED | 📸 | |
| SA3 | Žádné dvojité odsazení nahoře | Obsah ne„plave“ s příliš velkou mezerou pod TG headerem | NOT TESTED | | |
| SA4 | Modal / sheet (mapa lokace, inventář) | Sheet respektuje spodní inset | NOT TESTED | 📸 | |
| KB1 | Composer focus | Klávesnice nezakryje textové pole + Send | NOT TESTED | 📸 | Adventure |
| KB2 | Scroll deníku | Nejnovější beat čitelný; composer zůstane dostupný | NOT TESTED | | |
| KB3 | Po zavření klávesnice | Layout se vrátí bez trvalého prázdna | NOT TESTED | | |

---

## F. Checklist — dark theme (včetně světlého Telegram motivu)

Proveď **dva podběhy** pokud možno: TG **dark** a TG **light** (nebo auto → light).

| ID | Kontrola | Výsledek (TG dark) | Výsledek (TG light) | 📸 |
|----|----------|--------------------|---------------------|-----|
| TH1 | Přehled — karty stat / hero | NOT TESTED | NOT TESTED | 📸 |
| TH2 | Hra — journal + composer | NOT TESTED | NOT TESTED | 📸 |
| TH3 | Deník (stránka) — beat karty **tmavé**, ne bílé | NOT TESTED | NOT TESTED | 📸 |
| TH4 | Postava — ability / inventář | NOT TESTED | NOT TESTED | 📸 |
| TH5 | Mapa — graf + sheet | NOT TESTED | NOT TESTED | 📸 |
| TH6 | Nastavení — notice / tier karty | NOT TESTED | NOT TESTED | 📸 |
| TH7 | Kontrast textu (muted vs pozadí) čitelný na slunci / v místnosti | NOT TESTED | NOT TESTED | |
| TH8 | Zlatavé akcenty nejsou všude přehnané | NOT TESTED | NOT TESTED | |

---

## G. Checklist — obrazovka po obrazovce

### G1. Overview (`home`)

| ID | Kontrola | Výsledek | Sev* |
|----|----------|----------|-----|
| H1 | Načtení z bota bez bílé obrazovky | NOT TESTED | P0 |
| H2 | Lokace v patičce karty = CS překlad (v CS UI) | NOT TESTED | P2 |
| H3 | Quest teaser bez spoilerů (žádný Caldus vault před časem) | NOT TESTED | P1 |
| H4 | Continue → Hra | NOT TESTED | P0 |

### G2. Adventure (`game`)

| ID | Kontrola | Výsledek | Sev |
|----|----------|----------|-----|
| A1 | Nadpis místa CS/EN konzistentní s Postava/Mapa | NOT TESTED | P2 |
| A2 | Chips / composer; jeden tah po odeslání | NOT TESTED | P0 |
| A3 | Loading / disabled během streamu | NOT TESTED | P1 |
| A4 | Mechanika v CS: útok / k20 / zásah (pokud CS) | NOT TESTED | P2 |
| A5 | Explore → `search` / explore akce dle chipů | NOT TESTED | P0 |

### G3. Combat (`game` + combat UI)

| ID | Kontrola | Výsledek | Sev |
|----|----------|----------|-----|
| C1 | Přechod do boje po engine encounter | NOT TESTED | P0 |
| C2 | Nepřítel + HP čitelné; próza dominantní | NOT TESTED | P1 |
| C3 | Attack; Defend pokud UI nabízí | NOT TESTED | P0 |
| C4 | Flee / spell / potion jen když engine dovolí | NOT TESTED | P1 |
| C5 | Nepřátelský tah — nelze spamovat akce | NOT TESTED | P1 |
| C6 | Po boji HP a deník sedí | NOT TESTED | P0 |

### G4. Character (`character`)

| ID | Kontrola | Výsledek | Sev |
|----|----------|----------|-----|
| CH1 | HP, AC, XP, level | NOT TESTED | P0 |
| CH2 | CS názvy předmětů (krátký meč, …) | NOT TESTED | P2 |
| CH3 | Držená zbraň: bez **Equip** u již držené | NOT TESTED | P1 |
| CH4 | Equip jiné zbraně pokud 2+ ve inventáři | NOT TESTED | P1 |
| CH5 | Potion jen pokud v inventáři a engine povolí | NOT TESTED | P1 |
| CH6 | Po akci návrat na stejné místo scrollu | NOT TESTED | P2 |

### G5. Tools (`tools`)

| ID | Kontrola | Výsledek | Sev |
|----|----------|----------|-----|
| T1 | Grimoár = known spells postavy | NOT TESTED | P1 |
| T2 | Known / Prepared / Not modeled rozlišení | NOT TESTED | P2 |
| T3 | Sloty shodné s Character (sesilac) | NOT TESTED | P1 |

### G6. Journal (`journal`)

| ID | Kontrola | Výsledek | Sev |
|----|----------|----------|-----|
| J1 | Chronologie; filtry | NOT TESTED | P1 |
| J2 | Tmavé karty; žádný raw JSON/ID | NOT TESTED | P1 |
| J3 | CS mechanika ve složeném bloku | NOT TESTED | P2 |
| J4 | Bez duplicit po návratu na obrazovku | NOT TESTED | P1 |

### G7. Quest (`quests`)

| ID | Kontrola | Výsledek | Sev |
|----|----------|----------|-----|
| Q1 | Shoda s Overview / Adventure strip | NOT TESTED | P1 |
| Q2 | „Co už víš“ jen z flagů | NOT TESTED | P0 |
| Q3 | Navigace na Map / Journal / Hra | NOT TESTED | P2 |

### G8. Map (`map`)

| ID | Kontrola | Výsledek | Sev |
|----|----------|----------|-----|
| M1 | Aktuální lokace = Character (zobrazení CS) | NOT TESTED | P1 |
| M2 | Vault zamčený dokud engine neodemkne | NOT TESTED | P1 |
| M3 | Vyrazit → travel akce (engine EN) | NOT TESTED | P0 |
| M4 | Po cestě nová lokace na mapě | NOT TESTED | P1 |
| M5 | Kontrast uzlů (current / locked / visited) | NOT TESTED | P2 |

### G9. Settings + CS/EN

| ID | Kontrola | Výsledek | Sev |
|----|----------|----------|-----|
| S1 | Přepnutí CS: diakritika (Kredity vypravěče, Co uděláš?, Dobití…) | NOT TESTED | P2 |
| S2 | EN bez CZ mixu v UI | NOT TESTED | P2 |
| S3 | Přepnutí neztratí stav tahu | NOT TESTED | P1 |

\* **Sev** = očekávaná závažnost při FAIL (pro report bugu).

---

## H. Scénář 15–20 minut (pouze existující mechaniky)

**Časovač spustit po kroku 1.** Cíl: **≥ 15 min** kontinuální hry bez devtools. Poznamenej čas u každého kroku.

| Krok | Čas | Akce (engine / UI) | Ověř | Výsledek |
|------|-----|-------------------|------|----------|
| 1 | 0:00 | V Telegramu `/start` → Otevřít Mini App | SA1, H1 | NOT TESTED |
| 2 | | Wizard **nebo** hotová postava; Lite | TELEGRAM_PHONE_QA #2 | NOT TESTED |
| 3 | | **Přehled** → Continue | H4 | NOT TESTED |
| 4 | | **Hra:** `listen for movement` nebo chip Explore / `search the area` | A5 | NOT TESTED |
| 5 | | **Hra:** `inspect the stonework` nebo `inspect the old door` | A2 | NOT TESTED |
| 6 | | **Více → Nastavení:** přepni na **CS**; vrať se na Hru | S1, A1 | NOT TESTED |
| 7 | | **Hra:** `travel to The Sunken Corridor` (chip nebo composer) **nebo** **Mapa** → Vyrazit do propojené lokace | M3 | NOT TESTED |
| 8 | | **Hra:** mluvení — `talk to Mara` nebo chip Talk v chodbě | A2 | NOT TESTED |
| 9 | | **Mapa:** zkontroluj graf, sheet lokace, quest marker | M1, M5 | NOT TESTED |
| 10 | | **Úkoly:** milníky, „Co už víš“ | Q1–Q2 | NOT TESTED |
| 11 | | **Postava:** inventář, detail zbraně (Equip pouze u nedržené) | CH3–CH4 | NOT TESTED |
| 12 | | **Lektvar:** pokud máš `healing potion` a nejsi v nepřátelském tahu — Character → Use potion **nebo** composer `use potion` | CH5 | NOT TESTED / N/A |
| 13 | | **Hra:** vyvolej boj (explore roll 1 nebo setkání dle engine) → celý encounter (attack, flee nebo win) | C1–C6 | NOT TESTED |
| 14 | | **Deník:** filtr Combat + Story; rozbal mechaniku | J2–J3 | NOT TESTED |
| 15 | | **Nástroje:** grimoár (Fighter = prázdný / Wizard = sloty) | T1 | NOT TESTED |
| 16 | | Pokračuj v příběhu (quest bell linka): např. cesta ke **Shrine** / **Goblin Market**, `talk to Caldus` / `talk to Nib` dle dostupnosti | Q1, A2 | NOT TESTED |
| 17 | | **≥ 15:00** — zapiš dojmy (§I); TG **light** theme rychlá kontrola TH3 | TH3, §I | NOT TESTED |

Krok 12: pokud lektvar není k dispozici, označ **N/A** a popiš proč (ne FAIL).

---

## I. Závěrečné otázky (po 15–20 min)

| Otázka | Odpověď |
|--------|---------|
| Kdy jsi nevěděl, co dělat? | |
| Kdy CS/EN nebo diakritika vadily? | |
| Bílé plochy při světlém TG motivu? | |
| Safe area / klávesnice? | |
| Důvod pokračovat? | |

---

## J. Zápis defektu (šablona)

```
ID: (např. V2-2026-11-10-01)
Screen:
Reprodukční kroky:
Očekávané chování:
Skutečné chování:
Screenshot / video:
Závažnost: P0 | P1 | P2 | P3
Jazyk UI / TG theme:
Zařízení + Telegram verze:
Git HEAD:
```

| ID | Screen | Sev | Stav |
|----|--------|-----|------|
| | | | |

---

## K. Souhrnný verdikt obrazovek (vyplní tester až po fyzickém běhu)

| Sekce | Verdikt |
|-------|---------|
| Safe-area / keyboard | **NOT TESTED** |
| Dark theme (TG dark + light) | **NOT TESTED** |
| Overview | **NOT TESTED** |
| Adventure | **NOT TESTED** |
| Combat | **NOT TESTED** |
| Character | **NOT TESTED** |
| Tools | **NOT TESTED** |
| Journal | **NOT TESTED** |
| Quest | **NOT TESTED** |
| Map | **NOT TESTED** |
| Settings / i18n | **NOT TESTED** |
| Scénář 15–20 min | **NOT TESTED** |

**First 20 Minutes playtest:** **NOT TESTED** (dokud všechny P0/P1 sekce nejsou PASS na jednom zařízení).

---

## L. Automatické důkazy (ne = fyzický Telegram)

| Oblast | Nástroj | Poslední známý stav (agent, ne telefon) |
|--------|---------|------------------------------------------|
| Vitest | `npm run test -- --run` | 119 passed (po UX POLISH V1) |
| pytest | `python -m pytest` | 398 passed, 2 skipped |
| Build | `npm run build` | OK |
| E2E | `npm run test:e2e` | 8 passed (mock WebApp, ne TG) |
| Safe-area logika | `telegramWebApp.test.ts` | unit |
| Light TG → dark lock | `telegramWebApp.test.ts` | unit |
| CS combat řádek | `gameDisplay.test.ts`, `journalBlocks.test.ts` | unit |
| Mobile composer | `e2e/mobile-text-first.spec.ts` | proxy |

**Physical Telegram compatibility: NOT TESTED.**

---

## N. Physical QA V2 — dosavadní nálezy (před kódem sprintu Localization & Narrator V2)

| Oblast | Stav (tester) | Poznámka |
|--------|---------------|----------|
| Overview | PASS with issues | |
| Adventure | FAIL | CS/EN mix v naraci, EN lokace v textu |
| Combat | visual PASS, localization FAIL | |
| Character | visual PASS, localization FAIL | |
| Map | PASS | |
| Level Up | visual PASS, localization FAIL | |
| CS/EN | FAIL | |
| Safe area | FAIL | header pod TG chrome |

**Po implementaci L&N V2:** všechny položky výše zůstávají **NOT TESTED** do opětovného fyzického běhu.

### Co sprint L&N V2 opravil v kódu (ne telefon)

- `coerce_narration_prose` — CS → anglická LLM próza nahrazena offline CS fallbackem.
- `presentNarrationProse` — prezentace deníku: odstranění engine echo, CS názvy v próze.
- Offline CS: lokace v `breath_pause` / `rest_recovery`, přirozenější odpočinek.
- Safe area: `play-active` bez dvojitého horního insetu; play bar respektuje `--app-safe-top`.
- Diakritika: kritické řetězce v `i18n.tsx` (level up, switch, tier, třída, Human/Fighter).

### P2 — Zvuk a haptika (jen hodnocení)

| Oblast | Stav |
|--------|------|
| `telegramWebApp.ts` → `HapticFeedback` | Existuje volání při odeslání tahu / zásahu |
| Hudba / SFX | **Není implementováno** |
| Telegram WebApp zvuk | **Ne** — není v scope Mini App |
| Doporučení | Samostatný sprint: volitelné haptiky (hit/miss/level-up), bez autoplay hudby |

---

## M. Příprava agenta (2026-11-10)

- Dokument vytvořen; **žádný PASS** na fyzickém QA.
- V1 beze změny obsahu; V2 rozšiřuje o UX POLISH V1 a scénář 15–20 min.
- HEAD: `cebbe66`, branch `clean-main`, working tree s necommitnutými změnami zachován.

### Automatická verifikace po Localization & Narrator V2 (2026-11-10)

| Kontrola | Výsledek |
|----------|----------|
| `python -m pytest -q` | **399 passed**, 2 skipped |
| `npm run test -- --run` (Vitest) | **124 passed** (včetně `csCatalog`, `narrationPresent`, `gameDisplay`) |
| `npm run build` | OK |
| `npm run test:e2e` | **8/8 passed** |

**Fyzický Telegram:** položky §N zůstávají **NOT TESTED** — automatické testy nepotvrzují safe-area ani CS/EN na zařízení.

**Poznámka (stream):** při `narration_language=cs` může klient krátce ukázat anglické SSE delty před `finalize`; backend `coerce_narration_prose` chrání uložený / finální text — ověřit na telefonu.
