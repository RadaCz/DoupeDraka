# Staging & real device validation — Sprint 9

**Repo baseline (audit):** `50a88900756792d72284b40fb162f5639a5c29e9` na `origin/clean-main` — ověř `git rev-parse HEAD` a CI na tomto SHA před deployem.  
**Poslední nasazený commit:** žádný — **HTTPS staging NOT DEPLOYED** (dokument = příprava před prvním deployem; staging **neběží**, dokud ops nedokončí runbook).  
**Compose (veřejný staging):** merge `docker-compose.staging.yml` + `python scripts/staging_preflight.py .env.docker --mode staging`; Compose **v2.24+**.  
**Fyzické QA:** Android **NOT TESTED** · iOS **NOT TESTED** (až po HTTPS `MINI_APP_URL` v Telegramu).  
**Normal (debit/refund):** **NOT TESTED** bez nakonfigurovaného placeného providera.  
**Not verified bez runtime:** živé HTTPS, vyplněný produkční `.env.docker`, `docker compose config` na VPS, fyzický Telegram test (viz [`SPRINT_15_3_STAGING_AND_PLAYER_VALIDATION.md`](SPRINT_15_3_STAGING_AND_PLAYER_VALIDATION.md)).

Související: [`DEPLOYMENT.md`](DEPLOYMENT.md), [`STAGING_RUNBOOK_V1.md`](STAGING_RUNBOOK_V1.md), [`TELEGRAM_MOBILE_QA_V1.md`](TELEGRAM_MOBILE_QA_V1.md), [`CLOSED_BETA_ONBOARDING_V1.md`](CLOSED_BETA_ONBOARDING_V1.md), [`SPRINT_15_3_1_DOCUMENTATION_TRUTH_SYNC.md`](SPRINT_15_3_1_DOCUMENTATION_TRUTH_SYNC.md).

---

## 1. Staging — proměnné prostředí

### Povinné (API + bot)

| Proměnná | Tajná? | Poznámka |
|----------|--------|----------|
| `DATABASE_URL` | částečně | `postgresql+asyncpg://…` na staging Postgres |
| `DB_BOOTSTRAP` | ne | **`none`** — jen Alembic, ne `create_all` |
| `BOT_TOKEN` | **ano** | Telegram BotFather |
| `BOT_API_TOKEN` | **ano** | sdílený token bot ↔ API (viz `.env.example`) |
| `MINI_APP_URL` | ne | **HTTPS** URL frontendu (bez trailing slash) |
| `CORS_ORIGINS` | ne | přesně origin Mini App (např. `https://play.staging.example`) |

### Povinné (staging Lite)

| Proměnná | Hodnota |
|----------|---------|
| `LLM_PROVIDER` | `fallback` (nebo chybějící provider → jen Lite v API) |

### Volitelné / Normal only

| Proměnná | Poznámka |
|----------|----------|
| `OPENROUTER_API_KEY` + `LLM_PROVIDER=openrouter` | placená narace přes OpenRouter |
| `NVIDIA_API_KEY` / `GROQ_API_KEY` / … | dle `LLM_PROVIDER_CHAIN` |
| `ADMIN_API_KEY` | pouze na serveru, top-up testů |

### Frontend (veřejné build-time)

| Proměnná | Tajná? |
|----------|--------|
| `VITE_API_URL` | ne — např. `https://api.staging.example` nebo `/api` za reverse proxy |
| `VITE_TELEGRAM_BOT_USERNAME` | ne — jen pro share odkazy |

**Nikdy do frontendu:** `BOT_TOKEN`, `ADMIN_API_KEY`, provider API keys.

### Kontrolní kroky před otevřením testerům

(shoda s [`STAGING_RUNBOOK_V1.md`](STAGING_RUNBOOK_V1.md) §4–§6)

