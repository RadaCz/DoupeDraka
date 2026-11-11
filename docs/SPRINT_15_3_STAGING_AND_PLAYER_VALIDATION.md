# Sprint 15.3 — Staging Readiness & Real Player Validation Preparation

**Baseline kódu:** `50a88900756792d72284b40fb162f5639a5c29e9` (`clean-main`, synced s `origin/clean-main`)  
**CI (uživatelský vstup):** run pro `50a8890` — backend, backend-postgres, frontend, E2E **zelené** (lokálně v tomto slice **neověřeno**).  
**Poslední nasazený staging:** **NOT DEPLOYED** (repo baseline ≠ runtime).  
**Související staging docs (synchronizováno v 15.3.1):** [`STAGING_RUNBOOK_V1.md`](STAGING_RUNBOOK_V1.md), [`DEPLOYMENT.md`](DEPLOYMENT.md), [`STAGING_DEVICE_VALIDATION_V1.md`](STAGING_DEVICE_VALIDATION_V1.md), [`SPRINT_15_3_1_DOCUMENTATION_TRUTH_SYNC.md`](SPRINT_15_3_1_DOCUMENTATION_TRUTH_SYNC.md).  
**Omezení sprintu:** žádný commit, push, deploy, změna secretů ani herní ekonomiky.

---

## 1. Git baseline

| Kontrola | Stav | Důkaz / příkaz | Blokující problém | Další krok |
|----------|------|----------------|-------------------|------------|
| HEAD = `50a8890` | **PASS** | `git rev-parse HEAD` → `50a88900756792d72284b40fb162f5639a5c29e9` | — | — |
| Branch `clean-main` | **PASS** | `git branch -vv` → `* clean-main ... [origin/clean-main]` | — | — |
| Sync s origin | **PASS** | `git status -sb` → `clean-main...origin/clean-main` (bez ahead/behind) | — | — |
| Zachování untracked | **PASS** | `git status` — pouze `??` pytest logy, `data/`, `tools/audit_cs_suspects.py` | — | — |
| Destruktivní git operace | **PASS** | žádný reset/clean/stash/checkout/revert v tomto slice | — | — |
| Lokální změny tracked souborů | **PASS** | working tree čistý kromě nového tohoto dokumentu (záměrný výstup sprintu) | — | Po schválení reportu rozhodnout o commitu dokumentu |

---

## 2. Staging audit

### 2.1 Dokumentace a konfigurační artefakty

| Kontrola | Stav | Důkaz | Blokující problém | Další krok |
|----------|------|-------|-------------------|------------|
| `docs/STAGING_RUNBOOK_V1.md` existuje a popisuje Lite-first architekturu | **PASS** | runbook §1–6; baseline sjednocen v Sprint **15.3.1** | **HTTPS staging NOT DEPLOYED** (záměrně) | Nasadit dle runbooku §5 |
| `scripts/staging_preflight.py` | **PASS** | skript + `tests/test_staging_preflight.py` | — | Na VPS spustit proti reálnému `.env.docker` |
| `docker-compose.staging.yml` | **PASS** | `postgres`/`api`/`bot` `ports: !reset []`; frontend `127.0.0.1:5173:80` | Vyžaduje Compose **v2.24+** kvůli `!reset` | Ověřit verzi compose na deploy hostu |
| `docker-compose.yml` (dev) vs staging | **PASS** | dev publikuje `5432`, `8000`, `5173`; staging overlay maže DB/API/bot porty | Bez overlay by DB/API šly na internet | Deploy vždy: `-f docker-compose.yml -f docker-compose.staging.yml` |
| `.env.docker.example` Lite politika | **PASS** | `LLM_PROVIDER=fallback`, `DB_BOOTSTRAP=none` | Ukázkové `CORS_ORIGINS` jsou localhost — pro staging nutná shoda s HTTPS `MINI_APP_URL` | Na serveru nastavit produkční origin |
| `docs/DEPLOYMENT.md` / `STAGING_DEVICE_VALIDATION_V1.md` | **PASS** | cross-reference + 15.3.1 truth sync | **NOT DEPLOYED** runtime | Checklist kroků 1–9 v device validation doc |

