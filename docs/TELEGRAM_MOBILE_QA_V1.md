# Telegram Mobile QA V1 — Doupě Draka

**Účel:** Jednotný manuální checklist pro **první herní session** v oficiální Telegram Mini App na fyzickém telefonu.  
**Baseline kódu:** `git rev-parse --short HEAD` na **`main`** po deployi — minimum **`37d9c88`** (ověř CI na stejném SHA).  
**Automatizace:** Playwright E2E + Vitest **nenahrazují** tento checklist (viz §L).

**Související:** [`PHYSICAL_TELEGRAM_QA_V2.md`](PHYSICAL_TELEGRAM_QA_V2.md), [`TELEGRAM_PHONE_QA.md`](TELEGRAM_PHONE_QA.md).

---

## A. Metadata session (vyplní tester)

| Pole | Hodnota |
|------|---------|
| Datum / čas | |
| Tester | |
| Zařízení + OS | Android ___ / iOS ___ |
| Telegram verze | |
| Jazyk UI | EN / CS |
| Narrator tier | Lite / Normal |
| Mini App URL (staging/prod) | |
| Git HEAD | |
| Délka (cíl 20–45 min) | |

**Stav položky:** `PASS` · `FAIL` · `NOT TESTED` · poznámka + screenshot u FAIL.

---

## B. Před startem (facilitátor)

| # | Předpoklad | PASS / FAIL / NOT TESTED | Poznámka |
|---|------------|--------------------------|----------|
| B1 | Bot otevře Mini App (`MINI_APP_URL`, Web App tlačítko) | | |
| B2 | API + `BOT_TOKEN` platné | | |
| B3 | Doporučen **Lite** pro playtest bez kreditů | | |
| B4 | Nová postava nebo izolovaný test účet | | |
| B5 | Screenshoty povoleny | | |

---

## C. Technická vrstva Telegramu (telefon)

| # | Kroky | Očekávaný výsledek | Stav | Poznámka |
|---|--------|-------------------|------|----------|
| C1 | Otevři Mini App z bota | Fullscreen / expand, bez bílé obrazovky | | `WebApp.ready`, `expand` |
| C2 | Srovnej spodní okraj s gesty / home indikátorem | Spodní nav není pod systémovým prvkem | | `--app-safe-bottom` |
| C3 | Otevři klávesnici na obrazovce Hra | Composer + Send zůstanou nad spodní nav | | `--keyboard-offset` |
| C4 | Přepni na pod-obrazovku (Mapa z Více) | Telegram **Back** nebo UI návrat funguje, žádné dvojité zpětné kroky | | |
| C5 | Minimalizuj Telegram a vrať se | Session obnovena, žádná ztráta postavy / duplicitní tah | | |
| C6 | (Volitelně) MainButton při neprázdném poli akce | Zobrazí Send / odešle stejně jako tlačítko v UI | | |

---

## D. Průchod — první session (krok za krokem)

### D1 Otevření a úvod

| # | Akce | Očekávání | Stav | 📸 |
|---|------|-----------|------|-----|
| 1 | Spusť Mini App | Žádná JS chyba v konzoli (pokud dostupná); jazyk dle nastavení / Telegram | | |
| 2 | Bez initData v browseru (kontrola) | Hláška „otevři v Telegramu“ | | N/A na telefonu |
| 3 | Přihlášení / načtení | Přehled nebo výběr postavy | | |

### D2 Vytvoření / výběr hrdiny

| # | Akce | Očekávání | Stav | 📸 |
|---|------|-----------|------|-----|
| 4 | Wizard nebo quick hero | Postava vytvořena, přechod do hry | | |
| 5 | CS režim: nadpisy s diakritikou čitelné | Žádné raw EN ID v UI | | |

### D3 Obrazovka Hra — první tahy

| # | Akce | Očekávání | Stav | 📸 |
|---|------|-----------|------|-----|
| 6 | Odešli `search` / „prohledat“ | Journal: příběh + mechanic fold; CS mechaniky přeložené | | |
| 7 | Druhý tah po cooldownu | Žádná duplicita v journalu po reloadu | | |
| 8 | Rychlé dvojité klepnutí Send | Maximálně jeden úspěšný stream (ne spam receiptů) | | |

### D4 Navigace — 4 taby

