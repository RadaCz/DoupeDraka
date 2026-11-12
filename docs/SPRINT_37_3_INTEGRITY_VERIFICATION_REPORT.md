# Sprint 37.3 — Integrity Verification & CI Recovery Report

**Date:** 2026-11-12  
**Baseline commit:** `4b167ea` (`clean-main`, synced with `origin` at sprint start)  
**HEAD at report:** `4b167ea` (no new commits — local working tree only)  
**Commit/push/deploy:** **none** (per sprint rules)

---

## Verdict

| Label | Status |
|-------|--------|
| **SPRINT 37.3** | **PARTIAL** |
| **CORE INTEGRITY** | **PASS** |
| **BILLING INTEGRITY** | **PARTIAL** |
| **RNG INTEGRITY** | **PASS** |
| **DATABASE MIGRATION** | **PARTIAL** (test added; local run **skipped** — no `PYTEST_DATABASE_URL`) |
| **TYPESCRIPT** | **PASS** (`npm run typecheck`, `npm run typecheck:e2e`) |
| **CI** | **PARTIAL** (local gates green; GHA not executed from this machine) |
| **BROWSER + TELEGRAM** | **PARTIAL** (link UI + API; no Playwright link scenario) |
| **CLOSED BETA READY** | **NO** |

---

## Git (start → end)

| | |
|---|---|
| Branch | `clean-main` @ `4b167ea` |
| vs `origin/clean-main` | **unchanged at HEAD**; large **uncommitted** diff (37.2 + 37.3) |
| Preserved | Untracked logs, `data/`, prior artifacts **kept** |

---

## P0 — Test regression: short rest vs reaction window

**Failure:** `tests/test_sprint31_spellcasting_integrity.py::test_short_rest_does_not_restore_spell_slots`

**Cause:** After `cast Magic Missile`, goblin counter-attack opened a Shield **reaction window** (`combat_reaction_pending`). The test manually set `in_combat=False` without resolving the window. `resolve_action` blocked `take a breather` with “Resolve the incoming attack first…”.

**Fix:** In `pending_blocks_unrelated_action`, if the character is **not** in combat, clear stale `combat_reaction_pending` and do not block. Updated `resolve_action` to honor the `blocked` flag only (not a bare `has_pending_reaction` guard). JSON round-trip semantics preserved (`has_pending_reaction` unchanged).

**Files:** `app/engine/reactive_spells.py`, `app/engine/service.py`

---

## P1 — Billing integration audit

**Implemented / extended tests:** `tests/test_sprint37_3_integrity_verification.py`

| Scenario | Coverage |
|----------|----------|
| Lite + paid provider available | **PASS** — no debit |
| Normal + zero credits | **PASS** — HTTP 402, RNG unchanged |
| No-op / invalid action | **PASS** — no debit (nonsense command) |
| Idempotent replay | **PASS** — same events, single RNG snapshot, single debit |
| Concurrent different keys | **PASS** — two versions |
| Successful paid narrate / stream cancel / provider error | **Existing** — `tests/test_concurrency.py`, `tests/test_stream_cancellation.py`, `tests/test_billing_contract.py` |
| `costs_adventure_mana=False` short rest on Normal | **Policy** — `billing_policy.narration_charge_applies` debits any `state_changed` turn (documented in 37.2); dedicated API short-rest debit test **not added** |
| Provider timeout | **Existing** partial via stream failure tests |
| Interrupted SSE / duplicate / concurrent paid | **Existing** concurrency + stream tests |

**Semantics unchanged:** commit hold → narrate → reconcile; idempotency via `ActionReceipt`.

---

## P1 — RNG & persistence (API)

| Property | Status |
|----------|--------|
| Per-character `rng_state` | **PASS** — isolated blobs after committed attacks |
| Failed / 402 turn | **PASS** — no RNG write on 402 |
| Idempotent replay | **PASS** |
| Unit isolation | **PASS** — `test_sprint37_2_core_integrity.py::test_rng_isolated_per_character` |

---

## P1 — PostgreSQL migration `cd64a95bf304`

