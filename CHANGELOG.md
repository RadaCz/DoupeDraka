# Changelog

## Unreleased (2026-11-08)

### Chapter one stabilization
- ActionIntent: `rejected`, `shop`, `use_item`, and `quest` routing; per-clause CS/EN negation; no substring shop/quest triggers.
- PostgreSQL CI uses matching `DATABASE_URL` and `PYTEST_DATABASE_URL`, `alembic check`, and skips `create_all` when pytest uses Postgres.
- Removed duplicate `CAMPAIGN` key in `frontend/src/i18n.tsx`.

### Chapter one etapa
- ActionIntent exclusively routes combat, spells, travel, talk, and checks (CS/EN negation; ambiguous commands clarified).
- Ability checks follow DC totals; weapon proficiency respects class lists in `reference.CLASS_SPECS`.
- Vault and Bell Warden routes gated on `vault_unlocked`; `bell_acquired` persists through delivery; Map/Quest UI updated.
- Pro narrator tier disabled in API and UI until an OpenRouter adapter ships.
- CI runs on `clean-main`, PostgreSQL `alembic upgrade`, and Playwright E2E.

### P0 stability
- Concurrent idempotency replay after version conflicts; atomic adventure-mana debits; frontend pending idempotency keys.

### Gameplay
- Ruleset v1: weapon damage dice, proficiency, initiative on combat start, item instances.
- Chapter one extended to six locations with Vault of Echoes, Bell Warden boss, and quest finale flags.
- ActionIntent parser with negation guardrails; narration language persisted on character (`en`/`cs`).

### Platform
- `/ready` health check, Mini App bot launcher, GitHub Actions CI, economy API hides unpaid Pro tier without OpenRouter.

Historical session records moved from `PROJECT_BRAIN.md` to keep the project brain concise.

### 6.5 Session 2026-11-06 — audit repair, STEP 0 and STEP 1.0

> Added by the repair session. Everything below was **executed and observed**, not inferred.
> Where a claim is unverified it says so.

**Test baseline corrected: `99` → `127 passed`.**