| # | Akce | Očekávání | Stav | 📸 |
|---|------|-----------|------|-----|
| 9 | Přehled → Hra → Postava → Více | Aktivní tab viditelný, min. 44px dotyk | | |
| 10 | Více → Deník / Úkoly / Mapa | Návrat bez uvíznutí | | |

### D5 Mapa, quest, postava

| # | Akce | Očekávání | Stav | 📸 |
|---|------|-----------|------|-----|
| 11 | Mapa | CS název lokace, quest kontext | | |
| 12 | Postava / inventář | Zbraně sladěné s enginem, bez zavádějícího Equip | | |
| 13 | Úkoly | Main quest čitelný, žádné interní flag ID | | |

### D6 Interakce s NPC a pokrok (pokud stihneš v session)

| # | Akce | Očekávání | Stav | 📸 |
|---|------|-----------|------|-----|
| 14 | Travel + Talk Caldus | Quest flag v UI / quest text | | |
| 15 | Goblin Market, Nib | Shop ceny **45 gp** lektvar, **95 gp** meč +1 | | |
| 16 | Krátký / dlouhý odpočinek | Long rest jen v safe lokacích; CS hlášky | | |

### D7 Boj (pokud session vyvolá combat)

| # | Akce | Očekávání | Stav | 📸 |
|---|------|-----------|------|-----|
| 17 | První boj | HP, nepřítel CS název, výsledek z enginu | | |
| 18 | Konec boje | XP / stav v journalu, žádný UI „vymyšlený“ loot | | |

### D8 Chyby a obnova

| # | Akce | Očekávání | Stav | 📸 |
|---|------|-----------|------|-----|
| 19 | Vypni Wi‑Fi na 10 s během tahu | Přátelská chyba + Technický detail; retry | | |
| 20 | Zavři Mini App a znovu otevři | Journal a postava konzistentní | | |

---

## E. Viewporty (automatizováno — reference pro telefon)

Playwright `mobile-viewports.spec.ts` kontroluje **320×568 … 430×932**:

- bez horizontálního overflow;
- spodní navigace v viewportu;
- composer nad bottom nav na Hře.

**Na telefonu:** ověř stejné body na reálném zařízení — automat nevidí Telegram chrome.

---

## F. Známé limity automatizace

| Oblast | Auto (Vitest/E2E) | Fyzický Telegram |
|--------|-------------------|------------------|
| Safe area / home indicator | částečně (mock inset) | **NOT TESTED** bez telefonu |
| Haptic / MainButton nativní | mock | **NOT TESTED** |
| Skutečná mobilní klávesnice | `visualViewport` proxy | **NOT TESTED** |
| Lite offline narration kvalita | backend testy | subjektivní na telefonu |
| Fyzický 15 min scénář | — | **povinný** |

---

## G. Rychlý návod pro testera (15 min)

1. Ověř B1–B4, zapiš metadata §A.  
2. Projdi D1–D5 (minimální smoke).  
3. Pokud zbývá čas: D6–D8.  
4. Každý FAIL: screenshot + krátký popis + krok reprodukce.  
5. Výsledek session: **READY / NOT READY** pro closed beta (10–15 hráčů).

---

## H. Odkaz na automatické testy (regrese)

Po změnách CI / lokálně:

```powershell
cd D:\DoupeDraka
python -m pytest -q
cd frontend
npm run test -- --run
npm run build
npm run test:e2e
```

Playwright browser (jednorázově na stroji, **ne** součást každého `test:e2e`): viz [`frontend/e2e/README.md`](../frontend/e2e/README.md).

E2E soubory relevantní pro mobil:

- `e2e/mobile-text-first.spec.ts`
- `e2e/mobile-viewports.spec.ts`
- `e2e/player-journey-hub.spec.ts`
- `e2e/adventure.spec.ts`, `locale.spec.ts`, `fallen.spec.ts`

---

## I. Verdikt session (vyplní tester)

| Otázka | Ano / Ne |
|--------|----------|
| Rozumím, co mám dělat na obrazovce Hra? | |
| Vím, jak pokračovat v questu? | |
| UI nepůsobí „rozbitě“ na mém telefonu? | |
| Připraveno na 10–15členný playtest? | |

**Poznámky:**

---

*Sprint 5 — připraveno pro manuální QA; fyzický běh zůstává NOT TESTED, dokud tester nevyplní tabulky.*
