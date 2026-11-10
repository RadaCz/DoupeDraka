# Sprint 12 — Internal playtest preparation & acceptance

**Datum:** 2026-11-10  
**Cíl:** Připravit necommitnutý stav Sprintů 11.1–11.4 na interní Telegram Mini App playtest — **bez** nového gameplay kódu, commitu, deploye ani VPS.  
**Očekávaný HEAD:** `aa8faea` · **skutečný HEAD:** `aa8faeae95a898f9916456bd16d9ffbcb138873b` ✓

---

## 1. Git audit

### 1.1 Stav repozitáře

| Položka | Hodnota |
|---------|---------|
| Branch | `clean-main` |
| Tracking | `origin/clean-main` @ `aa8faea` — **up to date** (remote neobsahuje 11.1–11.4) |
| Remote | `https://github.com/RadaCz/DoupeDraka.git` |
| Staged | žádné |
| Working tree | **14 modified** + **19 untracked** (viz tabulky níže) |

**Důsledek:** Interní playtest běží na **lokálním working tree**, ne na `origin/clean-main` bez merge/commitu. Facilitátor musí znát, že bot/ngrok servíruje **tento** build.

### 1.2 Modified soubory (aplikace + testy)

| Soubor | Sprint | Popis změny |
|--------|--------|-------------|
| `app/api.py` | 11.2 | Volitelný `E2E_RNG_SEED` → deterministický `GameEngine` RNG (jen když env nastaven) |
| `app/engine/encounters.py` | 11.4 | `attack_block_message`, `minimum_level_for_tier` — boss readiness UX |
| `app/engine/service.py` | 11.4 | Blok útoku volá `attack_block_message` místo „not here“ |
| `frontend/src/game/gameActions.ts` | 11.1–11.2 | Quest chips (Caldus, Nib, zvon, vault, boss) |
| `frontend/src/game/gameActions.talk.test.ts` | 11.2 | Testy chipů / boss akce |
| `frontend/src/i18n.tsx` | 11.1 | CS quest labely / hinty |
| `frontend/src/i18n/gameDisplay.ts` | 11.4 | CS překlady Bell Warden gate / pit / sealed |
| `frontend/src/i18n/gameDisplay.test.ts` | 11.4 | Vitest lokalizace |
| `frontend/src/screens/sharedPlayUI.tsx` | 11.1 | Quest strip / play UI drobnost |
| `frontend/src/styles/journal-quest-v2.css` | 11.1 | Quest strip wrap |
| `frontend/e2e/start-api.mjs` | 11.2 | `E2E_RNG_SEED=42` pro E2E API proces |
| `frontend/e2e/mobile-text-first.spec.ts` | 11.2 | User-id kolize / stabilita |
| `tests/test_gameplay_integrity.py` | 11.4 | Bell Warden L2/L3/lokace |
| `design/CHAPTER_ONE_PLAYTEST_V1.md` | 11.x | Baseline poznámka |

**Stat diff vs HEAD:** 14 files, **+312 / −7** řádků (engine/API/FE/testy).

### 1.3 Untracked — **commitovat později**

| Soubor | Typ |
|--------|-----|
| `docs/GAMEPLAY_COMPLETENESS_AUDIT_V1.md` | Dokumentace |
| `docs/CHAPTER_ONE_ACCEPTANCE_QA_SPRINT_11_3.md` | Dokumentace |
| `docs/CHAPTER_ONE_PROGRESSION_SPRINT_11_4.md` | Dokumentace |
| `frontend/e2e/chapter-one-quest.spec.ts` | E2E |
| `frontend/e2e/chapter-one-e2e-helpers.ts` | E2E |
| `tests/test_chapter_one_boss.py` | Pytest |
| `tools/progression_scenarios.py` | Simulátor (report 11.4) |
| `tools/audit_cs_suspects.py` | Lokální audit nástroj |

### 1.4 Untracked — **NEcommitovat**

| Položka | Důvod |
|---------|--------|
| `.pytest-flake-log-run1.txt`, `.pytest-flake-run-*.txt`, `.pytest-strict-once.txt`, `.pytest-verify-full.txt` | Lokální pytest výstupy — **není v `.gitignore`** → doporučení přidat `/.pytest-*.txt` před commitem |
| `data/` (`dnd.db`, `-shm`, `-wal`, `.bak-prehead`) | SQLite runtime — `.gitignore` má `data/*.db` a `*.db`, ale složka `data/` může být viditelná; **nikdy necommitovat DB** |

