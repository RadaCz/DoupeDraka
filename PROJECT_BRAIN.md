# PROJECT_BRAIN.md - Solo D&D 5e

> Current source of truth. Code is authoritative; update this summary when behavior changes.

- **Repository:** `D:\DoupeDraka`
- **Development branch:** `clean-main` (merge to `main` after green CI only)
- **Last updated:** 2026-11-10 (Localization Integrity V3 / V3.1 — `f8ce5b1` na `clean-main`)
- **CI lifecycle baseline:** `ec646fc` · Actions `42679663584` (4/4 SUCCESS).
- **Narrator V2 P3:** commit `b7f1315` na `clean-main` (push proveden).
- **HEAD (2026-11-10):** `0112747` — Sprinty 3–5 v kódu; CI run `42806386764` zelené. **Telefonní playtest** stále **NOT TESTED** (viz `docs/TELEGRAM_MOBILE_QA_V1.md`, `docs/CLOSED_BETA_ONBOARDING_V1.md`).
- **External verification:** real Telegram visual QA and Docker/Postgres in production-like deploy remain **UNVERIFIED** by the maintainer.

## 1. Directives

- Act as lead developer; be concise, use evidence, and never claim unverified work is complete.
- Preserve deterministic engine ownership of mechanics. LLM is a prose narrator only.
- New persisted fields need defaults for old payloads; update every affected client and test.
- Prefer surgical changes and existing patterns. Run relevant backend/frontend/E2E checks.
- Do not enable payments or expose credentials as part of routine development.

## 2. Product and invariants

Solo D&D 5e is a Telegram Mini App with an English default UI and Czech UI **with diacritics** (`i18n.tsx` + `applyCzechDiacritics` backfill for legacy keys). Presentation catalog: `localization/chapter_one_display.json`. Players create a hero, explore, fight, cast supported spells, rest, and progress. **Chapter one** has **six main** locations (bell quest → vault → Bell Warden) plus **three optional** sites (Forgotten Crypt, Bandit Camp, Underground River) — nine nodes on the map. **Ruleset v1** supports **four races** (Human, Elf, Dwarf, Halfling) and **four classes** (Fighter, Rogue, Cleric, Wizard); other SRD entries are reference-only.

`app/engine/` owns dice, HP, XP, spell slots, encounters, location transitions, quest flags, ActionIntent routing, and costs. It has no database, Telegram, or LLM calls. The API persists engine outcomes and journal events before streaming narration. Invalid/no-op actions do not spend **narrator credits** (⚡).

Do not conflate resources:
- `spell_slots`: class-based casting capacity;
- `CharacterState.mana`: legacy character field, not used to cast;
- `users.energy_tenths`: narrator credits (⚡), integer tenths — optional narration quality, not spell slots or pay-to-win;
- `gold`: in-world currency without a spending mechanic.

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

1. **Immersion sprint (local):** fourth-wall free offline/paid prompts; combat prose; mobile safe-area/nav/composer tweaks — phone QA still pending.
2. Closed beta playtest (10–15 players, Czech UI, Lite default) after audit commit + green CI.
2. Green CI on `clean-main` (including Postgres **v005**), then merge to `main` when ready.
3. Real Telegram visual QA on a phone; Docker compose smoke with `alembic upgrade head`.
3. Campaign depth after chapter one: general NPC dialogue, longer routes, balance (30+ minutes).
4. OpenRouter provider and re-enable Pro tier only with a real adapter.
5. Payments, multiplayer, and Redis remain deferred.

See [ROADMAP.md](./ROADMAP.md) for statuses, [docs/MASTER_PLAN_STATUS.md](./docs/MASTER_PLAN_STATUS.md) for master-plan etapy, and [CHANGELOG.md](./CHANGELOG.md) for session history.

## 5. Documentation map

- [DECISIONS.md](./DECISIONS.md) - D1-D27.
- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) - runtime, boundaries, transaction flow.
- [docs/ENGINE.md](./docs/ENGINE.md) - game rules and modeled limits.
- [docs/CONTENT.md](./docs/CONTENT.md) - location/campaign content.
- [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) - local, Telegram, database, Docker, CI.
- [README.md](./README.md) - player-facing scope and quickstart.
