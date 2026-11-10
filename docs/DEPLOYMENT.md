# Local Development and Deployment

## Local API and frontend

Requirements: Python 3.11+ and Node.js 20+.

```powershell
cd D:\DoupeDraka
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
pip install -r requirements-dev.txt
python -m uvicorn app.api:app --reload
```

In another PowerShell:

```powershell
cd D:\DoupeDraka\frontend
npm install
npm run dev
```

API docs: `http://127.0.0.1:8000/docs`; Vite: `http://127.0.0.1:5173`.
Opening Vite outside Telegram intentionally shows the authentication gate.

## Telegram Mini App development

1. Configure a real Telegram bot token in the private root `.env`; do not share or
   commit it.
2. Run the API and frontend as above.
3. Expose port 5173 with a temporary HTTPS tunnel such as `ngrok http 5173`.
4. Set `NGROK_HOST` in `frontend/.env` to the tunnel hostname only, then restart Vite.
5. Set the bot's Mini App menu button to the HTTPS URL and open it inside Telegram.

Only use a temporary tunnel for your own QA and stop it afterward. The browser E2E
suite uses synthetic signed `initData` and does not require Telegram or a real token.

## Database and containers

### SQLite (local default)

SQLite is the default development database (`sqlite+aiosqlite:///./data/dnd.db`).
`init_db()` still calls `create_all` for fast local bootstrap; prefer Alembic when sharing
schema with production.

### PostgreSQL (production)

Use asyncpg:

```env
DATABASE_URL=postgresql+asyncpg://doupe:doupe@localhost:5432/doupedraka
DB_POOL_SIZE=10
DB_MAX_OVERFLOW=20
DB_BOOTSTRAP=none
```

Set `DB_BOOTSTRAP=none` in production so startup does not run `create_all`; apply schema with Alembic only. Local SQLite dev keeps the default `create_all`.

Docker Compose includes Postgres 16 (persistent volume `pgdata`):

```powershell
Copy-Item .env.docker.example .env.docker
# Align POSTGRES_PASSWORD and DATABASE_URL in .env.docker
docker compose --env-file .env.docker up -d postgres
docker compose --env-file .env.docker run --rm api alembic upgrade head
docker compose --env-file .env.docker up -d api frontend bot
```

Migrations (clean database):

```powershell
alembic upgrade head
```

Revision chain ends at `v005` (`v004` default narrator tier `lite`; `v005` backfills NULL
timestamps and enforces NOT NULL to match ORM models).

Set `PYTEST_DATABASE_URL` to the same URL when running concurrency tests against Postgres (as in CI).

Merge `clean-main` into `main` only after CI is green on `clean-main`, including the
PostgreSQL migration job and Playwright E2E.

**Current `clean-main` baseline (2026-11-10):** commit `339271d` · GitHub Actions run
`42824720654` — backend, backend-postgres, frontend, e2e all SUCCESS. Staging HTTPS
deploy is separate and remains **NOT DEPLOYED** until ops follows
[`STAGING_DEVICE_VALIDATION_V1.md`](STAGING_DEVICE_VALIDATION_V1.md).

## Staging deployment (Lite-first)

Operational runbook: [`STAGING_RUNBOOK_V1.md`](STAGING_RUNBOOK_V1.md) (architecture, env,
migrations, backup/rollback, smoke tests).

**Existing stack (no duplicate compose file):** root `docker-compose.yml` builds API
(`Dockerfile`), production frontend (`frontend/Dockerfile` + nginx `/api` proxy), Postgres 16
with named volume `pgdata`, and Telegram bot (`python -m app.bot`).

Before first staging start:

```powershell
Copy-Item .env.docker.example .env.docker
# Edit on the server only — never commit.
python scripts/staging_preflight.py .env.docker --mode staging
```

Public staging merges **`docker-compose.staging.yml`** (loopback frontend, no Postgres/API
host ports):