### 1.5 Mapování sprintů (diff audit)

- **11.1 — Quest UX:** chips + CS hinty + journal CSS + `sharedPlayUI`
- **11.2 — Chapter E2E:** `gameActions`, `api.py` seed, E2E spec/helpers, `test_chapter_one_boss.py`
- **11.3 — Acceptance QA:** pouze docs (`CHAPTER_ONE_ACCEPTANCE_QA_SPRINT_11_3.md`)
- **11.4 — Boss readiness:** `encounters` + `gameDisplay` + integrity testy + progression doc/tool

### 1.6 Bezpečnost změn (API / engine / E2E)

| Oblast | Hodnocení |
|--------|-----------|
| `E2E_RNG_SEED` v `api.py` | Aktivní **jen** při numerické env proměnné. **Ne nastavovat** v kořenovém `.env` pro Telegram playtest — ovlivnilo by RNG všech hráčů na tom API procesu. E2E ho nastavuje pouze `start-api.mjs`. |
| Engine boss gate | Pouze texty a větvení blokace — **bez** změny XP/loot/HP/DC. |
| E2E `BOT_TOKEN` | Fixní test token v `start-api.mjs` — izolovaná E2E DB, ne produkční bot. |
| Secrets v reportu | **Neuvedeny** — `BOT_TOKEN`, `ADMIN_API_KEY`, API klíče držet v `.env` (gitignored). |

---

## 2. Regression audit

**Pravidla hry:** nezměněna (kromě výkladových hlášek při blokovaném útoku).

### 2.1 Automaticky ověřeno (Sprint 12 běh)

| Oblast | Testy | Výsledek |
|--------|-------|----------|
| Boss readiness L2 / L3 / špatná lokace | `tests/test_gameplay_integrity.py` (20 testů) | **PASS** |
| Chapter boss complete | `tests/test_chapter_one_boss.py` | **PASS** |
| Quest engine | `tests/test_quests_engine.py` | **PASS** |
| Inventář, equip, lektvary, shop | součást `test_gameplay_integrity.py` | **PASS** |
| Lite / Normal billing | `tests/test_billing_contract.py`, `test_economy_balance.py` | **PASS** |
| Idempotence + persist | `tests/test_concurrency.py`, `tests/test_integration.py` | **PASS** |
| CS gameDisplay + chips | Vitest `gameDisplay`, `gameActions.talk`, `telegramWebApp` | **PASS** (23 testů) |

**Souhrn pytest subset:** **63 passed** (`integrity`, `chapter_one_boss`, `quests_engine`, `billing_contract`, `concurrency`, `integration`, `economy_balance`).

### 2.2 Quest Caldus → Nib → zvon → Vault → Pit → Bell Warden

| Krok | Důkaz |
|------|--------|
| Caldus accept / vault hint | `quests.resolve_main_quest_step` + `test_quests_engine.py` |
| Nib → bell | quest flags + E2E helpers (untracked spec) |
| Return bell 30 XP | quest testy + engine |
| Vault unlock | `vault_unlocked` po Caldus dialogu |
| Pit chip / attack | `gameActions.ts` `resolveQuestBossAction` |
| Boss tier / level | `monster_allowed_for_character` + nové `attack_block_message` |

**E2E** `chapter-one-quest.spec.ts`: v repu **necommitnutý** — facilitator může spustit lokálně (`npm run e2e` dle Playwright config); **v tomto sprintu nebyl spuštěn** (čas ~6+ min).

### 2.3 Telegram viewport / safe areas

| Oblast | Stav |
|--------|------|
| Kód | `telegramWebApp.ts`, `play.css`, `styles.css` — `safe-area-inset`, `--app-safe-top`, `--tg-safe-bottom` |
| Unit testy | `telegramWebApp.test.ts` **PASS** |
| Fyzické zařízení | **NOT TESTED** — tabulky v `TELEGRAM_MOBILE_QA_V1.md` / `TELEGRAM_PHONE_QA.md` prázdné |

### 2.4 Otevřené regresní mezery

| ID | Popis |
|----|--------|
| R1 | Android/iOS Telegram — žádný provedený běh |
| R2 | Full chapter Playwright bez ručního spuštění |
| R3 | `origin/clean-main` neobsahuje 11.1–11.4 — staging z remote by **nestačil** |
| R4 | Issue O1 z 11.3 (grind bez UI doporučení levelu) — částečně mitigováno textem enginu při low level útoku |

