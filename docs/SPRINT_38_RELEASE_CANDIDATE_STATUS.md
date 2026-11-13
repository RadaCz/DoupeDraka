# Sprint 38 — Release candidate status

**Date:** 2026-11-13  
**Repository:** [RadaCz/DoupeDraka](https://github.com/RadaCz/DoupeDraka)  
**Branch:** `clean-main`  
**Release candidate HEAD:** `188f1879bceacfe86cd7e19c1e6b10da840a73de`  
**Prior baseline (pre P0.6):** `894917b812efb5fb280972a9a4397fc789cbd973`

---

## Phase A — Truth sync

### Git & CI

| Check | Status |
|-------|--------|
| Local `HEAD` | `188f187` (matches user baseline) |
| `origin/clean-main` | **In sync** with local `HEAD` after P0.6 push |
| GitHub Actions run [#87](https://github.com/RadaCz/DoupeDraka/actions/runs/43458444949) @ `188f187` | **5/5 success** (`backend`, `backend-postgres`, `backend-slow`, `frontend`, `e2e`) |
| Production / staging deploy | **None** — no runtime commit recorded |

### Evidence matrix (what “done” means)

| Layer | Chapter One solo loop | Billing E (37.4) |
|-------|----------------------|------------------|
| **Implemented** | Yes — engine, API, Mini App | **Working tree only** (not on `HEAD`) |
| **Automated-tested** | Yes — pytest + Vitest + Playwright on CI @ `188f187` | SQLite tests local; **not in CI** |
| **Staging-verified** | **No** | **No** |
| **Physical-device-verified** | **No** (Telegram Android/iOS) | N/A |
| **Player-tested** | **No** closed-beta cohort | N/A |
| **Deferred** | Co-op, payments, Pro tier | **Commit E + v006** until Postgres proof |

### P0.6 commits on `clean-main` (894917b → 188f187)

| SHA | Subject |
|-----|---------|
| `3c470ad` | feat(e2e): stable per-identity RNG (P0.1) |
| `6e4d559` | fix(combat-ui): End turn when action or bonus spent |
| `18aa64b` | test(e2e): Bell Warden UI + combat-reactions |
| `765ec17` | fix(e2e): ghoul harness + runner timeouts |
| `4614f60` | feat(chars): G-09 spell picks + bonus-action economy |
| `3558976` | fix(test): integration + spells contract |
| `f06f4be` | docs: sprint P0.1–P0.5 closure |
| `188f187` | chore(ci): Playwright step timeout 20m |

### Local validation @ `188f187` (maintainer, post-P0.6)

| Gate | Result |
|------|--------|
| `pytest -m "not slow"` | 793 passed, 3 skipped |
| `pytest -m slow` | 21 passed |
| Vitest | 174 passed |
| `typecheck` + `build` | OK |
| Full E2E (`reports/e2e-full-p06.log`) | **ALL PHASES PASS** (~670 s) |

### Alembic head (committed tree)

- **Production schema target on `HEAD`:** `v005` (+ revision `cd64a95bf304` in chain per CI postgres job).
- **`v006_receipt_billing_settlement`:** untracked — **not** part of release candidate.

### Alpha 1.0 product slice (code truth @ `188f187`)

| Criterion | State |
|-----------|--------|
| Solo adventure, one region | **Chapter One** — bell → vault → Bell Warden arc |
| 4–6 main locations | **Six** gated main nodes + three optional (per `PROJECT_BRAIN` / map) |
| NPC, quests, dungeon, boss | Caldus, Nib, bandit camp, vault descent, **Bell Warden** boss |
| Rewards & flags | `bell_acquired`, `chapter_one_complete`, shop gold, XP to L3 |
| Persistence | Postgres-ready; dev SQLite; idempotent `/actions` |
| Saving “story” | Journal events + character blob versioned in DB |

**Not in scope (by policy):** multiplayer, new classes/races, SRD spell catalog expansion, real payments, engine randomness changes for monetization.

### Documentation aligned in Sprint 38

- `PROJECT_BRAIN.md` — HEAD, CI, staging, QA flags  
- `ROADMAP.md` — Sprint 38 banner + closed P0 E2E items  
- `docs/MASTER_PLAN_STATUS.md` — etapy 6–7, CI run #87  
- `docs/DEPLOYMENT.md` — baseline SHA + Alembic head note  

Historical UX audits (`PRODUCT_UX_AUDIT_V1`, etc.) remain **reference only**.

### Dirty / excluded working tree (unchanged)

Billing E, UI WIP, logs, `data/`, audit WIP — see `docs/SPRINT_P0_5_RELEASE_PREP.md` §exclude. **Not** part of RC `188f187`.

---

## Phase B — Staging readiness (summary)

Full checklist: [`SPRINT_38_STAGING_CHECKLIST.md`](SPRINT_38_STAGING_CHECKLIST.md).  
Runbook: [`STAGING_RUNBOOK_V1.md`](STAGING_RUNBOOK_V1.md).

**Verdict:** Repository **contains** Lite-first staging artifacts; **no** verified HTTPS staging environment exists.

**Operator must supply before first deploy:**

| Prerequisite | Why |
|--------------|-----|
| VPS or VM (2 vCPU, 4 GB RAM, Docker Compose **v2.24+**) | Run stack + `ports: !reset` overlay |
| Public DNS hostname + TLS (Let’s Encrypt or equivalent) | Telegram Mini App requires HTTPS |
| `.env.docker` on server (from `.env.docker.example`) | Postgres, bot tokens, CORS — **never commit** |
| `BOT_TOKEN`, `BOT_API_TOKEN` | BotFather + API auth |
| `MINI_APP_URL` + matching `CORS_ORIGINS` | Same HTTPS origin |
| BotFather: domain allowlist + Menu Button → `MINI_APP_URL` | Mini App entry |
| Reverse proxy to `127.0.0.1:5173` (frontend container) | No public SQLite; no dev Vite on staging |

**Staging must not use:** repo `data/dnd.db`, placeholder tokens from examples, `DB_BOOTSTRAP=create_all`, or published Postgres port on public internet (`docker-compose.staging.yml`).

---

## Phase C–D — UX audit & backlog (summary)

Full prioritized backlog: [`SPRINT_38_UX_BACKLOG.md`](SPRINT_38_UX_BACKLOG.md).

**Method:** Code + component review @ `188f187`; Playwright proves **automation** paths, not Telegram ergonomics.

**Top P1 themes (fix before closed beta):**

1. Onboarding / “what do I do?” — `scenePrompt()` exists but is **not rendered** on Play.  
2. Tools information architecture — no **Dostupná** (available spells) tab; split vs player mental model.  
3. Narrator credits — HTTP 402 routes to Settings; weak in-context recovery on Play.  
4. Telegram BackButton — `quests` not in `MORE_HUB_SCREENS`; back from Quests skips More hub.  

No P0 **data loss** or **auth bypass** identified in static review; persistence and idempotency are tested in CI.

---

## Phase E — Physical Telegram QA

Protocol: [`SPRINT_38_TELEGRAM_QA_PROTOCOL.md`](SPRINT_38_TELEGRAM_QA_PROTOCOL.md).  
**Default status for all scenarios:** **NOT TESTED** until executed on Android/iOS against staging HTTPS.

---

## Next implementation sprint

Proposal: [`SPRINT_38_IMPLEMENTATION_PROPOSAL.md`](SPRINT_38_IMPLEMENTATION_PROPOSAL.md).

---

## Success criterion (product)

> Hráč otevře Doupě Draka a bez vysvětlování vytvoří hrdinu, pochopí situaci, hraje, bojuje, postupuje, ukládá příběh a chce se vrátit.

| Dimension | RC `188f187` |
|-----------|----------------|
| Technical solo loop (engine + CI) | **Strong** — automated gates green |
| Understandability without guide | **Gap** — P1 UX backlog |
| Play on real Telegram | **Unproven** — staging + device QA pending |
| “Want to return” | **Unknown** — needs player playtest |

**Release candidate (engineering):** `188f187` on `clean-main`.  
**Alpha player-ready:** **not yet** — staging deploy + physical QA + P1 UX sprint required.