```powershell
docker compose --env-file .env.docker -f docker-compose.yml -f docker-compose.staging.yml config
docker compose --env-file .env.docker -f docker-compose.yml -f docker-compose.staging.yml run --rm api alembic upgrade head
docker compose --env-file .env.docker -f docker-compose.yml -f docker-compose.staging.yml up -d
```

Lite-first staging requires `DB_BOOTSTRAP=none`, `LLM_PROVIDER=fallback`,
`postgresql+asyncpg` `DATABASE_URL` aligned with `POSTGRES_*`, HTTPS `MINI_APP_URL`, and
matching `CORS_ORIGINS`. Local dev may use plain `docker-compose.yml` with published ports.

HTTPS terminates at an external reverse proxy (Caddy/nginx) in front of the frontend
container; do not expose `vite` dev server on staging.

## Continuous integration

GitHub Actions on `main`, `master`, and `clean-main` runs:

- backend: `python -m pytest -q`
- backend-postgres: `alembic upgrade head`, then `tests/test_concurrency.py` and `tests/test_alembic_v005.py`
- frontend: Vitest and `npm run build`
- e2e: `npm run test:e2e` (API on 8001, Vite on 5174); Chromium only

**Dependency caching (od `0112747`):**

- `setup-python` with `cache: pip` keyed on `requirements-dev.txt` (all Python jobs).
- `setup-node` with `cache: npm` on `frontend/package-lock.json` (frontend + e2e).
- `actions/cache` on `~/.cache/ms-playwright` keyed on `hashFiles('frontend/package-lock.json')`.
  Install step still runs `npx playwright install --with-deps chromium`; on cache hit downloads are skipped.

`docker compose up --build` is configured for the API, bot, and frontend. Before the
first run (and before upgrades), apply migrations inside the API image:

```powershell
docker compose run --rm api alembic upgrade head
```

Set `MINI_APP_URL` to the public HTTPS origin of the frontend service so `/start` can
open the Mini App. API exposes `/health` for liveness and `/ready` after the database
answers `SELECT 1`.

## Narration provider

The default `LLM_PROVIDER=fallback` runs without a model. For local Ollama, set
`LLM_PROVIDER=ollama`, configure `OLLAMA_URL` and `OLLAMA_MODEL`, and start Ollama.
Narration failure falls back without blocking or undoing a committed turn.

Real payments are not enabled. Top-up routes remain admin-gated; do not configure a
production payment flow without a separate product/security review.

## Admin telemetry

Set `ADMIN_API_KEY` (alias: `ADMIN_TOKEN`) in the API `.env`. Pass it as the
`X-Admin-Token` header on admin routes.

```powershell
curl -s -H "X-Admin-Token: $env:ADMIN_API_KEY" http://127.0.0.1:8000/admin/stats
```

The response includes character counts, deaths per character, popular shop items,
and LLM fallback rates from the first-party `analytics_events` table (no third-party
analytics SDK).

## Seed script (QA / load smoke)

From the repo root with the same `DATABASE_URL` as the API:

```powershell
python scripts/seed_test_data.py
```

This creates user `qa_seed_player`, five leveled characters with varied inventories,
and fifty random engine turns plus journal rows. Use it to exercise the UI and DB
without manual play.

## Load testing

Start the API with optional mock narration (no external LLM calls):

```env
LOAD_TEST_ENABLED=true
ACTION_RATE_LIMIT=240/minute
AUTH_RATE_LIMIT=240/minute
```

```powershell
python scripts/load_test.py --base-url http://127.0.0.1:8000 --users 20 --turns 5 --mock-llm
```

The script reports engine vs narration latency percentiles and prints in-process
gateway hit counters from `GET /health`.

## Health check

`GET /health` returns version, uptime, database dialect/status, configured LLM providers,
and gateway metrics. `GET /ready` remains a minimal `SELECT 1` probe for orchestrators.

## Known deprecation warnings (documented, not yet refactored)

- FastAPI `@app.on_event("startup")` — migrate to lifespan handlers when touching `app/api.py` startup.
- `datetime.utcnow()` in `app/api.py` — replace with timezone-aware `datetime.now(datetime.UTC)` in a focused pass.