### 2.2 Migrace a health endpointy

| Kontrola | Stav | Důkaz | Blokující problém | Další krok |
|----------|------|-------|-------------------|------------|
| Alembic head v repu | **PASS** | `python -m alembic heads` → `v005 (head)` (`v005_timestamps_not_null.py`) | — | Po startu Postgresu na stagingu: `alembic upgrade head` |
| Migrace vs kód (DB_BOOTSTRAP) | **PASS** | staging politika `DB_BOOTSTRAP=none`; API `init_db` jen pokud `create_all` | Bez migrace na live DB API nebude ready | Automatizovat migraci v deploy skriptu |
| `GET /health` | **PASS** | `app/api.py` + `app/health_details.py` (DB dialect, LLM chain metadata, bez secretů) | Live odpověď **NOT VERIFIED** | `curl -s https://<host>/api/health` po deployi |
| `GET /ready` | **PASS** | `app/api.py` — `SELECT 1` přes DB session, jinak 503 | Live **NOT VERIFIED** | `curl -s https://<host>/api/ready` po DB |

### 2.3 Oddělení služeb a expozice

| Kontrola | Stav | Důkaz | Blokující problem | Další krok |
|----------|------|-------|-------------------|------------|
| DB/API/bot neveřejné ve staging overlay | **PASS** | `staging_preflight.check_staging_compose_files` (static merge) + unit testy | — | `docker compose config` na Linux VPS pro merge validaci |
| Frontend → API jen přes nginx `/api/` | **PASS** | `frontend/nginx.conf` proxy na `http://api:8000/` | — | TLS jen na reverse proxy hostu |
| Bot → API interně | **PASS** | `docker-compose.yml` `API_URL: http://api:8000` | — | Bot nemusí být na veřejné IP |
| Veřejná dev expozice varování | **PASS** | `check_local_compose_warnings()` v preflight pro dev compose | — | Na VPS nepoužívat samotný base compose bez overlay |

### 2.4 HTTPS, CORS, MINI_APP_URL, Telegram

| Kontrola | Stav | Důkaz | Blokující problém | Další krok |
|----------|------|-------|-------------------|------------|
| Preflight vyžaduje HTTPS `MINI_APP_URL` (staging) | **PASS** | logika v `staging_preflight.py` | — | — |
| CORS musí obsahovat origin z `MINI_APP_URL` | **PASS** | preflight; `.env.docker.example` **FAIL** (localhost vs placeholder HTTPS URL) — očekávané pro šablonu | Reálný `.env.docker` na hostu **chybí** → politika neověřena na produkčních hodnotách | Vytvořit `.env.docker` na serveru, preflight → OK |
| Bot WebApp tlačítko | **PASS** | `app/bot.py` — `WebAppInfo(url=settings.mini_app_url)` při `/start` | `MINI_APP_URL` prázdné → bot odpoví návodem bez tlačítka | BotFather: Menu Button URL = stejná HTTPS doména |
| Telegram initData / login | **PASS** (kód) | API auth vrstva (existující testy auth) | Fyzický Telegram login **NOT VERIFIED** | Smoke na Android/iOS po HTTPS |
| HTTPS staging nasazené | **NOT VERIFIED** | runbook explicitně NOT DEPLOYED | Žádný veřejný hostname pro Mini App | DNS + TLS + reverse proxy → `127.0.0.1:5173` |

### 2.5 Lite / Normal billing a narrace