1. Konfigurace `.env.docker` na serveru (Lite: `LLM_PROVIDER=fallback`, `DB_BOOTSTRAP=none`, HTTPS `MINI_APP_URL` + `CORS_ORIGINS`).
2. `python scripts/staging_preflight.py .env.docker --mode staging` → OK.
3. `docker compose --env-file .env.docker -f docker-compose.yml -f docker-compose.staging.yml config` → bez chyby (Compose v2.24+).
4. Postgres běží, volume `pgdata` persistuje data.
5. `alembic upgrade head` (head **v005**).
6. API, frontend, bot běží; HTTPS proxy na frontend (`127.0.0.1:5173`).
7. `curl -s https://<host>/api/health` → OK; `curl -s https://<host>/api/ready` → OK po DB.
8. BotFather menu button = `MINI_APP_URL`.
9. Mini App v Telegramu — login přes `initData`, vytvoření postavy, jeden Lite tah.

Testerům **neotvírejte** URL, dokud nejsou splněny kroky 1–9 (runtime ověření).

---

## 2. Lite vs Normal — testovací scénáře (staging)

### Lite (priorita closed beta)

| # | Krok | Očekávání |
|---|------|-----------|
| L1 | Nový Telegram user, vytvoř postavu | Lite default / dostupný tier |
| L2 | Nastavení → tier Lite | aktivní, žádný debet za tahy |
| L3 | 3× průzkum + 1 boj | CS deník bez raw Exploration roll v próze |
| L4 | Fallback narace | **žádný** banner na Lite |
| L5 | Reload Mini App | journal konzistentní |

**Výsledek agenta:** NOT TESTED (bez staging URL a telefonu).

### Normal (jen pokud je provider)

| # | Krok | Očekávání |
|---|------|-----------|
| N1 | API nabízí tier Normal v `/economy` | jen s nakonfigurovaným providerem |
| N2 | Úspěšný stream | `narration_status: narrated`, debit po `state_changed` |
| N3 | Timeout / chyba providera | fallback, **refund** / žádný debit |
| N4 | UI | banner zálohy jen Normal+fallback, ne Lite |

**Výsledek agenta:** NOT TESTED (staging provider nespuštěn).

---

## 3. Fyzické QA — zkrácený checklist (plný v TELEGRAM_MOBILE_QA_V1)

Pro každé zařízení vyplň A–L z `TELEGRAM_MOBILE_QA_V1.md`. Minimální must-pass před betou:

- B1 Mini App otevře z bota (HTTPS)
- C1 safe area / Zavřít nepřekrývá lokaci
- D1 první tah dokončí (Lite)
- D4 journal scroll + composer nepřekrývá text
- D6 klávesnice + odeslání
- E1 boj — tah hráče viditelný
- F1 inventář — vybavení bez duplicitního Equip
- G1 BackButton z Mapy → Více, ne duplicitní send
- H1 reload — data zachována

---

## 4. Facilitátor — closed beta (prvních 15–20 min)

Viz [`CLOSED_BETA_ONBOARDING_V1.md`](CLOSED_BETA_ONBOARDING_V1.md) + [`design/CHAPTER_ONE_PLAYTEST_V1.md`](../design/CHAPTER_ONE_PLAYTEST_V1.md).

| # | Akce |
|---|------|
| 1 | Staging green `/ready`, `MINI_APP_URL` v botovi |
| 2 | Tester: nový TG účet, jazyk CS |
| 3 | Vynutit **Lite** v Nastavení |
| 4 | Přehled → pokračovat; první explore v Cellar |
| 5 | Rozhovor Caldus (pokud flow dojde) |
| 6 | Inventář — ověřit zbraň |
| 7 | Mapa / travel (pokud odemčeno) |
| 8 | Dotazník + bug šablona z onboarding doc |

**GO beta:** Lite PASS na Android **a** iOS + stabilní HTTPS staging (runtime) + CI zelené na deployovaném commitu (repo baseline `50a8890` k 15.3.1; staging HTTPS a fyzické QA dosud **NOT VERIFIED**).
