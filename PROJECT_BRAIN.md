# PROJECT_BRAIN.md - Solo D&D 5e

> Current source of truth. Code is authoritative; update this summary when behavior changes.

- **Repository:** `D:\DoupeDraka`
- **Development branch:** `clean-main` (merge to `main` after green CI only)
- **Last updated:** 2026-11-08
- **Verified baseline:** backend **223 passed**; frontend **18 passed** Vitest; E2E via `npm run test:e2e`; CI includes Postgres concurrency job on push to `clean-main`.
- **External verification:** real Telegram visual QA and Docker/Postgres in production-like deploy remain **UNVERIFIED** by the maintainer.

## 1. Directives

- Act as lead developer; be concise, use evidence, and never claim unverified work is complete.
- Preserve deterministic engine ownership of mechanics. LLM is a prose narrator only.
- New persisted fields need defaults for old payloads; update every affected client and test.
- Prefer surgical changes and existing patterns. Run relevant backend/frontend/E2E checks.
- Do not enable payments or expose credentials as part of routine development.

## 2. Product and invariants

Solo D&D 5e is a Telegram Mini App with an English default UI and Czech localization without diacritics. Players create a hero, explore, fight, cast supported spells, rest, and progress. **Chapter one** is a six-location vertical slice with quest gating into the vault and Bell Warden finale; it is a playable MVP, not a complete SRD rules implementation.

`app/engine/` owns dice, HP, XP, spell slots, encounters, location transitions, quest flags, ActionIntent routing, and costs. It has no database, Telegram, or LLM calls. The API persists engine outcomes and journal events before streaming narration. Invalid/no-op actions do not spend Adventure Mana.

Do not conflate resources:
- `spell_slots`: class-based casting capacity;
- `CharacterState.mana`: legacy character field, not used to cast;
- `users.energy_tenths`: Adventure Mana, integer tenths;
- `gold`: in-world currency without a spending mechanic.

## 3. Current implementation

- Python/FastAPI async backend, SQLAlchemy, SQLite development DB, Alembic; PostgreSQL URL support and CI migration job on `clean-main`.
- React 18/Vite Telegram Mini App: Adventure, Map, Character, Quests, Journal, Settings, Tools.
- Version fence and idempotency receipts protect turns; SSE narrates after commit with offline fallback.
- Narration: `app/narrator.py` + `app/ai/` (Ollama when configured). **Pro tier is disabled** in API/UI until an OpenRouter adapter exists.
- Lite narration is free; new accounts start with 100.0 Adventure Mana. No payment gateway is connected.
- Spell MVP supports 8 caster classes, cantrips, selected level-1/2 effects, rest recovery, and bounded level progression.
- Six engine-owned locations, travel gating for vault/pit, bell quest with persistent `bell_acquired`, Bell Warden boss flag `chapter_one_complete`.
- Historical patch scripts are preserved under `tools/archive/` and are not maintained utilities.

## 4. Current priorities

1. Green CI on `clean-main`, then merge policy to `main` when ready.
2. Real Telegram visual QA on a phone; Docker compose smoke with `alembic upgrade head`.
3. Campaign depth after chapter one: general NPC dialogue, longer routes, balance (30+ minutes).
4. OpenRouter provider and re-enable Pro tier only with a real adapter.
5. Payments, multiplayer, and Redis remain deferred.

See [ROADMAP.md](./ROADMAP.md) for statuses and [CHANGELOG.md](./CHANGELOG.md) for session history.

## 5. Documentation map

- [DECISIONS.md](./DECISIONS.md) - D1-D27.
- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) - runtime, boundaries, transaction flow.
- [docs/ENGINE.md](./docs/ENGINE.md) - game rules and modeled limits.
- [docs/CONTENT.md](./docs/CONTENT.md) - location/campaign content.
- [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) - local, Telegram, database, Docker, CI.
- [README.md](./README.md) - player-facing scope and quickstart.