| Kontrola | Stav | Důkaz | Blokující problém | Další krok |
|----------|------|-------|-------------------|------------|
| Lite bez placeného providera | **PASS** | `LLM_PROVIDER=fallback` → `get_chain_names` prázdné; `effective_billing_tier` → lite; `turn_cost("lite")=0` (`app/engine/economy.py`) | — | Staging držet `fallback` |
| Lite nevolá externí API | **PASS** | `tests/test_billing_contract.py::test_lite_never_calls_external_provider` | — | — |
| Normal bez providera degraduje na Lite | **PASS** | `test_normal_without_external_provider_downgrades_billing_tier` | — | — |
| Normal = 1 ⚡ jen za doručenou externí naraci | **PASS** | `MODEL_TIERS["normal"].cost_tenths=10`; `reconcile_narrator_billing` refunduje pokud `narration_status != "narrated"` (`app/api.py`) | — | Po zapnutí Normal na stagingu jeden manuální test debetu |
| Fallback / selhání narace → refund | **PASS** | `tests/test_api_systems.py` — `test_paid_narration_fallback_writes_refund_ledger`, `test_paid_narration_fallback_refunds_commit_hold` | — | — |
| Přerušený stream → refund + commit mechaniky | **PASS** | `tests/test_stream_cancellation.py::test_stream_cancelled_error_commits_turn_refunds_once_and_reraises` | — | Na zařízení zkusit rychlý návrat během streamu |
| `PAID_NARRATION_STRICT=1` — jeden externí provider | **PASS** | `paid_narration_gateway_for` řeže chain na `providers[:1]`; `tests/test_narration_strict.py` | — | Pro Normal staging nastavit env jen pokud záměrně testujete strict režim |
| Strict zakazuje fallback na dalšího providera | **PASS** | `NarrationGateway(..., paid_strict=True)` + testy strict gateway | — | — |
| Timeout providera (live) | **NOT VERIFIED** | `LLM_READ_TIMEOUT_S` v example; unit testy mock | Síťové timeouty na VPS nezkoušeny | Monitorovat refund ledger po prvních Normal testech |

### 2.6 Bezpečnost repozitáře

| Kontrolla | Stav | Důkaz | Blokující problém | Další krok |
|----------|------|-------|-------------------|------------|
| Secret scan | **PASS** | `python scripts/secret_scan.py` → `Secret scan: OK` | — | Zahrnout do CI/deploy checklistu |
| Tajné hodnoty v reportu | **PASS** | žádné hodnoty tokenů vypisovány | — | — |

### 2.7 CI (regrese kódu)

| Kontrola | Stav | Důkaz | Blokující problém | Další krok |
|----------|------|-------|-------------------|------------|
| CI zelené pro `50a8890` | **PASS** (deklarováno) | uživatelský vstup sprintu | Lokální replay celé CI matice v 15.3 neběžel | Volitelně ručně spustit GitHub Actions na `clean-main` |

---

## 3. Preflight a testy (lokální host Windows)

| Příkaz | Stav | Výstup / poznámka | Blokující | Další krok |
|--------|------|-------------------|-----------|------------|
| `python -m pytest tests/test_staging_preflight.py -q` | **PASS** | 17 passed | — | — |
| `python scripts/staging_preflight.py .env.docker.example --mode staging` | **FAIL** (očekávané) | placeholder hesla/tokeny; CORS vs `MINI_APP_URL` | Šablona není deploy-ready env | Nepoužívat example jako runtime env |
| `python scripts/staging_preflight.py .env.docker --mode staging` | **NOT VERIFIED** | soubor `.env.docker` na tomto hostu **neexistuje** | Nelze ověřit reálnou konfiguraci | Zkopírovat a vyplnit na staging VPS |
| `docker compose config` (merge staging) | **NOT VERIFIED** | `docker` není na PATH (Windows dev host) | — | Na Linux VPS: `docker compose --env-file .env.docker -f docker-compose.yml -f docker-compose.staging.yml config` |
| Compose static merge (bez Dockeru) | **PASS** | preflight vytiskne `Compose validation: static merge (docker compose NOT RUN on this host)` bez compose errors při validním overlay | — | — |
| `python -m pytest tests/test_billing_contract.py tests/test_narration_strict.py -q` | **PASS** | 9 passed | — | — |
| `python -m pytest tests/test_stream_cancellation.py tests/test_api_systems.py -k "refund or fallback or paid_narration" -q` | **PASS** | 4 passed | — | — |
| Nasazení / změna infrastruktury | **PASS** (zákaz dodržen) | žádný deploy v tomto sprintu | — | — |

---

## 4. Reálný Telegram playtest — příprava

