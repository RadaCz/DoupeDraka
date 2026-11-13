# Sprint 38 — Staging deployment checklist

**Target commit (verified application baseline):** `37d9c885f2b9a2c76c989e0bdc754ed330b4b04b` (`37d9c88` on **`main`**) — deploy až po zeleném CI pro **stejný app SHA** (CI **#93** @ `2f0669c` = poslední známý green na tomto stromu)  
**Schema head:** Alembic **`v005`** (no `v006` until Billing E ships) — viz [`REPO_STATUS_CURRENT.md`](REPO_STATUS_CURRENT.md)  
**Mode:** Lite-first (`LLM_PROVIDER=fallback`) — no paid narration provider required  
**Detailed runbook:** [`STAGING_RUNBOOK_V1.md`](STAGING_RUNBOOK_V1.md)

---

## 0. Operator prerequisites (must exist before deploy)

- [ ] Linux VPS/VM with Docker Engine 24+ and **Docker Compose v2.24+**
- [ ] DNS A/AAAA record for public hostname (e.g. `play.example.com`)
- [ ] TLS certificate on reverse proxy (Caddy/nginx/Traefik)
- [ ] Telegram bot created in BotFather
- [ ] **Secrets prepared offline** (never committed): `BOT_TOKEN`, `BOT_API_TOKEN`, Postgres password, optional `ADMIN_API_KEY`
- [ ] Maintainer confirms GitHub CI **5/5 green** on deploy SHA (baseline: run **[#93](https://github.com/RadaCz/DoupeDraka/actions)** @ `2f0669c`, app tree = `37d9c88`)

**If any item is missing:** stop — **do not claim staging is live**.

---

## 1. Repository on server

- [ ] `git fetch origin` && checkout **`37d9c88`** (or newer **`main`** commit with green CI — no `clean-main`)
- [ ] **Do not** copy local `data/` or Windows SQLite files to server
- [ ] **Do not** deploy with uncommitted Billing E (`v006`) unless explicitly approved later

---

## 2. Environment file (`.env.docker` on server only)

- [ ] Copy from `.env.docker.example` → `.env.docker` (permissions `600`)
- [ ] `DATABASE_URL=postgresql+asyncpg://USER:PASS@postgres:5432/DBNAME` (hostname **`postgres`** inside Compose network)
- [ ] `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` aligned with URL
- [ ] **`DB_BOOTSTRAP=none`** (no `create_all` on startup)
- [ ] **`LLM_PROVIDER=fallback`** (Lite default)
- [ ] `BOT_TOKEN` — real BotFather token (not example placeholder)
- [ ] `BOT_API_TOKEN` — strong shared secret (not example placeholder)
- [ ] `MINI_APP_URL=https://<public-host>` (no trailing slash)
- [ ] `CORS_ORIGINS` — **exactly** the Mini App origin (match `MINI_APP_URL`)
- [ ] No `sqlite` in `DATABASE_URL` on staging
- [ ] Paid provider keys **unset** for Lite-first closed beta

Preflight (never prints secret values):

```powershell
python scripts/staging_preflight.py .env.docker --mode staging
```

- [ ] Exit code **0**

---

## 3. Compose validation & build

```powershell
docker compose --env-file .env.docker -f docker-compose.yml -f docker-compose.staging.yml config
```

- [ ] Config renders without error
- [ ] Postgres **not** published to `0.0.0.0` (staging overlay `ports: !reset`)
- [ ] Frontend published only as intended (loopback + proxy pattern per runbook)

- [ ] `docker compose … build` (first deploy or after Dockerfile change)

---

## 4. Database lifecycle

- [ ] `docker compose … up -d postgres` — wait until **healthy**
- [ ] `docker compose … run --rm api alembic upgrade head`
- [ ] `alembic current` shows head **`v005`**
- [ ] Optional: `alembic check` passes on fresh volume

Persistent data:

- [ ] Named volume **`pgdata`** attached to Postgres service
- [ ] Backup procedure documented before inviting testers (runbook §backup)

---

## 5. Application stack

- [ ] `docker compose … up -d api frontend bot`
- [ ] API logs: no crash loop; DB connection OK
- [ ] Bot polling reaches API (internal network)

---

## 6. HTTPS & Mini App wiring

- [ ] Reverse proxy terminates TLS → `127.0.0.1:5173` (frontend nginx)
- [ ] Browser: `https://<host>/` loads static app (no mixed content)
- [ ] `https://<host>/api/health` returns JSON, `database` dialect **postgresql**
- [ ] `https://<host>/api/ready` returns 200 when DB up
- [ ] BotFather: domain set for bot
- [ ] BotFather: Menu button Web App URL = **`MINI_APP_URL`**
- [ ] Open bot in Telegram → Mini App loads (not blank / not CORS error)

---

## 7. Staging smoke (human, Lite)

- [ ] Register or Telegram `initData` login
- [ ] Create character (wizard or fighter path)
- [ ] One exploration turn + journal line appears
- [ ] Travel on map to known Chapter One node
- [ ] Short rest or shop at Nib (gold spend) if reachable from seed state
- [ ] Enter combat once — HP and End turn visible
- [ ] Reload Mini App — session and character persist

**Normal tier / debit:** defer until provider configured — not required for Lite-first checklist.

---

## 8. Anti-patterns (fail checklist if true)

| Anti-pattern | Action |
|--------------|--------|
| `sqlite+aiosqlite` in staging `DATABASE_URL` | Fix env |
| Example `your_telegram_bot_token_here` still in env | Replace secrets |
| Vite dev server exposed on `:5173` to internet | Use production frontend image only |
| `DB_BOOTSTRAP` missing or `create_all` path used | Set `none` + Alembic |
| Deploy from machine with only local SQLite QA | Re-run gates on target SHA |

---

## 9. Post-deploy verification record

| Field | Value |
|-------|-------|
| Deployed git SHA | |
| Deploy date (UTC) | |
| Hostname | |
| Alembic head | |
| Smoke tester | |
| Result | PASS / FAIL |

Link device QA: [`SPRINT_38_TELEGRAM_QA_PROTOCOL.md`](SPRINT_38_TELEGRAM_QA_PROTOCOL.md)