**Test added:** `tests/test_alembic_cd64_token_hash.py` (upgrade `auth001` → insert plaintext tokens + blank row → `cd64a95bf304` → assert SHA-256 hashes, no plaintext in `token_hash`, blank skipped, idempotent `upgrade head`).

**Local result:** **SKIPPED** (no PostgreSQL `PYTEST_DATABASE_URL` on this machine).

**CI:** `.github/workflows/ci.yml` postgres job updated to include this test.

---

## P1 — TypeScript & CI

| Gate | Result |
|------|--------|
| `npm run typecheck` | **PASS** |
| `npm run typecheck:e2e` | **PASS** |
| `npm run build` | **PASS** |
| Vitest `npm run test:run` | **171/171 PASS** |

**Approach:** Fixed production types (`telegram-webapp.d.ts`, `Character` test stub, targeted test fixes). No blanket `@ts-ignore` or config hiding.

---

## P1 — Telegram link UI

| Item | Status |
|------|--------|
| Browser login in Mini App + sessionStorage priority | **IMPLEMENTED** (`App.tsx`) |
| Settings “Link Telegram now” when browser session + `initData` | **IMPLEMENTED** (`GameScreens.tsx`, `telegramAuth.linkTelegramAccount`) |
| Backend `POST /auth/link-telegram` | **Existing**; duplicate → 409 tested |
| Playwright link flow | **NOT RUN** |
| Duplicate Telegram merge policy | **Still blocked** (design) |

---

## P1 — Tooling / test harness

| Item | Notes |
|------|------|
| `pytest.ini` UTF-8 BOM | **Removed** (restored pytest collection on Windows) |
| `tests/__init__.py` | **Added** — prevents `tests` package shadowing by other projects on `PYTHONPATH` |

---

## Regression gates (this sprint)

| Gate | Result | Notes |
|------|--------|-------|
| pytest **fast** | **777 passed**, 3 skipped | was 771+1 fail at 37.2 handoff |
| pytest **regress** | **309 passed** | |
| pytest **full** | **798 passed**, 3 skipped | |
| pytest **slow** | **21 passed** | |
| Vitest | **171 passed** | |
| TypeScript prod + E2E | **PASS** | |
| Frontend build | **PASS** | |
| `secret_scan.py` | **OK** | |
| PostgreSQL migration test | **SKIPPED** locally | CI job configured |
| Playwright E2E | **NOT RUN** | recommend before release |
| GitHub Actions | **NOT RUN** from workspace | parity expected on push |

---

## Changed / new files (37.3 delta highlights)

**Engine:** `reactive_spells.py`, `service.py` (P0 reaction stale-state)  

**Tests:** `tests/test_sprint37_3_integrity_verification.py`, `tests/test_alembic_cd64_token_hash.py`, `tests/__init__.py`  

**Frontend:** Telegram link UI, `telegram-webapp.d.ts`, `telegramAuth.ts`, TS/E2E fixes  

**CI:** `.github/workflows/ci.yml` (postgres migration test)

(Plus uncommitted **37.2** files listed in `SPRINT_37_2_CORE_INTEGRITY_REPORT.md`.)

---

## Open P0 / P1 / P2

| Pri | Item |
|-----|------|
| P0 | Human playtest, physical Telegram (Android/iOS), staging paid Normal provider |
| P1 | Playwright full suite + Telegram link E2E |
| P1 | API test: Normal tier debit on short rest with mocked provider |
| P1 | Postgres migration test proof on CI (after push) |
| P2 | Account merge for duplicate Telegram-only users |
| P2 | Client delivery ACK vs server stream end (documented limit) |

---

## Physical / staging gates (unchanged)

- Staging Normal provider smoke — **BLOCKED** (environment)
- Closed-beta playtest — **PENDING**
- Physical Telegram QA — **PENDING**

**CLOSED BETA READY:** **NO**

---

## Recommended next steps (after user approval)

1. Commit 37.2+37.3 tree; push; confirm GHA postgres + frontend jobs.
2. Run Playwright E2E locally or in CI.
3. Add Normal+short-rest billing API test if product copy requires explicit proof.
4. Wire optional E2E for Settings → Link Telegram.