### 4.1 Checklist (Android / iOS)

Označte při fyzickém testu: **OK** / **CHYBA** / **N/A**. Tester: jeden interní účet, tier **Lite**, bez admin top-upu.

| # | Oblast | Co ověřit |
|---|--------|-----------|
| 1 | **Otevření Mini App** | Bot `/start` → tlačítko „Otevrit DoupeDraka“; WebView načte bez bílé obrazovky; safe areas (notch, home indicator) neřežou hlavičku / ⚡ |
| 2 | **Navigace** | Přepínání přehled / mapa / deník; návrat z Mini App do chatu a zpět bez ztráty session |
| 3 | **Postava** | Vytvoření nové postavy (jméno, čeština); žádný duplicate error bez důvodu |
| 4 | **Přehled** | Lokace, HP/stamina, ⚡ zůstatek; texty s diakritikou |
| 5 | **Mapa** | Cestování mezi známými uzly kapitoly 1; busy stav během tahu |
| 6 | **Deník** | Akční chipy, stream textu, scroll na dlouhých blocích |
| 7 | **Explorace / odpočinek** | `explore`, `rest`, cooldown — varianta textů, žádné prázdné odpovědi |
| 8 | **Inventář** | Pickup, equip, lektvary — UI čitelné na malém displeji |
| 9 | **Souboj** | Přechod do combat UI, spotřeba zdrojů, návrat po výhře/prohře |
| 10 | **NPC / quest** | Dialogové chipy, postup quest logu (zvon, vault hinty) bez ručních flagů |
| 11 | **Vault & Strážce** | První sestup **po vstupu do Vault of Echoes** (ne náhodně při travel jinam); boss flow do konce kapitoly |
| 12 | **Čeština** | Gramatika, skloňování lokací, žádné anglické zbytky v hráčském UI |
| 13 | **Scroll & klávesnice** | Input jména / search nezakrývá tlačítka; scroll deníku plynulý |
| 14 | **Chyby** | Zaznamenat stack trace v UI, opakující se věty, nejasné CTA, 429 rate limit |

**Logování chyb:** screenshot + čas + poslední akce + přibližný zůstatek ⚡ (bez DB dumpu).

### 4.2 Scénář — jeden hráč (bez zásahů do DB)

**Předpoklady:** HTTPS staging; bot a Mini App URL sladěné; hráč **Lite**; startovní ⚡ z migrace (žádný admin top-up); nový Telegram účet nebo smazaná stará postava přes běžný UI (pokud existuje).

| Krok | Akce hráče | Očekávaný výsledek |
|------|------------|-------------------|
| 1 | Telegram → bot → `/start` → Mini App | Přihlášení, prázdný stav nebo výzva k vytvoření postavy |
| 2 | Vytvoř postavu (české jméno) | Přehled Whispering Cellar / úvodní lokace kapitoly 1 |
| 3 | Deník: projdi úvodní chipy / `look` | Offline narace, ⚡ beze změny (Lite) |
| 4 | Mapa: cestuj po hlavní trase kapitoly 1 (viz herní mapa — sklep, chodby, quest uzly) | Každý **změněný** tah aktualizuje lokaci; journal busy → text |
| 5 | Plň quest beaty pouze přes UI (zvon, NPC rozhovory) | Quest log se posouvá bez cheat flagů |
| 6 | Otevři vault quest linii až do odemčení vaultu | `vault_unlocked` v příběhu; žádný boj „first descent“ jen cestou na jinou mapu |
| 7 | Cestuj záměrně na **jinou** lokaci než Vault | **Žádný** automatický first-descent combat (regrese 15.2) |
| 8 | Vstup do **The Vault of Echoes** | First descent / kobold combat |
| 9 | Dokonči combat, pokračuj v deníku | Návrat z combat UI do adventure |
|10 | Dokonči kapitolu 1 (Strážce zvonu) přes UI chipy | Kapitola 1 complete stav v přehledu / deníku |
|11 | (Volitelně) Přepni narrator tier na Normal **jen pokud** na stagingu běží placený provider | 1 ⚡ jen když status narace `narrated`; při selhání stejný zůstatek ⚡ jako před tím |
|12 | Během streamu krátce zavři Mini App a vrať se | Mechanika tahu uložená; u Normal případný refund (sleduj ⚡) |

