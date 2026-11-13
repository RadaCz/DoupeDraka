# Repository status — current truth

**Canonical snapshot:** read this file first; older sprint acceptance docs are historical unless they link here.

| Field | Value |
|-------|--------|
| **Primary branch** | **`main`** @ `2f0669c9a9a12aea9437e5137b007a5551029272` |
| **CI (main)** | Run **#43493374882** — **5/5 SUCCESS** (backend, backend-postgres, backend-slow, frontend, e2e) |
| **Prior CI (clean-main, pre-merge)** | Run **#43489799957** @ `2f0669c` — **5/5 SUCCESS** |
| **Old `main` (pre-FF)** | `879dbddb7d810f72ed9d44fa32bdbdddea65d0cc` |
| **Staging HTTPS** | **NOT DEPLOYED** |
| **Android / iOS Telegram QA** | **NOT TESTED** |
| **Player playtest** | **NOT TESTED** |
| **Billing E / Alembic v006** | **DEFERRED** (untracked + local WIP only) |

## Branch policy (2026-11-13)

- **`main` is the sole active development branch** (fast-forwarded from `clean-main` @ `2f0669c`).
- Remote `clean-main` removed after merge to avoid dual-head confusion.
- Default branch on GitHub should be **`main`**.

## Sprint 39 + audit commits on `main`

| Commit | Subject |
|--------|---------|
| `562ba29` | Adventure coaching strip + Bell Warden level hint |
| `5979d53` | Mobile adventure layout fix |
| `91a9ac1` | Telegram back stack + auth bootstrap FSM |
| `2e7e6a1` | Idempotency receipt binding |
| `3902463` | Telegram auth cache invalidation |
| `d449346` | Level cap UI + proxy rate-limit headers |
| `37d9c88` | secret_scan hardening |
| `2f0669c` | Doc sync (pre-merge snapshot) |

## Deferred (do not ship mixed)

- `app/billing_settlement.py`, `alembic/versions/v006_*`, `tests/test_sprint37_4_*`
- Local backups, logs, `data/`, audit artifacts

## Next operator actions

1. Confirm GitHub default branch = `main`.
2. Staging deploy: PostgreSQL **v005**, Lite-first, no v006.
3. Device QA + closed-beta playtest.
