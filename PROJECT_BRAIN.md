# PROJECT_BRAIN.md - Solo D&D 5e

> Current source of truth. Code is authoritative; update this summary when behavior changes.

- **Repository:** `D:\DoupeDraka`
- **Last updated:** 2026-11-07
- **Verified baseline:** backend **206 passed, 186 warnings**; frontend **15 passed**; E2E **2 passed**; frontend production build and `npx tsc --noEmit` passed.
- **External verification:** real Telegram visual QA, Docker runtime, and PostgreSQL runtime are **UNVERIFIED**.

## 1. Directives

- Act as lead developer; be concise, use evidence, and never claim unverified work is complete.
- Preserve deterministic engine ownership of mechanics. LLM is a prose narrator only.
- New persisted fields need defaults for old payloads; update every affected client and test.
- Prefer surgical changes and existing patterns. Run relevant backend/frontend/E2E checks.
- Do not enable payments or expose credentials as part of routine development.

## 2. Product and invariants

Solo D&D 5e is a Telegram Mini App with an English default UI and Czech localization without diacritics. Players create a hero, explore, fight, cast supported spells, rest, and progress. The current connected campaign spans four locations; it is a playable MVP, not a complete SRD rules implementation.

`app/engine/` owns dice, HP, XP, spell slots, encounters, location transitions, and costs. It has no database, Telegram, or LLM calls. The API persists engine outcomes and journal events before streaming narration. Invalid/no-op actions do not spend Adventure Mana.

Do not conflate resources:
- `spell_slots`: class-based casting capacity;
- `CharacterState.mana`: legacy character field, not used to cast;
- `users.energy_tenths`: Adventure Mana, integer tenths;
- `gold`: in-world currency without a spending mechanic.

## 3. Current implementation

- Python/FastAPI async backend, SQLAlchemy, SQLite development DB, Alembic; PostgreSQL URL support is present but unverified against a live service.
- React 18/Vite Telegram Mini App with Home, Tools, Character, Campaign, and Settings.
- Version fence and idempotency receipts protect turns; SSE narrates after commit with offline fallback.
- Narration prompts are orchestrated in `app/narrator.py`; provider protocol, Ollama
  adapter, offline fallback, and registry live in `app/ai/`.
- Lite narration is free; new accounts start with 100.0 Adventure Mana. Paid tiers have flat prices; no payment gateway is connected.
- Spell MVP supports 8 caster classes, cantrips, selected level-1/2 effects, rest recovery, and bounded level progression. Unmodeled spell effects consume no slot.
- Four engine-owned locations, constrained travel, per-location encounter/discovery data, and first-visit NPC beats; one bounded bell quest persists and grants XP/gold exactly once. There is no general NPC dialogue, shop, or branching quest system.
- Historical patch scripts are preserved under `tools/archive/` and are not maintained utilities.

## 4. Current priorities

1. Real Telegram visual QA, then Docker and PostgreSQL verification when those services are available.
2. Extend the campaign beyond the first four locations with more NPC choices and encounters.
3. Add another narration provider only after provider selection, costs, and privacy are reviewed.
4. Keep payments deferred until separately approved.

See [ROADMAP.md](./ROADMAP.md) for statuses and [CHANGELOG.md](./CHANGELOG.md) for session history.

## 5. Documentation map

- [DECISIONS.md](./DECISIONS.md) - D1-D27.
- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) - runtime, boundaries, transaction flow.
- [docs/ENGINE.md](./docs/ENGINE.md) - game rules and modeled limits.
- [docs/CONTENT.md](./docs/CONTENT.md) - location/campaign content.
- [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) - local, Telegram, database, Docker setup.
- [README.md](./README.md) - player-facing scope and quickstart.