**Časový odhad:** 45–90 min (závisí na čtení a bojích).  
**Stop podmínky:** opakované 503 na `/ready`, nemožnost vytvořit postavu, ztráta ⚡ bez narace na Lite, soft-lock bez combat/journal UI.

---

## 5. Závěr sprintu 15.3

### Je staging připravený k nasazení?

**Repo artefakty: ANO · Runtime / použití testerů: NE (NOT VERIFIED).**

- **PASS:** Compose staging overlay, preflight skript, Alembic head, health/ready endpointy, Lite-first env šablona, billing refund logika v kódu + testy, secret scan, CI na `50a8890` (deklarováno), staging dokumentace sjednocena v **15.3.1**.
- **NOT VERIFIED:** živé HTTPS staging, produkční `.env.docker`, `docker compose config` na VPS, migrace na live Postgres, Telegram device QA.

**Doporučení:** první deploy podle `STAGING_RUNBOOK_V1.md` §4–6 (konfigurace → preflight → compose config → služby → migrace → health/ready → Telegram smoke). **Neoznačujte staging jako připravený pro hráče**, dokud neprojde celý runtime checklist.

### Co chybí k HTTPS Telegram testu?

1. Veřejný DNS hostname a TLS (Caddy/nginx/Traefik).
2. Soubor `.env.docker` s platnými **přítomnými** hodnotami: `BOT_TOKEN`, `BOT_API_TOKEN`, `POSTGRES_*`, `DATABASE_URL`, `MINI_APP_URL` (HTTPS), `CORS_ORIGINS`, `LLM_PROVIDER=fallback`, `DB_BOOTSTRAP=none` (hodnoty **necommitovat**).
3. BotFather: doména + Menu Button = `MINI_APP_URL`.
4. `docker compose --env-file .env.docker -f docker-compose.yml -f docker-compose.staging.yml up -d` + `alembic upgrade head`.
5. Reverse proxy na `127.0.0.1:5173` s `/api` proxy (nebo ekvivalent dle hostingu).
6. Smoke: `/health`, `/ready`, Mini App login, jeden kompletní tah.

### Je možné zahájit interní test?

| Režim | Verdikt |
|-------|---------|
| **Plný Telegram Mini App (cíl sprintu)** | **Ne ihned** — chybí HTTPS staging a ověřený bot↔URL páring. |
| **Lokální dev (localhost / tunel)** | **Možné pro vývojáře**, ale neplní „reálný hráč“ validaci (Telegram initData, safe areas, mobilní UX). |
| **Po prvním deployi + smoke** | **Ano** — interní closed skupina 1–3 testerů se scénářem §4.2. |

### Co musí být splněno před uzavřenou betou?

1. HTTPS staging stabilní ≥ 1 týden (uptime, zálohy volume `pgdata`).
2. `staging_preflight.py` OK na produkčním env; `secret_scan.py` OK v pipeline.
3. Android **a** iOS checklist §4.1 bez blokujících CHYBA na core loop (create → chapter 1).
4. Lite jako výchozí tier; Normal/Pro jen po explicitním provider setupu a refund QA.
5. Rate limity a auth smoke pod reálnou Telegram zátěží.
6. Dokumentovaný rollback (runbook) a facilitator postup (`CLOSED_BETA_ONBOARDING_V1.md`).
7. Baseline v hlavních staging docs — hotovo v [`SPRINT_15_3_1_DOCUMENTATION_TRUTH_SYNC.md`](SPRINT_15_3_1_DOCUMENTATION_TRUTH_SYNC.md); po deployi zapsat **nasazený** commit do runbooku (odděleně od repo baseline).
8. Monitoring: `/health`, logy API, Postgres disk.

---

## STOP

Žádný commit, push ani deploy v rámci Sprint 15.3. Report předložen — čeká se na rozhodnutí (deploy / commit dokumentu / spuštění fyzického playtestu).
