# Physical Telegram QA V1 — Doupě Draka

**Účel:** Ověřit použitelnost v **oficiálním Telegram Mini App** na fyzickém telefonu.  
**Baseline kódu (lokálně):** `cebbe66` na `clean-main` + necommitnuté sprinty (Combat V2.1, Character, Tools & Spells, Journal & Quest, Map V2, integrace Overview quest).  
**Commit/push:** zakázán během QA.

---

## Session metadata (vyplní tester)

| Pole | Hodnota |
|------|---------|
| Datum | |
| Tester | |
| Zařízení / model | |
| OS + verze | |
| Telegram verze | |
| Viewport (šk×v×px nebo report z DevTools) | |
| Jazyk testu (CS / EN / oba) | |
| Tier (Lite / Normal) | |
| Postava (jméno / ID) | |
| `git rev-parse --short HEAD` | |
| Mini App URL (produkce / staging) | |
| Chyby konzole (ano/ne + popis) | |

---

## 1. Overview — první dojem

| # | Kontrola | Výsledek | Poznámka |
|---|----------|----------|----------|
| 1.1 | Obrazovka se správně zobrazí | | |
| 1.2 | Telegram čas a Close nejsou překryté | | |
| 1.3 | Aktivní postava je jasná | | |
| 1.4 | Hlavní quest srozumitelný | | |
| 1.5 | Quest bez spoilerů (žádný Caldus/Nib před accept) | | |
| 1.6 | Continue → Adventure | | |
| 1.7 | Žádné duplicitní hlavní akce | | |
| 1.8 | Úzký viewport OK | | |

**Otázka:** Víš během 10 s, co máš dělat?

**Verdikt sekce:** PASS / FAIL / NOT TESTED

---

## 2. Adventure

| # | Kontrola | Výsledek | Poznámka |
|---|----------|----------|----------|
| 2.1 | Úvodní příběh čitelný | | |
| 2.2 | Text není pod navigací | | |
| 2.3 | Akce srozumitelné | | |
| 2.4 | Explore funguje | | |
| 2.5 | Talk / Interact pokud dostupné | | |
| 2.6 | Loading po odeslání | | |
| 2.7 | Dvojklik ≠ dva tahy | | |
| 2.8 | Výsledek akce správně | | |
| 2.9 | Journal beat bez duplicity | | |
| 2.10 | Mobilní scroll přirozený | | |

**Otázka:** Víš, jaké akce můžeš a co čekat?

**Verdikt:** PASS / FAIL / NOT TESTED

---

## 3. Combat

| # | Kontrola | Výsledek | Poznámka |
|---|----------|----------|----------|
| 3.1 | Combat při skutečném fightu | | |
| 3.2 | Nepřítel identifikovatelný | | |
| 3.3 | HP hráče i nepřítele čitelné | | |
| 3.4 | Próza dominantní | | |
| 3.5 | Mechanika ne rušivá | | |
| 3.6 | Attack | | |
| 3.7 | Defend pokud dostupný | | |
| 3.8 | Spell dle dostupnosti | | |
| 3.9 | Potion dle inventáře | | |
| 3.10 | Flee dle enginu | | |
| 3.11 | Během nepřátelského tahu nelze spamovat | | |
| 3.12 | Výsledek aktualizuje postavu + deník | | |

**Verdikt:** PASS / FAIL / NOT TESTED

---

## 4. Character

| # | Kontrola | Výsledek | Poznámka |
|---|----------|----------|----------|
| 4.1 | Identita a vlastnosti čitelné | | |
| 4.2 | HP, AC, XP, level = engine | | |
| 4.3 | Výbava odpovídá | | |
| 4.4 | Inventář scroll | | |
| 4.5 | Detail předmětu | | |
| 4.6 | Equip | | |
| 4.7 | Potion | | |
| 4.8 | Po akci kontext zachován | | |
| 4.9 | Longbow / nepodporované nejde equip | | |

**Verdikt:** PASS / FAIL / NOT TESTED

---

## 5. Tools & Spells

| # | Kontrola | Výsledek | Poznámka |
|---|----------|----------|----------|
| 5.1 | Grimoár = known spells | | |
| 5.2 | Known vs Prepared | | |
| 5.3 | Modeled vs Catalog only | | |
| 5.4 | Shield & Light = catalog only (API) | | |
| 5.5 | Sloty = Character | | |
| 5.6 | Cast jen dostupné | | |
| 5.7 | Sloty po cast | | |
| 5.8 | Shoda s Combat | | |

**Verdikt:** PASS / FAIL / NOT TESTED

---

## 6. Journal

| # | Kontrola | Výsledek | Poznámka |
|---|----------|----------|----------|
| 6.1 | Chronologie | | |
| 6.2 | Próza čitelná | | |
| 6.3 | Filtry | | |
| 6.4 | Kategorie | | |
| 6.5 | Hody ve foldu | | |
| 6.6 | Bez duplicit po návratu | | |
| 6.7 | Celostránkový scroll | | |
| 6.8 | Bez JSON/ID v hlavním textu | | |

**Verdikt:** PASS / FAIL / NOT TESTED

---

## 7. Quest

| # | Kontrola | Výsledek | Poznámka |
|---|----------|----------|----------|
| 7.1 | Hlavní úkol = Overview | | |
| 7.2 | Cíl = Adventure strip | | |
| 7.3 | „Co už víš“ jen z flagů | | |
| 7.4 | Milníky = flags | | |
| 7.5 | Journal úryvky | | |
| 7.6 | Navigace Adventure / Map / Journal | | |
| 7.7 | Bez spoilerů | | |

