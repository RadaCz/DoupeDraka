# Staging deployment runbook V1 — Lite-first

**Baseline kódu:** `339271d` na `clean-main` · CI run `42824720654` (4/4 SUCCESS).  
**Stav nasazení:** HTTPS staging **NOT DEPLOYED** (tento runbook připravuje první deploy).  
**Související:** [`DEPLOYMENT.md`](DEPLOYMENT.md), [`STAGING_DEVICE_VALIDATION_V1.md`](STAGING_DEVICE_VALIDATION_V1.md), [`TELEGRAM_MOBILE_QA_V1.md`](TELEGRAM_MOBILE_QA_V1.md).

---

## 1. Cílová architektura

```text
Internet (HTTPS)
    │
    ▼
Reverse proxy (Caddy / nginx / Traefik) — TLS termination
    │
    ├──► Frontend container (nginx:80) — Mini App static + proxy /api → api:8000
    │
    └── (volitelně samostatný host pro API — obvykle ne; stačí /api na stejném originu)

Telegram Bot (polling) ──► API (internal Docker network)
PostgreSQL (volume pgdata) ◄── API (žádný veřejný port)
```

**Invarianty:** herní data jsou v PostgreSQL (volume `pgdata`). Restart API/frontend/bota **nezmaže** postavy; restart Postgres kontejneru s volume **nezmaže** data. `DB_BOOTSTRAP=none` — API nespouští `create_all`.

---

## 2. Požadavky na hosting

| Oblast | Minimum |
|--------|---------|
| **VPS / VM** | 2 vCPU, 4 GB RAM, 20+ GB disk (Lite-first bez GPU) |
| **OS** | Linux (Ubuntu 22.04+ doporučeno) nebo Windows Server s Docker Desktop pro smoke |
| **Docker** | Engine 24+ a `docker compose` v2 |
| **DNS** | A/AAAA záznam na veřejný hostname (např. `play.staging.example`) |
| **HTTPS** | Platný certifikát (Let’s Encrypt přes Caddy doporučeno) |
| **Telegram** | BotFather: domain + menu button Web App URL = **`MINI_APP_URL`** |
| **Egress** | Bot musí dosáhnout `api.telegram.org`; hráči dosáhnout staging HTTPS |

**Nepublikovat:** PostgreSQL ani API na internet. Lokální `docker-compose.yml` mapuje `5432` a `8000` pro dev. Veřejný staging používejte **`docker-compose.staging.yml`** (merge + `ports: !reset`) a host proxy jen na **`127.0.0.1:5173`**.

---

## 3. Proměnné prostředí (Lite-first staging)

Soubor na serveru: `.env.docker` (zkopírovat z `.env.docker.example`, **nikdy** necommitovat).

### Povinné

| Proměnná | Tajná? | Hodnota / pravidlo |
|----------|--------|-------------------|
| `DATABASE_URL` | částečně | `postgresql+asyncpg://USER:PASSWORD@postgres:5432/DB` (hostname služby `postgres` v Compose) |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | částečně | Shodné s `DATABASE_URL` |
| `DB_BOOTSTRAP` | ne | **`none`** |
| `BOT_TOKEN` | **ano** | BotFather token |
| `BOT_API_TOKEN` | **ano** | Sdílený secret bot ↔ API (viz README) |
| `MINI_APP_URL` | ne | **`https://<hostname>`** bez trailing slash |
| `CORS_ORIGINS` | ne | Přesně origin Mini App (stejný jako `MINI_APP_URL`) |
| `LLM_PROVIDER` | ne | **`fallback`** (Lite — bez placeného providera) |

### Frontend build (Dockerfile `ARG`)

| Proměnná | Poznámka |
|----------|----------|
| `VITE_API_URL` | Výchozí **`/api`** (nginx v image proxy na `api:8000`) — vhodné pro jeden veřejný host |
| `VITE_TELEGRAM_BOT_USERNAME` | Volitelné; jen pro share odkazy (veřejné) |

### Volitelné

| Proměnná | Kdy |
|----------|-----|
| `ADMIN_API_KEY` | Facilitátor top-up / `/admin/*` — pouze pokud potřeba bety |
| Provider keys (`OPENROUTER_API_KEY`, …) | **Ne** pro Lite-first closed beta |

**Nikdy do frontend image:** `BOT_TOKEN`, `BOT_API_TOKEN`, `ADMIN_API_KEY`, provider keys.

**Normal / Pro:** Pro tier zůstává v API vypnutý. Normal až po zvláštním provider setupu (viz `STAGING_DEVICE_VALIDATION_V1.md`).

---

## 4. Příprava před prvním startem (Windows — lokální správa repa)

```powershell
cd D:\DoupeDraka
Copy-Item .env.docker.example .env.docker
# Upravte .env.docker na serveru nebo zkopírujte na VPS — necommitovat.

python scripts/staging_preflight.py .env.docker --mode staging
python scripts/secret_scan.py
```

`staging_preflight.py` kontroluje **pojmenované klíče a politiku** (Postgres URL, `DB_BOOTSTRAP=none`, `LLM_PROVIDER=fallback`, HTTPS `MINI_APP_URL`, shodu CORS). **Nevypisuje** hodnoty secretů.

---

## 5. První spuštění (server — Linux)

> Nahraďte cestu k repozitáři a env souboru.

```bash
cd /opt/doupedraka
docker compose --env-file .env.docker -f docker-compose.yml -f docker-compose.staging.yml build
docker compose --env-file .env.docker -f docker-compose.yml -f docker-compose.staging.yml up -d postgres
# Počkej na healthy postgres (healthcheck v compose).

docker compose --env-file .env.docker -f docker-compose.yml -f docker-compose.staging.yml run --rm api alembic upgrade head
docker compose --env-file .env.docker -f docker-compose.yml -f docker-compose.staging.yml up -d api frontend bot
```

