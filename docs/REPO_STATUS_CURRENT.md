# Repository status — current truth

**Canonical snapshot:** read this file first; older sprint acceptance docs are historical unless they link here.

| Field | Value |
|-------|--------|
| **Primary branch** | **`main`** |
| **HEAD** | `ab2a3e06257eebcb0ba10f5b624bd67354f5a865` |
| **CI** | GitHub Actions run **[#94](https://github.com/RadaCz/DoupeDraka/actions)** — **5/5 SUCCESS** (backend, backend-postgres, backend-slow, frontend, e2e) |
| **Alembic head (ship)** | **`v005`** (Billing **v006** DEFERRED — not in tree) |
| **Staging HTTPS** | **NOT DEPLOYED** |
| **Android / iOS Telegram QA** | **NOT TESTED** |
| **Player playtest** | **NOT TESTED** |

## Branch policy

- **`main` is the only active development branch** (2026-11-13 consolidation complete).
- Do not use `clean-main` — remote branch removed.

## Release gates (unchanged)

Closed beta still blocked by: staging deploy, physical Telegram QA, real-player playtest.

## Deferred (do not ship mixed)

- `app/billing_settlement.py`, `alembic/versions/v006_*`, `tests/test_sprint37_4_*`
- Local backups, logs, `data/`, audit artifacts

## Next operator actions

1. Staging deploy per [`STAGING_RUNBOOK_V1.md`](STAGING_RUNBOOK_V1.md) (Postgres v005, Lite-first).
2. Physical QA on Android/iOS against staging HTTPS.
3. Pilot playtest (3–5), then cohort 10–15.
