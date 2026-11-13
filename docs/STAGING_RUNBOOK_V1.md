# Staging deployment runbook V1 — Lite-first

**Verified application baseline:** `37d9c885f2b9a2c76c989e0bdc754ed330b4b04b` (`37d9c88`) na **`main`** — CI run **[#93](https://github.com/RadaCz/DoupeDraka/actions)** @ `2f0669c` (**5/5**). Alembic head **`v005`** (bez v006). Viz [`REPO_STATUS_CURRENT.md`](REPO_STATUS_CURRENT.md).  
**Poslední nasazený commit (runtime):** **žádný** — HTTPS staging **NOT DEPLOYED** (runbook připravuje první deploy; staging **neběží**, dokud ops nedokončí §5–§6 na skutečném hostu).  
**Související:** [`DEPLOYMENT.md`](DEPLOYMENT.md), [`SPRINT_38_STAGING_CHECKLIST.md`](SPRINT_38_STAGING_CHECKLIST.md), [`STAGING_DEVICE_VALIDATION_V1.md`](STAGING_DEVICE_VALIDATION_V1.md), [`TELEGRAM_MOBILE_QA_V1.md`](TELEGRAM_MOBILE_QA_V1.md).

---

## 1. Cílová architektura

```text
Internet (HTTPS)
    │
    ▼
Reverse proxy (Caddy / nginx / Traefik) — TLS termination
    │
    └──► Frontend container (nginx:80) on 127.0.0.1:5173 — static + /api → api:8000

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
| **Docker** | Engine 24+ a **`docker compose` v2.24+** (overlay `docker-compose.staging.yml` používá `ports: !reset`) |
| **DNS** | A/AAAA záznam na veřejný hostname (např. `play.staging.example`) |
| **HTTPS** | Platný certifikát (Let’s Encrypt přes Caddy doporučeno) |
| **Telegram** | BotFather: domain + menu button Web App URL = **`MINI_APP_URL`** |
| **Egress** | Bot musí dosáhnout `api.telegram.org`; hráči dosáhnout staging HTTPS |

**Nepublikovat:** PostgreSQL ani API na internet. Lokální `docker-compose.yml` mapuje `5432` a `8000` pro dev. Veřejný staging používejte merge **`docker-compose.yml` + `docker-compose.staging.yml`** a host proxy jen na **`127.0.0.1:5173`**.

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
| `VITE_API_URL` | Výchozí **`/api`** (nginx v image proxy na `api:8000`) |
| `VITE_TELEGRAM_BOT_USERNAME` | Volitelné; jen pro share odkazy |

### Volitelné

| Proměnná | Kdy |
|----------|-----|
| `ADMIN_API_KEY` | Facilitátor top-up / `/admin/*` |
| Provider keys (`OPENROUTER_API_KEY`, …) | **Ne** pro Lite-first closed beta |

**Nikdy do frontend image:** `BOT_TOKEN`, `BOT_API_TOKEN`, `ADMIN_API_KEY`, provider keys.

---

## 4. Příprava před prvním startem (Windows — lokální správa repa)

1. **Konfigurace** — `.env.docker` na serveru (§3).
2. **Preflight** — `python scripts/staging_preflight.py .env.docker --mode staging` → exit 0.
3. **Compose config** — merge overlay (§5 krok 3).
4. **Secret scan** — `python scripts/secret_scan.py` → OK.

```powershell
cd D:\DoupeDraka
Copy-Item .env.docker.example .env.docker
# Upravte .env.docker na serveru — necommitovat.

python scripts/staging_preflight.py .env.docker --mode staging
python scripts/secret_scan.py
docker compose --env-file .env.docker -f docker-compose.yml -f docker-compose.staging.yml config
```

**Runtime stav:** Dokud neproběhnou §5–§6 na skutečném hostu, staging je **NOT DEPLOYED** pro testery.

---

## 5. První spuštění (server — Linux)

Pořadí: **konfigurace → preflight → `compose config` → Postgres → migrace → služby → HTTPS → health/ready → Telegram smoke**.

| Krok | Akce |
|------|------|
| 1 | `git fetch origin` && checkout commit s **zeleným CI** na **`main`** (minimum: **`37d9c88`**; ověř stejný SHA na GitHub Actions). `.env.docker` vyplněn (§3). |
| 2 | `python scripts/staging_preflight.py .env.docker --mode staging` → exit 0. |
| 3 | `docker compose -f docker-compose.yml -f docker-compose.staging.yml … config` — Compose **v2.24+**. |
| 4 | `build` (první deploy nebo po změně Dockerfile). |
| 5 | `up -d postgres` — počkat na **healthy**. |
| 6 | `run --rm api alembic upgrade head` — head **`v005`** (nesmí být necommitnuté **v006** na serveru). |
| 7 | `up -d api frontend bot`. |
| 8 | HTTPS reverse proxy → **`127.0.0.1:5173`** (§5.1). |
| 9 | `curl` `/api/health` a `/api/ready` přes HTTPS (§6). |
| 10 | Telegram smoke (§6). |

```bash
cd /opt/doupedraka
git fetch origin && git checkout 37d9c88   # nebo novější app SHA po CI green na main
export COMPOSE_FILES="-f docker-compose.yml -f docker-compose.staging.yml"
docker compose --env-file .env.docker $COMPOSE_FILES config
docker compose --env-file .env.docker $COMPOSE_FILES build
docker compose --env-file .env.docker $COMPOSE_FILES up -d postgres
docker compose --env-file .env.docker $COMPOSE_FILES run --rm api alembic upgrade head
docker compose --env-file .env.docker $COMPOSE_FILES up -d api frontend bot
```

**Lokální ekvivalent (PowerShell, Docker na stroji):**

```powershell
cd D:\DoupeDraka
git fetch origin
git checkout 37d9c88
docker compose --env-file .env.docker -f docker-compose.yml -f docker-compose.staging.yml config
docker compose --env-file .env.docker -f docker-compose.yml -f docker-compose.staging.yml up -d postgres
docker compose --env-file .env.docker -f docker-compose.yml -f docker-compose.staging.yml run --rm api alembic upgrade head
docker compose --env-file .env.docker -f docker-compose.yml -f docker-compose.staging.yml up -d api frontend bot
```

### 5.1 HTTPS reverse proxy (příklad — Caddy)

```text
play.staging.example {
    reverse_proxy 127.0.0.1:5173
}
```

API zůstává na `https://play.staging.example/api/…` (`frontend/nginx.conf`).

---

## 6. Ověření readiness (po HTTPS)

```bash
curl -sS "https://play.staging.example/api/health" | head -c 400
curl -sS "https://play.staging.example/api/ready"
```

Telegram: `/start` → Mini App = `MINI_APP_URL` → login přes `initData` → jeden Lite tah.

**Persistence po restartu:**

```bash
docker compose --env-file .env.docker -f docker-compose.yml -f docker-compose.staging.yml restart api frontend
```

---

## 7. Smoke test (Lite)

| # | Kroky | Pass kritérium |
|---|--------|----------------|
| S1 | `staging_preflight.py` | exit 0 |
| S2 | `alembic upgrade head` | bez chyby, head **v005** |
| S3 | `/health`, `/ready` | 200 |
| S4 | Telegram login | roster načten |
| S5 | Jeden `/actions` stream | journal + state_changed |
| S6 | `docker compose restart api` | data zachována |

---

## 8. Záloha a obnova PostgreSQL

```bash
docker compose --env-file .env.docker -f docker-compose.yml -f docker-compose.staging.yml exec -T postgres \
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc > "backup-$(date +%Y%m%d-%H%M).dump"
```

Obnova: `pg_restore` do zdravého Postgres se zachovaným volume `pgdata` (viz původní runbook §8 — stejné příkazy s merge soubory).

---

## 9. Aktualizace a rollback (bez mazání DB)

### Bezpečná aktualizace

```bash
git fetch origin && git checkout <SHA>   # novější commit na main po CI green
docker compose --env-file .env.docker -f docker-compose.yml -f docker-compose.staging.yml build
docker compose --env-file .env.docker -f docker-compose.yml -f docker-compose.staging.yml run --rm api alembic upgrade head
docker compose --env-file .env.docker -f docker-compose.yml -f docker-compose.staging.yml up -d
```

### Rollback aplikace (zachovat `pgdata`)

Checkout předchozího SHA / image, `up -d --force-recreate api frontend bot`. **Nespouštět** `docker volume rm pgdata`.

---

## 10. Bezpečnostní kontrolní seznam

| # | Kontrola |
|---|----------|
| B1 | Secrets jen v `.env.docker` na serveru |
| B2 | Postgres/API bez veřejného portu (staging overlay) |
| B3 | Frontend jen `127.0.0.1:5173` + HTTPS proxy |
| B4 | `DB_BOOTSTRAP=none` + Alembic **v005** |
| B5 | `LLM_PROVIDER=fallback` |
| B6 | `secret_scan.py` před release |

---

## 11. Co je automatizováno vs. ručně

| Automatizováno (CI / lokálně) | Vyžaduje skutečný staging |
|-------------------------------|---------------------------|
| pytest, alembic v005, Vitest, Playwright E2E | HTTPS + DNS + certifikát |
| `staging_preflight.py` | Telegram initData na telefonu |
| `secret_scan.py` | Fyzické QA Android/iOS |

---

## 12. Artefakty v repu (použít tyto soubory)

| Soubor | Účel |
|--------|------|
| `docker-compose.yml` | Dev + základ služeb (postgres, api, frontend, bot, `pgdata`) |
| **`docker-compose.staging.yml`** | Staging overlay — `ports: !reset`, frontend **`127.0.0.1:5173:80`** |
| `Dockerfile` | API + bot image |
| `frontend/Dockerfile` + `frontend/nginx.conf` | Produkcční static + `/api` proxy |
| `alembic/` | Migrace přes `docker compose … run --rm api alembic upgrade head` |
| `app/api.py` | `/health`, `/ready` |

První veřejný staging **vždy** používá **merge obou compose souborů** (viz komentář v `docker-compose.staging.yml`).
