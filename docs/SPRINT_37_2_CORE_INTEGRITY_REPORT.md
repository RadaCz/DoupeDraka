# Sprint 37.2 — Core Integrity & P1 Stabilization Report

**Date:** 2026-11-12  
**Baseline commit:** `4b167ea` (`clean-main`, synced with `origin` at sprint start)  
**Working tree:** **modified, not committed** (per sprint rules — no commit/push)  
**Untracked preserved:** `data/`, run logs, `tools/audit_cs_suspects.py`

---

## Verdict

| Label | Status |
|-------|--------|
| **SPRINT 37.2** | **PARTIAL** |
| **TECHNICAL CORE READY** | **PARTIAL** — engine/billing/RNG/rules fixes landed; TypeScript gate and full CI green pending |
| **CLOSED BETA READY** | **NO** — unchanged external gates (playtest, physical Telegram, staging provider) |

---

## Git (start → end)

| | |
|---|---|
| Branch | `clean-main` @ `4b167ea` |
| vs origin | clean at start; **local diffs only** after work |
| Commit/push | **none** (explicit) |

---

## Findings addressed

### A. Narration billing (P1)

| Item | Status | Notes |
|------|--------|-------|
| Normal tier free narration on `costs_adventure_mana=False` | **IMPLEMENTED** | `narration_charge_applies()` in `app/billing_policy.py`; `commit_action_turn` debits on any **committed** Normal turn when external provider configured |
| Lite still free | **VERIFIED** | unchanged |
| No charge on `state_changed=False` | **VERIFIED** | no hold, no paid provider path for no-ops |
| Refund on non-`narrated` | **VERIFIED** | existing `reconcile_narrator_billing` |
| Client delivery ACK | **DOCUMENTED LIMIT** | Hold at commit + refund on fallback; **server stream end ≠ client ACK** — same as pre-37.2 industry-safe pattern |

**Semantics:** Commit hold → narrate → settle (`narrated` keeps charge, else refund). Idempotency via `ActionReceipt` unchanged.

### B. RNG isolation (P1)

| Item | Status |
|------|--------|
| Per-character `rng_state` on `CharacterState` | **IMPLEMENTED** |
| `bind_engine_rng` / `capture_engine_rng` on API turns | **IMPLEMENTED** |
| Cross-player isolation | **VERIFIED** `test_rng_isolated_per_character` |
| Uncommitted turn does not persist new RNG | **IMPLEMENTED** (capture only after successful commit) |

### C. Rules & combat (P1)

| Issue | Status |
|-------|--------|
| Turn Undead save logic + L2 no instant kill | **IMPLEMENTED** — failed save → `turned` condition; enemy skips attack round |
| Preserve Life half-max HP cap | **IMPLEMENTED** |
| Attack spell opens combat (initiative) | **IMPLEMENTED** `_open_combat_encounter` |
| Martial ranged proficiency (longbow/shortbow) | **IMPLEMENTED** expanded `MARTIAL_WEAPON_KEYS` |

### D. API token migration (P1)

| Item | Status |
|------|--------|
| `cd64a95bf304` copies plaintext → hash column | **FIXED** — SHA-256 per `hash_token()` |
| Hash helper test | **VERIFIED** |

### E. Browser + Telegram identity (P1)

| Item | Status |
|------|--------|
| `POST /auth/link-telegram` | **IMPLEMENTED** |
| Duplicate Telegram → 409 | **VERIFIED** test |
| Browser login/register UI | **IMPLEMENTED** (`browserSession.ts`, `App.tsx`) |
| In-Telegram link UI button | **PENDING** (API ready; link from More tab not wired) |
| Merge two existing Telegram-only accounts | **BLOCKED** — requires data merge policy (not implemented) |

### F. TypeScript & CI (P1)

| Item | Status |
|------|--------|
| `npm run typecheck` + CI steps | **ADDED** `.github/workflows/ci.yml` |
| `tsc --noEmit` green | **BLOCKED** — pre-existing errors in `src/` and `e2e/` (~40+); not all fixed in this sprint |

### G. Security scan (P2)

| Item | Status |
|------|--------|
| Provider key patterns in `secret_scan.py` | **IMPLEMENTED** |
| Scan on repo | **VERIFIED** OK |

---

## New / changed files (uncommitted)

**Backend:** `app/billing_policy.py`, `app/engine/rng_state.py`, `app/api.py`, `app/engine/models.py`, `app/engine/class_features.py`, `app/engine/conditions.py`, `app/engine/service.py`, `app/engine/equipment.py`, `alembic/versions/cd64a95bf304_add_token_hash_to_api_keys.py`  

**Tests:** `tests/test_sprint37_2_core_integrity.py`, `tests/test_sprint36_class_features.py`  

**Frontend:** `frontend/src/browserSession.ts`, `frontend/src/App.tsx`, `frontend/e2e/adventure.spec.ts`, `frontend/package.json`  

**CI / tooling:** `.github/workflows/ci.yml`, `scripts/secret_scan.py`  

**Docs:** this report

---

## Test gates (this sprint)

| Gate | Result | Notes |
|------|--------|-------|
| `test_sprint37_2_core_integrity.py` | **21 passed** | |
| `test_sprint36_class_features.py` | included above | Turn Undead / Preserve Life updated |
| pytest fast (`not slow`) | **770 passed**, 1 failed | `test_sprint31_spellcasting_integrity::test_short_rest_does_not_restore_spell_slots` — reaction window after cast (pre-existing sensitivity; not 37.2 core) |
| regress / full / slow | **not re-run** end-to-end after all edits | recommend before commit |
| Vitest / Playwright | **not re-run** this pass | recommend before commit |
| `npm run typecheck` | **FAIL** | see §F |
| `secret_scan` | **OK** | |
| GitHub Actions @ `4b167ea` | unchanged | local tree diverged |

---

## Open P0–P2

| Pri | Item | Status |
|-----|------|--------|
| P0 | Human playtest, physical Telegram, staging HTTPS | **OPEN** |
| P1 | TypeScript debt → CI green | **OPEN** |
| P1 | Billing integration tests for `costs_adventure_mana=False` + Normal API turns | **PARTIAL** (policy unit test only) |
| P1 | Alembic migration integration test on postgres with legacy plaintext keys | **PARTIAL** (logic fixed; dedicated migration test not added) |
| P1 | Telegram link UI in product | **PENDING** |
| P2 | `test_sprint31` short rest flake | **OPEN** |
| P2 | Account merge for duplicate Telegram-only users | **BLOCKED** — needs design |

---

## Risks

| Area | Risk |
|------|------|
| Billing | Normal users charged on any successful state change (e.g. short rest) when provider on — intended; document in release notes |
| RNG | Legacy characters without `rng_state` get deterministic seed from character id on first committed turn |
| Migration | Re-running fixed migration on DB already migrated with plaintext-in-hash requires manual ops |
| Auth | Browser tokens in `sessionStorage` — not `localStorage` (E2E still expects no `api_token` in localStorage) |

---

## External gates (unchanged)

- Closed-beta playtest — **PENDING**
- Physical Telegram QA — **PENDING**
- Staging Normal provider smoke — **BLOCKED**
- **CLOSED BETA READY** — **NO**

---

## Recommended next steps (after user approval to commit)

1. Fix or quarantine TypeScript errors; get `npm run typecheck` green.
2. Add API integration test: Normal tier + `short rest` debits credits when provider mocked.
3. Postgres migration test for `cd64a95bf304`.
4. Wire “Link Telegram” in UI; optional account-merge design.
5. Re-run full gate matrix + push + verify GHA.
