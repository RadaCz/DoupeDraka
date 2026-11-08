# Local Development and Deployment

## Local API and frontend

Requirements: Python 3.11+ and Node.js 20+.

```powershell
cd D:\DoupeDraka
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
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

SQLite is the default development database. Apply migrations with `alembic upgrade head`.
PostgreSQL URLs are supported through `DATABASE_URL`; set `PYTEST_DATABASE_URL` to the same
URL when running concurrency tests against a live Postgres service (as in CI).

Merge `clean-main` into `main` only after CI is green on `clean-main`, including the
PostgreSQL migration job and Playwright E2E.

## Continuous integration

GitHub Actions on `main`, `master`, and `clean-main` runs:

- backend: `python -m pytest -q`
- backend-postgres: `alembic upgrade head`, then `tests/test_concurrency.py`
- frontend: Vitest and `npm run build`
- e2e: `npm run test:e2e` (API on 8001, Vite on 5174)

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