---

## 3. Ngrok test readiness (Windows PowerShell)

**Neprováděno v tomto sprintu:** žádný tunel ani veřejná služba nebyla spuštěna (soulad s omezeními).

### 3.1 Jednorázová příprava

```powershell
cd D:\DoupeDraka
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
# Uprav .env lokálně (NEcommituj): BOT_TOKEN, případně LLM klíče; CORS_ORIGINS doplň o ngrok origin až po kroku 3.4

python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

```powershell
cd D:\DoupeDraka\frontend
npm install
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
# frontend\.env: NGROK_HOST=<hostname bez https> (viz 3.4)
```

### 3.2 Backend (terminál 1)

```powershell
cd D:\DoupeDraka
.\.venv\Scripts\Activate.ps1
# DŮLEŽITÉ: nenastavuj E2E_RNG_SEED v .env pro lidský playtest
python -m uvicorn app.api:app --reload --host 127.0.0.1 --port 8000
```

Kontrola:

```powershell
Invoke-RestMethod http://127.0.0.1:8000/health
Invoke-RestMethod http://127.0.0.1:8000/ready
```

### 3.3 Frontend (terminál 2)

```powershell
cd D:\DoupeDraka\frontend
npm run dev
```

Lokální smoke (mimo Telegram): `http://127.0.0.1:5173` — zámek auth je **očekávaný** (`DEPLOYMENT.md`).

### 3.4 Ngrok (terminál 3)

```powershell
ngrok http 5173
```

Po startu tunelu:

1. Zkopíruj **HTTPS** URL (např. `https://xxxx.ngrok-free.dev`).
2. V `frontend\.env` nastav `NGROK_HOST=xxxx.ngrok-free.dev` (jen hostname).
3. **Restartuj** `npm run dev` (Vite načítá `NGROK_HOST` pro `allowedHosts`).
4. V kořenovém `.env` přidej do `CORS_ORIGINS` origin tunelu (přesný scheme+host), pokud klient někdy volá API cross-origin; při `VITE_API_URL=/api` a proxy přes Vite často stačí localhost originy, ale po změně ověř `POST /auth/telegram` z Mini App.
5. V **BotFather** nastav Menu Button / `MINI_APP_URL` na **aktuální** ngrok HTTPS URL (tunel se mění při free plánu).

### 3.5 Kontrola Mini App

| Kontrola | Akce |
|----------|------|
| API přes proxy | V Telegramu odešli tah → síťově `/api/...` na stejném hostu jako UI |
| Auth | Mini App musí mít platné `initData` — otevřít **uvnitř Telegramu**, ne raw URL v Chrome |
| Build freshness | Po `git pull` nebo změně kódu: restart **obou** procesů + ngrok; zastaralý Vite HMR cache — tvrdý restart dev serveru |
| Staging vs local | Pokud bot stále ukazuje **staging URL**, testuješ **starý build**, ne lokální ngrok |

### 3.6 Bezpečné ukončení

```powershell
# V terminálech uvicorn / vite: Ctrl+C
# Ngrok: Ctrl+C
# Volitelně: zruš Menu Button URL v BotFather nebo vrať na staging
```

**Tunel neponechávat** bez dohledu; token v `.env` neposílat přes chat.

---

## 4. Testovací scénář (interní session ~60–120 min)

### 4.1 Facilitátor — před startem

- [ ] Working tree Sprint 11.1–11.4 nasazen lokálně (viz §1).
- [ ] Backend + frontend + ngrok běží; BotFather URL = aktuální tunel.
- [ ] Výchozí **Lite** vypravěč (Nastavení) — bez útraty kreditů.
- [ ] UI jazyk **čeština**; vysvětlit: engine řádky mohou být EN, UI CS.
- [ ] Varování: Bell Warden **min. level 3** (ideálně 4–5) — grind explore/souboje.
- [ ] Izolovaný Telegram účet; pro Normal režim případně admin topup (`TELEGRAM_PHONE_QA.md`) — **ne** pro běžné hráče.
- [ ] Screenshot + `git rev-parse --short HEAD` + poznámka „local uncommitted 11.x“ při bugu.
- [ ] `ADMIN_API_KEY` / `BOT_TOKEN` neukazovat hráčům.

### 4.2 Hráč — průchod

