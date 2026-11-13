# E2E harness checkpoint (Sprint 37.4)

**Date:** 2026-11-13
**Scope:** Playwright runner / process ownership / smoke dedupe / Python pin only.
**Not in this checkpoint:** Bell Warden UI combat-loop fix, spell-save journal fix, product P1/P2 code.

## What shipped

- `run-tests.mjs` owns `--continue-on-error` (not forwarded to Playwright CLI).
- Per-phase timeouts + 25m suite ceiling; PASS / FAIL / TIMEOUT / NOT RUN.
- Ports 8001/5174 must be free before/after each phase; only the owned Playwright PID tree is killed.
- Playwright launches Uvicorn **directly** with pinned `E2E_PYTHON` (no nested `start-api.mjs` webServer).
- Resolver prefers `.venv-e2e`, then project `.venv`; rejects `voice-pro` base interpreters; CI sets `E2E_PYTHON=python`.
- `e2e-smoke` ignores all seven dedicated specs; runner asserts zero overlap.
- CI artifact path aligned to `frontend/.playwright-results/`.

## Explicitly still OPEN

- Bell Warden UI (`completeBellWardenBossViaUI` combat-loop TIMEOUT).
- spell-save journal visibility after combat sync.
- Full 7-phase continuous matrix green.
- **CLOSED BETA READY: NOT READY**
