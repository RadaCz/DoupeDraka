# Repository status — current truth

**Canonical snapshot:** read this file first; older sprint acceptance docs are historical unless they link here.

| Field | Value |
|-------|--------|
| **Primary branch** | **`main`** |
| **Verified application baseline (staging deploy)** | `37d9c885f2b9a2c76c989e0bdc754ed330b4b04b` (`37d9c88`) |
| **CI evidence for baseline** | GitHub Actions run **[#93](https://github.com/RadaCz/DoupeDraka/actions)** @ `2f0669c` — **5/5 SUCCESS** (same app tree as `37d9c88`; only docs differ through `2f0669c`) |
| **Remote `main` tip (docs after baseline)** | `eebfe61386a853fa1876e012de78a049d014efe7` — documentation-only commits (**#94**–**#96** green); deploy staging from **`37d9c88`** unless a newer **application** commit has green CI |
| **Alembic head (ship)** | **`v005`** (Billing **v006** DEFERRED — not on `origin/main`) |
| **Staging HTTPS** | **NOT DEPLOYED** |
| **Android / iOS Telegram QA** | **NOT TESTED** |
| **Player playtest** | **NOT TESTED** |

## Branch policy

- **`main` is the only active development branch.**
- Do not use `clean-main` (remote removed).

## Beta defaults

- **Lite-first:** `LLM_PROVIDER=fallback` — no paid provider required for closed beta.
- Playwright / Vitest **≠** physical Telegram QA.

## Release gates

Closed beta blocked by: staging deploy on real HTTPS, physical Telegram QA, real-player playtest.

## Deferred (do not ship mixed)

- `app/billing_settlement.py`, `alembic/versions/v006_*`, `tests/test_sprint37_4_*`
- Local backups, logs, `data/`, audit artifacts

## Next operator actions

1. Staging deploy per [`STAGING_RUNBOOK_V1.md`](STAGING_RUNBOOK_V1.md) — checkout **`37d9c88`** (or newer app SHA with green CI), merge compose overlay, Alembic **v005**.
2. Physical QA on Android/iOS against staging HTTPS ([`SPRINT_38_TELEGRAM_QA_PROTOCOL.md`](SPRINT_38_TELEGRAM_QA_PROTOCOL.md)).
3. Pilot playtest (3–5), then cohort 10–15.