**Lokální ekvivalent (PowerShell na stroji s Dockerem):**

```powershell
cd D:\DoupeDraka
docker compose --env-file .env.docker -f docker-compose.yml -f docker-compose.staging.yml up -d postgres
docker compose --env-file .env.docker -f docker-compose.yml -f docker-compose.staging.yml run --rm api alembic upgrade head
docker compose --env-file .env.docker -f docker-compose.yml -f docker-compose.staging.yml up -d api frontend bot
```

### HTTPS reverse proxy (příklad — Caddy)

Veřejný proxy směruje na **frontend** (port mapovaný z compose, typicky `5173:80`):

```text
play.staging.example {
    reverse_proxy 127.0.0.1:5173
}
```

API zůstává dostupné přes `https://play.staging.example/api/…` (nginx v `frontend/nginx.conf`).

---

## 6. Ověření readiness (po HTTPS)

**Server:**

```bash
curl -sS "https://play.staging.example/api/health" | head -c 400
curl -sS "https://play.staging.example/api/ready"
```

Očekávání: HTTP 200, `ready` obsahuje `"status":"ready"`.

**Telegram:**

1. Bot `/start` — tlačítko Mini App s URL = `MINI_APP_URL`.
2. Otevřít v Telegramu — úspěšné přihlášení přes `initData` (ne prázdná brána).
3. Vytvořit postavu, jeden tah explore v **Lite** (žádný debet ⚡).

**Persistence po restartu:**

```bash
docker compose --env-file .env.docker -f docker-compose.yml -f docker-compose.staging.yml restart api frontend
```

Znovu otevřít Mini App — stejná postava a journal.

---

## 7. Smoke test (Lite)

| # | Kroky | Pass kritérium |
|---|--------|----------------|
| S1 | `staging_preflight.py` | exit 0 |
| S2 | `alembic upgrade head` | bez chyby, head **v005** |
| S3 | `/health`, `/ready` | 200 |
| S4 | Telegram login | token v aplikaci, roster načten |
| S5 | Jeden `/actions` stream | journal + state_changed |
| S6 | `docker compose restart api` | data zachována |

Load test (`LOAD_TEST_ENABLED`) **nepoužívat** na sdíleném stagingu bez izolace.

---

## 8. Záloha a obnova PostgreSQL

### Záloha (server)

```bash
docker compose --env-file .env.docker -f docker-compose.yml -f docker-compose.staging.yml exec -T postgres \
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc > "backup-$(date +%Y%m%d-%H%M).dump"
```

Uložte dump mimo volume (S3, offline disk). **Necommitovat.**

### Obnova (nový volume nebo po katastrofě)

```bash
docker compose --env-file .env.docker -f docker-compose.yml -f docker-compose.staging.yml up -d postgres
docker compose --env-file .env.docker -f docker-compose.yml -f docker-compose.staging.yml exec -T postgres \
  pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists < backup.dump
```

Migrace po restore: pokud dump je z aktuální head, `alembic upgrade head` by měl být no-op.

---

## 9. Aktualizace a rollback (bez mazání DB)

### Bezpečná aktualizace

```bash
git fetch && git checkout 339271d   # nebo novější tag po CI green
docker compose --env-file .env.docker -f docker-compose.yml -f docker-compose.staging.yml build
docker compose --env-file .env.docker -f docker-compose.yml -f docker-compose.staging.yml run --rm api alembic upgrade head
docker compose --env-file .env.docker -f docker-compose.yml -f docker-compose.staging.yml up -d
```

### Rollback aplikace (zachovat `pgdata`)

```bash
# Nasadit předchozí image / checkout předchozího commitu
docker compose --env-file .env.docker -f docker-compose.yml -f docker-compose.staging.yml up -d --force-recreate api frontend bot
```

**Nespouštět** `docker volume rm pgdata` při rollbacku. Schéma vracet jen pokud migrace selhala a máte DB backup.

---

## 10. Bezpečnostní kontrolní seznam

| # | Kontrola |
|---|----------|
| B1 | Secrets jen v `.env.docker` na serveru |
| B2 | `.env` / `.env.docker` v `.gitignore` / `.dockerignore` |
| B3 | Postgres bez veřejného portu |
| B4 | `DB_BOOTSTRAP=none` |
| B5 | `LLM_PROVIDER=fallback` pro Lite beta |
| B6 | Logy neobsahují celé tokeny (API loguje initData chyby bez dumpu secretů) |
| B7 | `secret_scan.py` před release |

---

## 11. Co je automaticky ověřeno vs. ručně

| Automatizováno (lokálně / CI) | Vyžaduje skutečný staging |
|-------------------------------|---------------------------|
| `tests/test_staging_preflight.py` | HTTPS + DNS + certifikát |
| `python scripts/staging_preflight.py` | Telegram initData na telefonu |
| CI: pytest, alembic v005, Vitest, E2E | Fyzické QA Android/iOS |
| `secret_scan.py` | Normal debit/refund |
| | Persistence smoke po restartu na VPS |

---

## 12. Existující artefakty v repu (ne duplikovat)

- `docker-compose.yml` — postgres, api, frontend, bot, volume `pgdata`, `restart: unless-stopped`
- `Dockerfile` — uvicorn API image (bez `.env` v image)
- `frontend/Dockerfile` + `frontend/nginx.conf` — produkční static + `/api` proxy
- `alembic/` + `alembic upgrade head` přes API container
- Endpointy `/health`, `/ready` v `app/api.py`

Žádný samostatný „staging compose“ v tomto sprintu — upravte override na serveru podle §2.
