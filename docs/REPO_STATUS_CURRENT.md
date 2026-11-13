# Repository status — current truth

**Canonical snapshot:** read this file first; older sprint acceptance docs are historical unless they link here.

| Field | Value |
|-------|--------|
| **Remote baseline** | `clean-main` @ `91a9ac1c509190d5056dd43cf52f7cf55644dd59` |
| **CI reference** | GitHub Actions run **#91** — **5/5 SUCCESS** (proves `91a9ac1` only) |
| **`main`** | `879dbdd` — release branch; active development on **`clean-main`** |
| **Staging HTTPS** | **NOT DEPLOYED** |
| **Android / iOS Telegram QA** | **NOT TESTED** |
| **Player playtest** | **NOT TESTED** |
| **Billing E / Alembic v006** | **DEFERRED** (untracked + local WIP only) |

## Sprint 39 — committed on `origin/clean-main`

| Sprint | Commit | Subject |
|--------|--------|---------|
| 39.1 | `562ba29` | Adventure coaching strip + Bell Warden level hint |
| 39.1.1 | `5979d53` | Mobile adventure layout + coaching strip in bar |
| 39.2 | `91a9ac1` | Telegram back stack + auth bootstrap FSM |

## Post-`91a9ac1` local work (this audit)

Isolated fixes prepared as separate commits (not pushed in this pass):

1. Idempotency receipt binds owner + character + action fingerprint (`409` on mismatch).
2. Telegram auth cache invalidation / per-`initData` in-flight dedupe.
3. Trusted-proxy rate-limit client IP + Docker `nginx.conf` `X-Forwarded-For`.
4. Chapter 1 level cap UI (`MAX_MVP_LEVEL=3` reference + Character screen).
5. `secret_scan.py` pattern / exclusion updates + CI `permissions: read`.
6. This document + `PROJECT_BRAIN` / `ROADMAP` / staging doc header sync.

## Deferred (do not ship mixed)

- `app/billing_settlement.py`, `alembic/versions/v006_*`, `tests/test_sprint37_4_*`
- Mixed billing hunks in `.api_full_working_backup.py` (local backup only)
- Untracked logs, E2E reports, `data/`, audit artifacts

## Next operator actions

1. Push local audit commits when approved; wait for **new** green CI (not #91).
2. First staging deploy: PostgreSQL **v005**, `LLM_PROVIDER=fallback`, no v006.
3. Real-device Telegram QA, then closed-beta invite.