| Item | Result | Evidence |
|---|---|---|
| Test count | **127 passed**, 80 warnings, ~11s | `python -m pytest -q` |
| Passed with no `PYTHONPATH` | yes, from repo root, from `C:\`, and from `tests\` | 3 separate runs |
| `pytest.ini` | **created** — was entirely absent | 6 lines, `pythonpath = .` + `testpaths = tests` |
| Repo snapshot | **committed** `633409f` | 36 previously untracked/modified entries captured |
| `PROJECT_BRAIN.md` | this update | sections 6, 7, 9 |

**Correction to section 6.3:** `initData` HMAC auth is **implemented**, not "not started" —
`app/auth/telegram.py` verifies the HMAC and `POST /auth/telegram` exists, with tests.
What is missing is the *frontend* calling it (`frontend/src/App.tsx` still posts
username/password and reads a token from `localStorage`). The doc and the customer's
audit both overstated this; the code was ahead of the document.

**Correction to the audit's `BOT_API_TOKEN` claim:** the shared token makes the bot a
single API *client*, but the character owner is resolved from the Telegram user id, not
from the token. Multi-player identity is therefore **not** broken by the token itself;
the real gap is the frontend never presenting `initData`.

**Environment risk (unresolved):** the repo's `.venv` has **no pytest**. Tests currently
run against an unrelated interpreter (`D:\voice-pro-main\...\installer_files\python`,
3.12.13). A reproducible environment is therefore **not** yet established — this is
STEP 0 work still outstanding, and it is why STEP 1 must not be reported as verified
against a clean venv.

---

### 6.6 STEP 0 complete - reproducible test environment (2026-11-06)

> Appended by the STEP 0 pass. Every line below was executed on this machine and observed.

**Root cause:** the repo's `.venv` existed but contained no `pytest`, and `requirements.txt`
did not list it. So `python -m pytest -q` was silently resolving to an unrelated global
interpreter, and the "127 passed" baseline could not be reproduced from the project itself.

| Item | Result | Evidence |
|---|---|---|
| `.venv` interpreter | `D:/DoupeDraka/.venv/Scripts/python.exe`, Python 3.12.13 | `python --version` |
| PATH interpreter before fix | `D:/voice-pro-main/.../installer_files/env/Scripts/python.exe` | `(Get-Command python).Source` |
| App deps | installed from `requirements.txt`, exit 0, all already satisfied | `pip install -r requirements.txt` |
| Test deps added | `pytest 9.2.0`, `pytest-asyncio 1.4.1.post1` | `pip list` |
| `bcrypt` | 4.3.0 present in the project venv | `pip list` |
| Suite in project venv | **127 passed**, 81 warnings, 29.51s | `.venv/Scripts/python.exe -m pytest -q` |
| Source files changed | none - no app, test or dependency change was needed | `git status` |
| `.gitignore` | already ignores `.venv/`, `data/*.db`, `.pytest_cache/` | file read |

**What this means for the baseline:** the 127 number was correct, but it was being measured on a
foreign interpreter. It now reproduces from `D:/DoupeDraka` against the project's own venv, which
is what STEP 0 demanded.

**Deliberately not versioned:** `pytest` and `pytest-asyncio` are installed but not added to
`requirements.txt`. Adding them changes a shipped dependency file; that is a decision for the
owner, not a side effect of this pass.

**Warnings unchanged and out of scope:** 81 warnings, `datetime.utcnow()` (SQLAlchemy) and
FastAPI `on_event`. Not fixed here.

**STEP 0 is complete.** STEP 1 (atomic character turns) is complete as well - see 6.7.

### 6.7 STEP 1 complete - atomic character turns (2026-11-06)

**Result: 130 passed** (127 existing + 3 new), in `D:/DoupeDraka/.venv/Scripts/python.exe`.
Additive change; the four touched modules kept their public shape and no existing test was
edited or weakened.

**What the code actually did before this pass** (read, not assumed):

| Claim in the audit | What was really there |
|---|---|
| shared `BOT_API_TOKEN` breaks player identity | ownership comes from `owner_id` on the character; the token authenticates the *bot*, not the player. No identity defect. |
| concurrent turns clobber each other | confirmed. The route read a character, resolved, charged energy and committed with no version guard, so two in-flight turns both wrote and the later commit won. |
| narration placement | confirmed wrong. `narrator.narrate()` was awaited *before* `commit()`, holding the session open across an HTTP call with a 45 s timeout. |
| energy scope | per **user** (`User.energy_tenths`), not per character. Confirmed. |

**Mechanism, in the order the route now runs it:**

1. `Idempotency-Key` request header (optional). A receipt for that key returns the stored
   response; nothing is re-rolled or re-charged.
2. Read the character, record `base_version`.
3. Resolve the turn with the engine - pure, no I/O.
4. Claim the row: `UPDATE characters SET payload=..., version=v+1 WHERE id=? AND owner_id=?
   AND version=v`. A concurrent turn that already moved the version makes `rowcount = 0`, so
   this attempt writes nothing, charges nothing, and retries (max 3, then `409`).
5. In the winning transaction: state, `events` row, `energy_transactions` row and the
   `action_receipts` row commit together.
6. **After** the commit, narrate. A narrator failure returns `200` with
   `narration_status: "fallback"` and deterministic prose - it never rolls back a decided turn.
   On success the event row and stored receipt are updated and the status becomes `"narrated"`.

**Why optimistic versioning and not `SELECT ... FOR UPDATE`:** SQLite has no row lock, so a
pessimistic design behaves one way in development and another on PostgreSQL - the tests would
prove something the production path does not do. The version fence is identical on both. A
Postgres-only `FOR UPDATE` stays a valid optimisation *behind the same contract*.

**Schema additions (backward compatible):**
- `characters.version` - `INTEGER NOT NULL DEFAULT 0`, added in place on startup by
  `_migrate_character_version()` via `ALTER TABLE` for SQLite, because `create_all` never adds
  a column to an existing table and dropping it would take the player's characters with it.
  Verified on the live `data/dnd.db`: column present next to existing rows.
- `action_receipts` - `key` (pk), `owner_id`, `character_id`, `status`
  (`committed` / `complete`), `response`, `created_at`.
- `ActionResponse.narration_status` - defaults to `"narrated"`, so older clients are unaffected.

**Files changed:** `git diff --stat` -> `app/api.py` 223, `app/db.py` 35, `app/narrator.py` 16,
`app/schemas.py` 4; combined **+236 / -42**. Plus new `tests/test_concurrency.py` and
`tools/step1_patch.py` (the patcher that applies the changes; keeps the edit reproducible).

**Tests added (`tests/test_concurrency.py`):**
1. `test_repeated_idempotency_key_charges_once` - a repeated key replays the turn: one event,
   one receipt, one version bump, identical balance.
2. `test_stale_version_cannot_overwrite_character` - two sessions read one version; the second
   guarded write matches 0 rows and the payload stays intact. This pins the mechanism itself.
3. `test_narration_failure_keeps_the_committed_turn` - narrator raises; response is `200`,
   status `fallback`, and both the event row and the version bump are durable.

**Honest limits of this pass:**
- Test 2 asserts the *fence*, not two real HTTP requests racing. A genuine race on SQLite is
  timing-dependent and would flake in CI; the fence is the invariant that makes the race safe,
  so that is what is pinned. A load test against PostgreSQL is still owed in STEP 2.
- Dice are not seeded per request, so a retry after a version conflict re-rolls. Correct (the
  first attempt never committed) but not reproducible when debugging.
- `update_settings` now takes the same fence but raises `409` instead of retrying, so a player
  editing settings mid-turn can be asked to retry.
- Warnings rose 81 -> 102; still `datetime.utcnow()` and FastAPI `on_event`, untouched.

### 6.8 Session 2026-11-06 (2) - verified baseline correction

> Historical checkpoint. Catalog, receipt, auth, deployment and migration status below
> describes that session only; see sections 6.1–6.3 and 6.11 for current status.

> Every statement in this block was read from the files or produced by a command in

> this session. Nothing here is inferred from the earlier blocks above.

**What the code actually does now (STEP 1 is committed, not pending)**

`app/api.py`, character-turn route `POST /characters/{character_id}/actions`

(`api.py:378-479`) - optimistic version fence, quoted verbatim:

```

  407:     for _ in range(MAX_TURN_ATTEMPTS):

  ...

  414:             base_version = record.version

  ...

  433:             claimed = await session.execute(

  434:                 update(CharacterRecord)

  435:                 .where(

  436:                     CharacterRecord.id == character_id,

  437:                     CharacterRecord.owner_id == user.id,

  438:                     CharacterRecord.version == base_version,

  439:                 )

  ...

  447:             if claimed.rowcount != 1:

  450:                 await session.rollback()

  451:                 logger.warning(f"Version conflict on character {character_id} at v{base_version}; retrying")

  453:                 continue

```

Commit order - the engine resolves, the row is claimed, the reply is built, the receipt nis written, `commit()` runs at `api.py:475`, and only then does narration start:

```

  471:                 session.add(ActionReceipt(

  475:             await session.commit()

  ...

  477:         response.narration, response.narration_status = await narrate_committed(context, event_id, key, fallback)

```

So `narrate()` is awaited **AFTER commit()`. Narration failures are caught inside

`narrate_committed` (`api.py:314-327`) and fall back to the offline prose, so a dead

provider cannot cost the player a turn.

`MAX_TURN_ATTEMPTS = 3` (`api.py:289`). The `characters` table really has the column:

`PRAGMA table_info(characters)` on `data\\dnd.db` returns

`['id', 'owner_id', 'payload', 'updated_at', 'version']`.

**Idempotency - code vs. the design note**

`IDEMPOTENCY_HEADER = "Idempotency-Key"`, `IDEMPOTENCY_KEY_LIMIT = 64` (`api.py:287-288`).

`replay_receipt()` (`api.py:301-311`) looks the key up and returns the stored response;

a key owned by another account returns `409`. The receipt is written in the same commit

as the turn (`api.py:470-475`).

**There is no 24h expiry in the code.** `ActionReceipt` (`app/db.py:46-59`) carries

`created_at`, and no TTL, sweep or `expires_at` exists anywhere in `app/`

(grep for `expires|TTL|purge` returns nothing in `app/db.py`). Receipts therefore live

forever today. The 24h window is a **decision, not an implementation**.

**Verified test baseline**

```

130 passed, 102 warnings in 34.23s

EXIT_CODE=0

```

Command: `.venv\Scripts\python.exe -m pytest -q` from `D:\\DoupeDraka`.

Collected: 130 (`--collect-only -q`). Per file:

`test_engine.py 29`, `test_systems.py 38`, `test_api_systems.py 21`,

`test_telegram_auth.py 26`, `test_auth.py 7`, `test_integration.py 6`,

`test_concurrency.py 3` - 7 test files.

The earlier blocks in this document claim **127**; that number was correct before

commit `0661d5c` added `tests/test_concurrency.py` (3 tests). 127 + 3 = 130.

**Catalog: what is in `app/engine/reference.py` today**

Measured by importing the module, not by reading prose:

`SPELLS` = **10** entries; `CLASS_SPECS` = **12** classes; `RACE_SPECS` = **9** species

(human, elf, dwarf, halfling, dragonborn, gnome, half_elf, half_orc, tiefling).

Subclasses per class as the data stands: barbarian 2, bard 2, cleric 3, druid 2,

fighter 2, ranger 2, rogue 3, warlock 3, paladin 3, monk 3, sorcerer 2, wizard 3 -

I.e. **1-2 subclasses each, not one**.

There is **no feat** and **no background** record anywhere in `app/` (grep `feat|background`).

So the SRD target below is a target: the shipped numbers are 10 spells, 12 classes,

9 species, 0 feats, 0 backgrounds.

**SRD 5.1-only decision (unchanged, restated for the record)**

The playable catalog is **SRD 5.1 only**, published under **Creative Commons

Attribution 4.0**. That license grant is **irrevocable** and **permits commercial use**

with attribution. Consequences that follow from it and are binding here:

**no PHB content** (PHB subclasses, PHB spell lists, PHB art) and **no Product

Identity names** ever ship. The SRD target catalogue is 12 classes, 1 subclass each,

9 species, 319 spells, 1 feat, 1 background - the code is not there yet (see above).

License position was decided 2026-11-06; the exact section 7 wording is quoted at the

bottom of this file.

**Concurrency design decision of record**

- Optimistic concurrency on a monotonic `version` integer per character row.

- **SQLite has no row-level `FOR UPDATE`**, so locking is not an option here; the fence

  is a conditional `UPDATE ... WHERE version = :base` with a `rowcount != 1` retry

  (bounded by `MAX_TURN_ATTEMPTS = 3`).

- **Commit before narrate.** The durable turn lands first; the model only chooses wording

  afterwards. A slow or unreachable provider can neither roll back a decided turn nor

  hold the transaction open.

- **Idempotency receipts** keyed by `Idempotency-Key` (<= 64 chars), written in the same

  commit as the turn. Intended window: **24 hours** - NOT implemented, see above.

**Running state observed this session**

`GET http://127.0.0.1:8000/health` -> `200 {"status":"healthy"}` (an API instance was

already running on the machine). `http://127.0.0.1:5173/` did not answer - the Vite dev

server was not running. Working tree was clean and `main` was at `0661d5c`.

**What is done**

- Engine, character creation, journal, auth (password + Telegram `initData` endpoint),

  economy ledger, rate limiting, Docker files, Alembic scaffolding.

- STEP 1: atomic character turns - `version` column, conditional update, retry, same-commit

  receipt, narration after commit. Commit `0661d5c`, 3 tests in `tests/test_concurrency.py`.

- The suite is green at 130 and runs inside `.venv`.

**What is not done**

- Catalog is far short of the SRD target (10 spells vs 319; 0 feats; 0 backgrounds).

- No receipt expiry - the 24h window is unimplemented.

- No PostgreSQL, no Redis, no real payment gateway, no streaming narration.

- `tools/` still holds one-off patch scripts (`brain_step1.py`, `step1_patch.py`).

- `plan/` and `research/` directories do not exist in the repo.

**Next steps (numbered)**

1. STEP 1 - done and committed at `0661d5c`; covered by `tests/test_concurrency.py`.

2. STEP 2.1 - **Mini App `initData` login: complete.** The frontend calls
   `POST /auth/telegram`; its bearer token remains in memory and is never persisted.

3. STEP 2.2 - **Character restore: complete.** `GET /characters` is ownership-scoped;
   the frontend persists only the active character id and restores it after auth.

4. Implement the 24h idempotency window (an `expires_at` on `action_receipts` and a

   purge), matching the decision recorded above.

5. Grow the catalog to the SRD target (12 classes / 1 subclass each, 9 species,

   319 spells, 1 feat, 1 background) and pin it with tests.

6. Docker: `COPY` of `alembic/`/`logs/`, `5173:80` port map, bot service, `env_file`,

   no production database baked into the image.

7. `slowapi` rate limits on `/auth/*` and `/actions`; CORS clamped to the Mini App origin.

8. Alembic/PostgreSQL architecture; schema versioning on `characters.payload`.

9. `README.md` and this file reconciled with the code.

### 6.9 Session 2026-11-06 (3) — Telegram authentication and character restore

- Replaced the frontend username/password login flow with automatic
  `POST /auth/telegram` authentication using `Telegram.WebApp.initData`.
- Removed the frontend's `localStorage` bearer-token path. The API token is held in
  memory and still authorizes character listing, creation, and actions.
- Added ownership-scoped `GET /characters`, ordered by latest update, and regression
  coverage that confirms accounts cannot list each other's characters.
- The frontend stores only `active_character_id` in `localStorage`; after each Telegram
  login it restores that character, or the most recently updated one if the saved id is
  absent or no longer exists.
- Missing Telegram `initData`, failed authentication, and malformed token responses
  now show explicit errors instead of exposing the game UI.
- Frontend tests: **18 passed** (`npm run test:run`).
- Frontend production build: **passed** (`npm run build`).
- Backend tests: **131 passed, 108 warnings in 36.51s** using
  `.venv\Scripts\python.exe -m pytest -q`.
- Commit: not created; changes remain in the working tree.

### 6.10 Session 2026-11-06 (4) — Docker deployment wiring

- Removed local database/log copies from the API image; runtime data and logs remain
  external volumes, and `.dockerignore` excludes the local database and log files.
- Wired `.env` into API and bot services, added the bot container, and set its internal
  API URL to `http://api:8000`.
- Fixed the frontend's `5173:80` mapping and configured its static build to call `/api`;
  Nginx strips that prefix when proxying to the API. Added a frontend `.dockerignore`.
- Updated README instructions for Telegram WebView authentication, character restore,
  and Docker environment setup.
- `docker-compose.yml` parsed successfully with PyYAML. Docker image build and
  `docker compose up` are **UNVERIFIED** because the Docker CLI is not installed here.
- Frontend tests: **18 passed**; frontend production build passed.
- Backend tests remain at the latest verified **131 passed, 108 warnings**; no backend
  code changed after that run.
- Commit: not created; changes remain in the working tree.

### 6.11 Session 2026-11-06 (5) — SRD catalog and attribution

- Replaced the sample spell list with **319 unique SRD 5.1 CC BY 4.0 spell entries**,
  including level, school, range and concise descriptions. Added exact-count and shape tests.
- Restricted all 12 classes to their single SRD subclass. Added the SRD Grappler feat and
  Acolyte background to `GET /reference`.
- Added the required attribution verbatim to the Mini App footer and README. The app footer
  is present on authentication, character creation and gameplay screens.
- The user-provided `SRD 5.1.pdf` is an older OGL 1.0a edition; it was used only to
  cross-check spell names. Catalog data was extracted from the official CC BY 4.0 PDF.
- Backend tests: **137 passed, 137 warnings in 54.80s**. Frontend tests: **18 passed**;
  `npm run build` passed.
- Alembic head: `v001`; a fresh SQLite migration and the receipt-expiry/character-version
  columns were verified. Docker runtime and live PostgreSQL integration remain **UNVERIFIED**
  because the required services are unavailable in this environment.
- Commit: not created; changes remain in the working tree.

### 6.12 Session 2026-11-06 (6) — local Mini App testing

- Unified frontend API calls under `/api`; Vite rewrites and proxies this path to the
  local API, matching the existing Nginx production route.
- This lets a single HTTPS tunnel expose the Vite dev server to Telegram while API calls
  still reach the API on the developer's PC. Browser-only access intentionally remains
  blocked at Telegram authentication.
- README now documents local browser preview, Telegram BotFather menu setup, tunnel
  precautions, and the two local server processes.
- Verified `GET /api/health` through the Vite proxy against a temporary SQLite-backed API:
  `200 {"status":"healthy"}`. Frontend tests: **18 passed**; production build passed.
- Docker and PostgreSQL are not required for this local development flow.
- Commit: not created; changes remain in the working tree.

### 6.13 Session 2026-11-06 (7) — ngrok host allowlist

- Vite now loads a developer-configured exact `NGROK_HOST` and adds only that hostname
  to `server.allowedHosts`; arbitrary public Host headers remain rejected.
- `frontend/.env.example` and README explain setting the current ngrok hostname without
  scheme or path, then restarting Vite.
- Runtime verified: configured ngrok hostname returns HTTP 200; an unlisted hostname
  returns HTTP 403. Frontend tests: **18 passed**; production build passed.
- Docker and PostgreSQL are not required.
- Commit: not created; changes remain in the working tree.

### 6.14 Session 2026-11-06 (8) — Telegram Mini App mobile polish

- Reworked the create-character form for narrow screens with properly associated,
  accessible labels and consistent full-width controls.
- The game now fits Telegram's dynamic viewport: the character HUD and action composer
  remain visible while the journal scrolls independently; a live status is shown while
  narration is pending. SRD attribution stays available in a compact disclosure.
- Removed previous narration from offline fallback prose. Previously that prose was
  stored as history and embedded in the next fallback, causing each turn to repeat and
  grow all prior narration. Added a regression test for non-recursive narration.
- Verified at 390x640 in a browser preview: no horizontal overflow; create button,
  action composer and attribution fit on screen. Frontend tests: **19 passed**; build
  passed; narrator regression test passed.
- Docker and PostgreSQL are not required for this work.
- Commit: not created; changes remain in the working tree.

### 6.15 Session 2026-11-06 (9) — Mini App experience and saved journal

- Replaced the sparse entry screen with the five-tab Home, Tools, Character, Campaign
  and Settings experience. Added preset/custom character onboarding, the in-game journal,
  character sheet and roster, campaign settings, spell search, encounter planner and model
  tier controls.
- Added ownership-checked `GET /characters/{id}/events`; journal rows now retain both
  narration and resolved engine facts. The frontend restores saved events on login and
  character switch.
- Subclasses, backgrounds and feats are explicitly reference-only because the engine
  does not yet persist/apply their mechanics. Real purchases are likewise unavailable.
- Backend tests: **139 passed, 154 warnings in 57.60s**. Frontend tests: **9 passed**;
  production build and `npx tsc --noEmit` passed; `git diff --check` passed.
- A normal browser preview cannot pass Telegram sign-in without valid signed `initData`;
  Telegram-client visual QA remains unverified. Docker and PostgreSQL are not required.
- Commit: not created; changes remain in the working tree.

### 6.16 Session 2026-11-06 (10) — spell and reference UX honesty

- Removed the SRD license strip from regular screens and placed the full attribution and
  license links in Settings.
- Renamed narrator settings to focus on story narration quality. Clarified that spell mana
  is reserved and spell effects are not live yet.
- Spell reference now defaults to spells no higher than the character's class/level
  progression; the complete 319-entry SRD catalog requires an explicit switch. It labels
  the catalog as reference-only because per-class lists and prepared spells are not stored.
- Repaired the engine's misleading `cast` behavior: it previously charged character mana
  and claimed a spell worked despite applying no effect. It now reports the limitation,
  changes no game state and spends no mana.
- Renamed encounter planner to Combat balance and clarified it estimates manually selected
  monsters; it is not an in-game/random encounter generator.
- Backend tests: **139 passed, 154 warnings in 43.53s**. Frontend tests: **10 passed**;
  production build, type-check and `git diff --check` passed.
- Commit: not created; changes remain in the working tree.

### 6.17 Session 2026-11-07 (11) — first playable random exploration encounter

- Added dedicated exploration intents (`explore`, `search`, `look around`, `travel` and
  Czech equivalents) to the deterministic engine. Each out-of-combat exploration action
  rolls 1d6; a result of 1 spawns one level-appropriate monster scaled to campaign difficulty.
- A new monster is persisted as the active combatant and does not attack immediately, so the
  player gets a clear turn to choose fight or flee. Exploration cannot bypass active combat.
- Other exploration results can reveal tracks, a hidden-panel clue or 1d4 gold. After combat
  resolves, the next exploration is safe, preventing back-to-back random fights.
- Kept the XP encounter calculator separate and documented the new exploration flow.
- Backend tests: **145 passed, 154 warnings in 44.80s**; frontend tests: **10 passed**;
  production build and TypeScript check passed. `git diff --check` passed.
- Commit: not created; changes remain in the working tree.

### 6.18 Session 2026-11-07 (12) — action-appropriate ability checks
- Routed common action words to relevant D&D abilities: physical force to Strength,
  stealth to Dexterity, endurance to Constitution, inspection to Intelligence, awareness
  to Wisdom and social actions to Charisma. English and accent-free Czech cues are supported.
- Kept a Dexterity fallback for free-text actions without a recognized cue to preserve the
  existing freeform action loop.
- Added a Mini App hint and six ability-mapping regression cases; updated the journal
  integration expectation for inspecting a door.
- Backend tests: **154 passed, 154 warnings in 45.25s**; frontend: **11 passed**;
  build, TypeScript check, diff and no-diacritics checks passed.
- Commit: not created; changes remain in the working tree.

### 6.19 Session 2026-11-07 (13) — first real-browser end-to-end suite
- Added Playwright with isolated FastAPI/SQLite and Vite servers, signed synthetic Telegram
  initData and a full character creation → engine action → reload-and-restore test.
- Added the outside-Telegram auth gate test and documented the install/run commands.
- Real-browser testing exposed simultaneous Telegram sign-in requests during React
  development mounting; API account creation now recovers from a unique-key race by
  reloading the winning Telegram account before issuing the token.
- E2E result: **2 passed** (2026-11-07). Full backend: **154 passed, 154 warnings**;
  frontend: **11 passed**; build and frontend/E2E TypeScript checks passed. A dedicated
  Node runner removes the temporary SQLite database after Playwright has stopped both
  servers; cleanup and port shutdown were verified.
- Commit: not created; changes remain in the working tree.

### 6.20 Session 2026-11-07 (14) — context-aware game screen
- Replaced the always-identical explore/attack/rest chips with choices derived from combat,
  current HP and the latest journal discovery; generated actions use intents supported by
  the deterministic engine.
- Added an active-enemy panel with health and AC, dynamic scene prompts, and collapsible
  rules help so the main game view has more room for the story.
- Added English/Czech-without-diacritics labels and UI tests for combat and clue/injury states.
- Verified: frontend **13 passed**; browser E2E **2 passed**; production build and frontend/E2E
  TypeScript checks passed. No backend code changed in this session.
- Commit: not created; changes remain in the working tree.

### 6.21 Session 2026-11-07 (15) — Spell System MVP
- Added defaulted character spell state with current and maximum slots, known/prepared
  spells, and class spellcasting ability; legacy character payloads still decode.
- Added SRD-catalog-backed cantrip and level-1 lists for bard, cleric, druid, paladin,
  ranger, sorcerer, warlock and wizard. Starting spells are assigned by class; full,
  half and pact slot progressions are tracked independently from `CharacterState.mana`.
- Added `cast <spell> [at target]`, case-insensitive with whitespace normalization,
  spellbook/slot/target validation and structured `spell_facts`. Invalid or unmodeled casts
  leave state unchanged and never consume a slot.
- **Real modeled effects:** Fire Bolt (spell attack), Eldritch Blast (spell attack),
  Sacred Flame (Dexterity save, no damage on success), Vicious Mockery (Wisdom save and
  damage; attack disadvantage is flagged but not applied), Magic Missile (three auto-hit
  darts), Burning Hands (Dexterity save, half damage on success), Cure Wounds (1d8 plus
  spellcasting modifier) and Healing Word (1d4 plus modifier). Healing Word is explicitly
  treated as a main action; bonus-action timing is not modeled.
- **Still unmodeled:** every other spell effect in the 319-spell reference catalog;
  higher-level spell learning and slot recovery through rest are not implemented. An
  unmodeled spell is identified before submission in the Mini App and consumes no slot.
  Save and area effects currently resolve against one active enemy only.
- Added English/Czech-without-diacritics spell picker, level grouping, slot HUD and
  regression coverage; updated README and this source of truth.
- Verified: backend **175 passed, 154 warnings in 52.34s**; frontend **14 passed**;
  production build and `npx tsc --noEmit` passed; browser E2E **2 passed**. CLI smoke
  cast Magic Missile at a Goblin scout: dealt 9 damage, defeated it, and changed slots
  from 2/2 to 1/2. Test warnings are existing dependency/deprecation warnings.
- Commit: not created; changes remain in the working tree.

### 6.22 Session 2026-11-07 (16) — Free Lite turns and streamed narration
- Set Lite to 0.0 ⚡ and the default balance for newly created users to 100.0 ⚡
  (1000 tenths). Existing balances are intentionally not retroactively changed; no-op turns
  remain free.
- Updated Settings and character-sheet copy to distinguish spell slots from Adventure Mana
  and legacy character mana; English and Czech-without-diacritics translations are included.
- Added `POST /characters/{id}/actions/stream` using SSE. The engine turn, ledger charge,
  journal event, and idempotency receipt commit before narrative chunks are sent. Streaming
  uses the same optimistic version fence and idempotency behavior as the JSON action endpoint.
- Added Ollama chunk streaming, offline fallback, incremental journal rendering, recovery
  after a dropped stream, and backend/frontend regression tests.
- Live Ollama stream smoke test succeeded against `llama3.1:latest` (28 chunks observed).
  Manual Telegram/ngrok visual QA remains **UNVERIFIED**.
- Verified: backend **179 passed, 179 warnings in 66.72s**; frontend **14 passed**;
  production build and `npx tsc --noEmit` passed; browser E2E **2 passed**. Ollama was
  reachable locally with `llama3.1:latest`; a Telegram/ngrok visual check remains unverified.
- Commit: not created; changes remain in the working tree.

### 6.23 Session 2026-11-07 (17) — Long rest and level progression
- Implemented long rest outside combat: restore HP to maximum and all spell slots, with
  structured `rest_facts`; full resources are a no-op. Combat rest remains rejected.
- Rest bypasses Adventure Mana affordability and charging, including when the account
  balance is zero. Action responses and narrator context carry rest and level-up facts.
- Level-up advances only one level per resolved turn. HP gains a class hit-die roll plus
  Constitution modifier (minimum 1), current HP increases by the same amount, slot capacity
  gains only newly available slots, and new spells are learned/prepared by class.
- Added SRD class lists and modeled effects for level-2 Scorching Ray (three 2d6 attacks),
  Misty Step (escape an active combat; no slot spent without a destination), and Invisibility
  (condition flag ending on attack or another spell; no enemy-attack modifier modeled).
- The game HUD and sheet show current/max slots; the journal highlights level-ups and clearly
  marks a combat-blocked rest. EN/CZ-without-diacritics spell-level and status labels updated.
- **Verified this session:** backend **195 passed, 186 warnings in 59.48s**; frontend
  **14 passed**; production build and `npx tsc --noEmit` passed; browser E2E **2 passed**.
  CLI smoke test selected a Wizard, cast Magic Missile twice (both hits defeated goblins),
  advanced to level 2 with a new spell and `L1: 1/3`, then rested to `L1: 3/3` without
  spending Adventure Mana. Restoration, progression, modeled level-2 effects and zero-balance
  rest have dedicated regression tests.
- Manual Telegram/ngrok visual QA and PostgreSQL runtime remain **UNVERIFIED**.
- Commit: not created; changes remain in the working tree.

### 6.24 Session 2026-11-07 (18) — Resource and spell-picker UX
- Clarified Adventure Mana with a collapsible help panel: Lite turns, rests and no-op
  actions are free; paid narration tiers consume Mana; top-ups are not available. Added
  matching Czech-without-diacritics copy.
- Moved legacy character mana behind a labeled disclosure, clarified the spell picker
  label and placeholder, and reset the selected spell after submitting an action.
- Updated the UI regression test to interact with the native `<summary>` disclosure
  rather than assume it has the `button` role; scoped repeated top-up text to its paragraph.
- Verified this session: frontend **14 passed**; production build passed;
  `npx tsc --noEmit` passed; browser E2E **2 passed**. Backend was not rerun; the
  latest backend result remains **195 passed, 186 warnings** from session 6.23.
- Local browser check confirmed the expected unauthenticated screen outside Telegram.
  Authenticated Telegram WebView, ngrok, Docker build and PostgreSQL runtime remain
  **UNVERIFIED**. Docker and `psql` are unavailable; no local PostgreSQL service or
  listener on port 5432 was found. The ngrok executable exists but no tunnel was opened.
- Commit: not created; changes remain in the working tree.

### 6.25 Session 2026-11-07 (19) - Connected campaign locations
- Added four connected locations with data-driven exits, location-specific encounter pools and clue text. Explicit travel changes the current location only along an open route; it does not roll a random encounter.
- First visits add one short NPC/story beat (Mara, Caldus or Nib); revisits do not repeat it. No NPC dialogue, trade, quest-state or branching resolution is implemented.
- Added the route graph to `GET /reference`; the game screen offers a quick action to the next connected location and uses location-aware exploration prompts.
- Added backward-compatible `visited_locations` state with a default for old character payloads.
- Verified: backend **202 passed, 186 warnings in 63.45s**; frontend **15 passed**; frontend build and `npx tsc --noEmit` passed; browser E2E **2 passed**.
- Manual Telegram/ngrok visual QA, Docker runtime and live PostgreSQL remain **UNVERIFIED**.
- Commit: not created; changes remain in the working tree.

### 6.26 Session 2026-11-07 (20) - AI provider boundary and repository docs
- Extracted narration context/request types and the provider protocol to `app/ai/base.py`;
  Ollama completion/streaming to `app/ai/ollama.py`; provider selection to
  `app/ai/registry.py`; and deterministic prose to `app/ai/offline.py`.
- Kept prompt construction, system directives, status reporting, and fallback orchestration
  in `app/narrator.py`. Added mocked Ollama completion/chunk tests and provider-failure
  fallback coverage. API commit-before-stream behavior and D1 remain unchanged.
- Archived the tracked one-off patch scripts under `tools/archive/` after confirming
  no runtime references; added `tools/README.md`.
- Split the project brain to 58 lines and moved session history, decisions, roadmap,
  architecture, engine, content, and deployment documentation to dedicated files.
- Verified: backend **206 passed, 186 warnings in 60.21s**; frontend **15 passed**;
  production build and `npx tsc --noEmit` passed; browser E2E **2 passed**.
- Live Ollama streaming, authenticated Telegram WebView, Docker, and PostgreSQL were not
  re-verified in this session. Deployment checks remain **UNVERIFIED**.
- Commit: not created; changes remain in the working tree.