**Verdikt:** PASS / FAIL / NOT TESTED

---

## 8. Map

| # | Kontrola | Výsledek | Poznámka |
|---|----------|----------|----------|
| 8.1 | Lokace = Character | | |
| 8.2 | Graf = katalog spojů | | |
| 8.3 | Kde jsi jasné | | |
| 8.4 | Dostupné spojení | | |
| 8.5 | Vault zamčený před unlock | | |
| 8.6 | Skryté lokace nevidět | | |
| 8.7 | Detail na displej | | |
| 8.8 | Quest marker | | |
| 8.9 | Vyrazit → travel action | | |
| 8.10 | Po cestě nová lokace na mapě | | |

**Verdikt:** PASS / FAIL / NOT TESTED

---

## 9. CS / EN

| # | Kontrola | Výsledek | Poznámka |
|---|----------|----------|----------|
| 9.1 | CS diakritika | | |
| 9.2 | EN bez CZ mixu | | |
| 9.3 | Přepnutí na všech obrazovkách | | |
| 9.4 | Stav po přepnutí | | |
| 9.5 | Dialogy / empty / error přeložené | | |

**Verdikt:** PASS / FAIL / NOT TESTED

---

## 10. Závěrečný průchod (15–20 min)

| Otázka | Odpověď testera |
|--------|------------------|
| Kdy jsi nevěděl, co dělat? | |
| Kdy jsi nerozuměl příběhu? | |
| Kdy jsi hledal funkci? | |
| Opakující se text? | |
| Odměna za průzkum? | |
| Důvod pokračovat? | |

---

## 11. Zápis chyb (šablona)

Pro každý problém:

```
Screen:
Reprodukční kroky:
Očekávané chování:
Skutečné chování:
Screenshot / video:
Závažnost: P0 / P1 / P2 / P3
Jazyk a zařízení:
```

### Nalezené defekty (vyplní tester)

| ID | Screen | Sev | Stav |
|----|--------|-----|------|
| | | | |

---

## Automatické důkazy (není náhrada za telefon)

| Oblast | Nástroj | Stav (2026-11-10 agent) |
|--------|---------|-------------------------|
| E2E hlavní flow | `npm run test:e2e` 8/8 | PASS |
| Vitest integrace | 110 passed | PASS |
| Pytest | 398 passed | PASS |
| Overview quest shoda | `crossScreenConsistency.test.ts` | PASS |
| Physical Telegram | **vyžaduje člověka v bota** | **NOT TESTED** |

---

## Rozhodnutí First 20 Minutes Playtest

| Verdikt | Podmínka |
|---------|----------|
| **ANO** | Všechny sekce 1–9 PASS na alespoň jednom zařízení (Android **nebo** iOS), žádné otevřené P0/P1 |
| **NE / částečně** | Jakákoli sekce FAIL nebo fyzické testy neprovedeny |

**Aktuální doporučení agenta:** **NE** — fyzické QA ještě neproběhlo; použij tuto stránku při prvním telefonním session.

---

## Agent session 2026-11-10 (bez fyzického telefonu)

**Provedeno:** baseline `cebbe66`, Vitest **110/110**, pytest **398** (+2 skip), E2E **8/8** (včetně `mobile-text-first`, locale CS, adventure, inventář).  
**Neprovedeno:** Telegram Mini App na reálném Android/iOS, 15–20 min playtest, screenshoty, konzole WebView.

### PASS / FAIL podle obrazovky (pouze fyzické Telegram QA)

| Obrazovka | Verdikt |
|-----------|---------|
| 0 Příprava | **NOT TESTED** (chybí metadata zařízení) |
| 1 Overview | **NOT TESTED** |
| 2 Adventure | **NOT TESTED** |
| 3 Combat | **NOT TESTED** |
| 4 Character | **NOT TESTED** |
| 5 Tools & Spells | **NOT TESTED** |
| 6 Journal | **NOT TESTED** |
| 7 Quest | **NOT TESTED** |
| 8 Map | **NOT TESTED** |
| 9 CS / EN | **NOT TESTED** (E2E locale CS = AUTO pouze) |
| 10 Závěrečný průchod | **NOT TESTED** |

### Defekty P0–P3 z fyzického testu

Žádné — session neobsahovala telefon.

### Odehrané části (automatický proxy)

- Wizard → Home → Adventure composer (E2E)
- Akce + stream + deník scroll (mobile-text-first)
- CS přepnutí UI (locale E2E)
- Equip / inventář (inventory-equip)
- Fallen flow (fallen.spec)

**Neodehráno v E2E:** Map travel, Quest chronicle UI, Tools cast, plný bojový loop, 15–20 min narativní hra.

### UX rizika (kód / předchozí audit, nepotvrzeno telefonem)

- Safe-area: logika `--app-safe-top` / `--tg-safe-bottom` je v CSS a `telegramWebApp.test.ts` — **potřebuje vizuální potvrzení** pod Telegram headerem.
- Boj a Map V2: Vitest pokrývá logiku, ne WebView výkon ani touch scroll.

### Rozhodnutí First 20 Minutes Playtest

**NE** — dokud tester nevyplní tabulky 1–10 v tomto dokumentu na jednom reálném zařízení a nezavře P0/P1.
