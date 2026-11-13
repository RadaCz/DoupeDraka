# PROJECT_BRAIN.md - Solo D&D 5e

> Current source of truth. Code is authoritative; update this summary when behavior changes.

- **Repository:** [RadaCz/DoupeDraka](https://github.com/RadaCz/DoupeDraka) (`D:\DoupeDraka`)
- **Development branch:** `clean-main` (merge to `main` after green CI only)
- **Last updated:** 2026-11-13 (repo audit + Sprint 39 sync — see [`docs/REPO_STATUS_CURRENT.md`](docs/REPO_STATUS_CURRENT.md))
- **HEAD (remote `clean-main`):** `91a9ac1c509190d5056dd43cf52f7cf55644dd59` — Sprint 39.2 auth/navigation; staging HTTPS **NOT DEPLOYED**.
- **CI (remote baseline):** GitHub Actions run **#91** @ `91a9ac1` — **5/5 SUCCESS** (new local commits require a fresh CI run).
- **Active branch:** `clean-main` (not `main`). Merge to `main` only after explicit release approval.
- **Staging:** **NOT DEPLOYED** — [`docs/SPRINT_38_STAGING_CHECKLIST.md`](docs/SPRINT_38_STAGING_CHECKLIST.md), [`docs/STAGING_RUNBOOK_V1.md`](docs/STAGING_RUNBOOK_V1.md).
- **Fyzické QA:** Android / iOS **NOT TESTED** — [`docs/SPRINT_38_TELEGRAM_QA_PROTOCOL.md`](docs/SPRINT_38_TELEGRAM_QA_PROTOCOL.md).
- **Billing Sprint 37.4 / Alembic v006:** **deferred** (working tree only; not on `HEAD`).
- **Normal paid narration (debit/refund):** **NOT TESTED** bez provozního providera na stagingu.
- **External verification:** real Telegram visual QA and Docker/Postgres in production-like deploy remain **UNVERIFIED** by the maintainer.

## 1. Directives

- Act as lead developer; be concise, use evidence, and never claim unverified work is complete.
- Preserve deterministic engine ownership of mechanics. LLM is a prose narrator only.
- New persisted fields need defaults for old payloads; update every affected client and test.
- Prefer surgical changes and existing patterns. Run relevant backend/frontend/E2E checks.
- Do not enable payments or expose credentials as part of routine development.

## 2. Product and invariants

Solo D&D 5e is a Telegram Mini App with an English default UI and Czech UI **with diacritics** (`i18n.tsx` + `applyCzechDiacritics` backfill for legacy keys). Presentation catalog: `localization/chapter_one_display.json`. Players create a hero through **Character Creation V2** (9-step wizard or quick/preset paths using the same engine rules): MVP **four races** and **four classes**, six SRD backgrounds, standard array, class/background skills, equipment packages, cleric/wizard spell picks, narrative personality fields. **Chapter one** has **six main** locations (bell quest → vault → Bell Warden) plus **three optional** sites — nine nodes on the map. Other SRD races/classes remain reference-only in `/reference`.

`app/engine/` owns dice, HP, XP, spell slots, encounters, location transitions, quest flags, ActionIntent routing, and costs. It has no database, Telegram, or LLM calls. The API persists engine outcomes and journal events before streaming narration. Invalid/no-op actions do not spend **narrator credits** (⚡).

Do not conflate resources:
- `spell_slots`: class-based casting capacity;
- `CharacterState.mana`: legacy character field, not used to cast;
- `users.energy_tenths`: narrator credits (⚡), integer tenths — optional narration quality, not spell slots or pay-to-win;
- `gold`: in-world currency; **Nib shop** (healing potion, shortsword +1) spends gold via engine shop intents — no real-money payments.

## 3. Current implementation

- Python/FastAPI async backend, SQLAlchemy, SQLite development DB, Alembic; PostgreSQL URL support and CI migration job on `clean-main`.
- React 18/Vite Telegram Mini App: Adventure, Map, Character, Quests, Journal, Settings, Tools. Character inventory supports grouped items, equip (engine `EQUIP` intent), and healing potion use via the same `/actions` pipeline as combat chips. Telegram chrome: single MainButton handler, `themeChanged`/`viewportChanged`, error panel retry vs dismiss.
- Version fence and idempotency receipts protect turns; SSE narrates after commit with offline fallback.
- Narration: `app/narrator.py` + `app/ai/` (Ollama when configured). **Pro tier is disabled** in API/UI until an OpenRouter adapter exists.
- **Lite** narration is free and uses the offline narrator only (no paid external API). **Normal** requires a configured external provider and debits ⚡ only when paid narration lands. New accounts start with 100.0 ⚡. No payment gateway is connected. **E3** (dice v1.1, `explore_track`) is **paused** — not in the engine.
- Spell MVP supports 8 caster classes, cantrips, selected level-1/2 effects, rest recovery, and bounded level progression.
- Six engine-owned locations, travel gating for vault/pit, bell quest with persistent `bell_acquired`, Bell Warden boss flag `chapter_one_complete`. Quest intents require explicit player commands to Caldus/Nib.
- Historical patch scripts are preserved under `tools/archive/` and are not maintained utilities.

## 4. Current priorities

1. **Staging deploy** (Postgres, Alembic head, HTTPS `MINI_APP_URL`, CORS) — viz `docs/STAGING_DEVICE_VALIDATION_V1.md`.
2. **Fyzické QA** Android + iOS proti staging URL (`docs/TELEGRAM_MOBILE_QA_V1.md`).
3. Closed beta playtest (10–15 players, Czech UI, Lite default) po staging + fyzickém PASS.
4. Veřejný staging deploy s `docker-compose.staging.yml` (loopback frontend) — **NOT DEPLOYED**.
5. Merge `clean-main` → `main` when ready (CI green on `188f187` + staging + device QA).
6. Campaign depth after chapter one: general NPC dialogue, longer routes, balance (30+ minutes).
7. OpenRouter provider and re-enable Pro tier only with a real adapter (**Pro NOT AVAILABLE** in API/UI today).
8. Real-money payments **NOT ENABLED**; multiplayer and Redis remain deferred.

See [ROADMAP.md](./ROADMAP.md) for statuses, [docs/MASTER_PLAN_STATUS.md](./docs/MASTER_PLAN_STATUS.md) for master-plan etapy, [docs/SPRINT_38_RELEASE_CANDIDATE_STATUS.md](./docs/SPRINT_38_RELEASE_CANDIDATE_STATUS.md) for Alpha RC truth, and [CHANGELOG.md](./CHANGELOG.md) for session history.

## 5. Documentation map

- [DECISIONS.md](./DECISIONS.md) - D1-D27.
- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) - runtime, boundaries, transaction flow.
- [docs/ENGINE.md](./docs/ENGINE.md) - game rules and modeled limits.
- [docs/CONTENT.md](./docs/CONTENT.md) - location/campaign content.
- [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) - local, Telegram, database, Docker, CI.
- [README.md](./README.md) - player-facing scope and quickstart.