| # | Hráč | Očekávání |
|---|------|-----------|
| 1 | Otevři bota → Mini App → vytvoř **Fighter** (nebo Rogue) → vstup do hry | Lokace **Whispering Cellar**; viditelný **aktuální cíl**; chipy Průzkum / Cesta |
| 2 | Mapa → **Sunken Corridor** → **Shrine**; chip **Promluvit s Caldem** / odpovídající talk | Quest přijat; náznak **Nib / tržiště** v deníku |
| 3 | **Goblin Market**; chip **Zeptat se Niba** | Zvon v inventáři |
| 4 | Zpět na **Shrine**; chip **Vrátit chrámový zvon** | **10 gp + 30 XP** v deníku |
| 5 | Chip **Zeptat se Calduse na komnatu** / vault | Mapa odemkne **Vault of Echoes** |
| 6 | Vault → **Bell Warden's Pit** | Chip **Postavit se Strážci zvonu** (nebo ekvivalent) |
| 7 | **Neútočit hned**, pokud jsi level 1–2: **Průzkum** v bezpečné lokaci, vyhrávej souboje až **level 3+** | Level-up v deníku; při předčasném útoku na bosse **srozumitelná hláška** (level / jáma), ne „boss tu není“ |
| 8 | V jámě: zaútoč / chip boss; dokonči boj | Chapter complete, odměna v deníku |
| 9 | **Character** → inventář: **Equip** jiná zbraň; koupit / **použít lektvar** v boji nebo po boji | HP / vybavení konzistentní |
| 10 | **Nib's shop**: koupit lektvar (pokud máš gold) | Gold klesne, položka v inventáři |
| 11 | Zavři Mini App (swipe away) → znovu otevři → **Pokračovat** | Stejná postava, deník, quest stav |

### 4.3 Facilitátor — během / po

- Sledovat zaseknutí (fráze, mapa, level u bosse).
- Po kroku 11 ověřit persist DB (SQLite `data/dnd.db` lokálně).
- Vyplnit minimálně **C1–C5, D1–D5** z `TELEGRAM_MOBILE_QA_V1.md` na testovaném zařízení.

---

## 5. Otevřená rizika

| ID | Severity | Riziko |
|----|----------|--------|
| S12-R1 | **P0** | Žádný fyzický Telegram QA — viewport, klávesnice, SSE v WebView neověřeny |
| S12-R2 | **P1** | Playtest na **necommitnutém** stavu — reprodukce bugů vyžaduje stejný working tree |
| S12-R3 | **P1** | Remote `origin/clean-main` = `aa8faea` **bez** quest chipů a boss UX |
| S12-R4 | **P2** | Ngrok / BotFather URL drift → test „špatné“ verze |
| S12-R5 | **P2** | `E2E_RNG_SEED` omylem v `.env` → předvídatelné boje na sdíleném API |
| S12-R6 | **P2** | pytest log soubory v rootu — riziko omylu při commitu |
| S12-R7 | **P1 play** | Grind před bossem — hráč bez facilitator hintu může stagnovat (viz 11.4) |

---

## 6. Rozhodnutí

| Otázka | Verdikt |
|--------|---------|
| Je kód připraven na **lokální** interní playtest přes ngrok? | **ANO** — za předpokladu facilitator checklistu, Lite režimu a varování k levelu bosse |
| Je verze připravena na **nejširší** interní acceptance bez facilitátora? | **NE** |
| Je verze připravena na **staging/production** bez commitu 11.x? | **NE** |
| Je fyzická Telegram readiness **doložena**? | **NE** — povinný první běh podle §4 |

**Doporučený další krok (mimo Sprint 12):** commit pouze aplikačních + test + docs souborů z §1.2–1.3 (bez §1.4), pak jedna facilitovaná session Android **nebo** iOS s vyplněním `TELEGRAM_PHONE_QA.md`.

---

## 7. Rychlý odkaz

| Dokument | Účel |
|----------|------|
| [`DEPLOYMENT.md`](DEPLOYMENT.md) | Lokální API + ngrok základ |
| [`TELEGRAM_PHONE_QA.md`](TELEGRAM_PHONE_QA.md) | Facilitátor Lite/Normal, admin topup |
| [`CHAPTER_ONE_ACCEPTANCE_QA_SPRINT_11_3.md`](CHAPTER_ONE_ACCEPTANCE_QA_SPRINT_11_3.md) | Detailní quest tabulka |
| [`CHAPTER_ONE_PROGRESSION_SPRINT_11_4.md`](CHAPTER_ONE_PROGRESSION_SPRINT_11_4.md) | XP / grind očekávání |
