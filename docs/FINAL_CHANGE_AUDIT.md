# FINAL CHANGE AUDIT — Sprint P0.4 (read-only)

**Audit date:** 2026-11-13  
**Repository:** RadaCz/DoupeDraka  
**Branch:** `clean-main`  
**HEAD:** `894917b812efb5fb280972a9a4397fc789cbd973` (matches expected)  
**Upstream:** `origin/clean-main` @ `894917b812efb5fb280972a9a4397fc789cbd973` (in sync; no unpushed commits on branch tip)  
**Staged files:** 0  

**Audit mode:** No source or test files were modified. Only this document was created.

---

## 1. P0.3 verification (from existing artifacts)

### Backend

| Gate | Evidence | Result |
|------|----------|--------|
| `pytest -m "not slow"` | `docs/SPRINT_P0_3_FULL_SUITE_STABILIZATION.md` | **793 passed**, **3 skipped** |
| `pytest -m slow` | same | **21 passed** |
| Vitest / typecheck / build | same | **PASS** (174 tests) |

#### Exact three skipped tests (fast layer, SQLite conftest)

| # | Test | Reason |
|---|------|--------|
| 1 | `tests/test_alembic_v005.py::test_v005_upgrade_backfills_nulls_preserves_rows_and_passes_check` | `pytest.skip` — `PYTEST_DATABASE_URL` not set / not PostgreSQL |
| 2 | `tests/test_alembic_cd64_token_hash.py::test_cd64_hashes_plain_tokens_preserves_auth_and_idempotent_upgrade` | same |
| 3 | `tests/test_engine.py::test_fleeing_ends_the_fight_and_clears_the_combatant` | **Conditional** `pytest.skip("goblin died immediately; nothing to flee from")` when RNG kills goblin before flee |

**Not hidden, but structural:**

- **21 tests deselected** by `-m "not slow"` (intentional; slow job runs them separately).
- **Postgres migration tests** are skipped in the default fast job but exercised in CI job `backend-postgres` (subset: concurrency + alembic v005 + cd64 only).
- **Untracked** `tests/test_sprint37_4_billing_settlement.py` and `tests/test_e2e_runner_phase_timeouts.py` are **not in CI** until committed; P0.3 local fast run included them once billing import was fixed.
- **Untracked** `v006` migration: `test_v004_follows_v003_in_revision_chain` (modified) accepts head `v006` locally; **CI clean tree without v006** still expects head `v005` — test allows both, but schema on CI may not match until v006 ships.

### Full E2E

| Artifact | Result |
|----------|--------|
| `reports/e2e-full-p03-final.log` | **ALL PHASES PASS**, exit 0, **720 793 ms** (~12.0 min) |
| `reports/e2e-matrix-2026-11-13T15-17-17-396Z.json` | `suiteResult: "ALL PHASES PASS"` |

**Phase durations (final full run):**

| # | Phase | ms |
|---|--------|-----|
| 1 | first-session | 16 553 |
| 2 | chapter-one-quest | 167 662 |
| 3 | fallen | 16 247 |
| 4 | bell-warden-ui | 123 592 |
| 5 | combat-reactions | 18 239 |
| 6 | ghoul-paralysis | 25 378 |
| 7 | saving-throw-combat | 18 482 |
| 8 | spell-save-combat | 17 179 |
| 9 | e2e-smoke (43 specs) | 255 063 |

Bell Warden completion in full run: `chapter_one_complete` in log (`reports/e2e-full-p03-final.log`, `[bw-ui]` round 46).

### Ghoul ×3 (isolated, fresh DB per `run-tests.mjs`)

| Matrix JSON | durationMs | status |
|-------------|------------|--------|
| `reports/e2e-matrix-2026-11-13T14-35-38-927Z.json` | (ghoul fix validation) | PASS |
| `reports/e2e-matrix-2026-11-13T14-36-25-244Z.json` | 23 399 | PASS |
| `reports/e2e-matrix-2026-11-13T14-36-55-860Z.json` | 21 551 | PASS |

*(Third run documented in P0.3 session: also PASS ~23s; matrix `14-35-38` from post-fix first isolated pass.)*

### Bell Warden ×3 (P0.3 regression, isolated)

| Matrix JSON | durationMs | status |
|-------------|------------|--------|
| `reports/e2e-matrix-2026-11-13T14-39-30-179Z.json` | 132 168 | PASS |
| `reports/e2e-matrix-2026-11-13T14-43-02-232Z.json` | 108 430 | PASS |
| `reports/e2e-matrix-2026-11-13T14-45-31-786Z.json` | 122 986 | PASS |

P0.2 cited logs `reports/bw-p02-valid-run{1,2,3}.log` — **not present on disk**; use matrix JSON + full-suite log above as authoritative P0.3 evidence.

### PostgreSQL / Alembic

| Check | Ran? | Outcome |
|-------|------|---------|
| Local `alembic upgrade head` | Attempted (P0.3) | **Failed** on existing SQLite dev DB (table already exists) — not a clean migration proof |
| CI `backend-postgres` (`alembic upgrade head` + `alembic check` + subset pytest) | **Not run locally** | Gap until push |
| Fast-layer alembic chain test | `test_v004_*` (modified) | Passes against working tree with optional v006 |

### GitHub Actions

- **Not verified** on this branch (no push; `gh` CLI unavailable locally per P0.3).
- CI E2E step: `timeout-minutes: 15` for full `npm run test:e2e` (~12 min observed) — tight but within margin.

---

## 2. Git inventory

| Category | Count |
|----------|------:|
| Modified tracked (` M`) | **43** |
| Untracked (`??`) | **48** |
| Staged | **0** |
| Deleted (tracked) | **0** |
| **Total `git status` lines** | **91** |

**Diff summary (tracked):** `43 files changed, 1090 insertions(+), 363 deletions(-)`  
**`git diff --check`:** whitespace warnings only (LF/CRLF); no conflict markers.

---

## 3. Logical changes by sprint / bucket

### P0.1 — E2E RNG determinism

| File | Logical change |
|------|----------------|
| `app/e2e_rng.py` | `build_e2e_rng_identity(tg, name)` |
| `app/engine/rng_state.py` | Bind/capture uses E2E identity |
| `app/api.py` | `build_e2e_rng_identity` in `commit_action_turn` (hunk) |
| `tests/test_rng_e2e_seed.py` | Identity-based regression suite |
| `frontend/e2e/chapter-one-e2e-helpers.ts` | Partial: RNG-stable drive (intermixed with P0.2/P0.3) |

### P0.2 — Bell Warden / combat UI economy

| File | Logical change |
|------|----------------|
| `frontend/src/combat/combatEconomy.ts` | `shouldOfferEndTurn`: offer when action **or** bonus spent |
| `frontend/src/combat/combatEconomy.test.ts` | Regression |
| `frontend/src/combat/combatActions.test.ts` | End turn enabled when both slots spent |
| `frontend/e2e/bell-warden-ui.spec.ts` | Steps/timeouts/driver hooks |
| `frontend/e2e/chapter-one-e2e-helpers.ts` | **Large:** `completeBellWardenBossViaUI`, `settleFreshPlayerTurnAfterEngage`, `endCombatTurnViaUiIfSpent`, token refresh, MVP heal, `clickCombatDeckButtonAwaitState`, etc. |
| `frontend/e2e/combat-reactions.spec.ts` | `startCellarCombat` re-engage |

### P0.3 — Full suite stabilization

| File | Logical change |
|------|----------------|
| `frontend/e2e/run-tests.mjs` | Ghoul phase 225s = 180s + 45s buffer |
| `frontend/e2e/playwright.config.ts` | Separate ghoul project timeout 180s |
| `frontend/e2e/ghoul-paralysis-combat.spec.ts` | `ghoulUiPlayerCombatTurn`, `startGhoulCombatForUi`, stall guard |
| `frontend/e2e/chapter-one-e2e-helpers.ts` | Ghoul helpers + bandit gold path (`earnBanditEvidenceViaEngine`, scavenge 72) |
| `tests/test_alembic_v004.py` | Optional v006 head |
| `tests/test_integration.py` | Fallen hook test isolation (`monkeypatch`) |
| `tests/test_spells.py` | Wizard level-1 count 4 |
| `tests/test_memory_hardening.py` | Mock `ledger_ref` kwarg |
| `app/api.py` | Billing settlement: `ledger_ref`, `billing_status`, `recover_held_receipt_billing`, replay held recovery |
| `app/db.py` | Columns + SQLite bootstrap migration |
| `tests/test_e2e_runner_phase_timeouts.py` | **Untracked** — runner vs Playwright budget |
| `tests/test_sprint37_4_billing_settlement.py` | **Untracked** — billing contract tests |
| `app/billing_settlement.py` | **Untracked** — constants/helpers |
| `alembic/versions/v006_receipt_billing_settlement.py` | **Untracked** — Postgres migration |

### G-09 / spellcasting & creation (pre-P0 product slice)

| File | Logical change |
|------|----------------|
| `app/engine/character_creation.py` | Wizard 4 level-1 spells; modeled-spell filter; utility cantrips; default spellbook |
| `app/engine/spells.py` | Small (aligned lists) |
| `app/engine/combat_action_economy.py` | Misty Step bonus action; bonus-action spell eligibility |
| `app/engine/saving_throws.py` | Halfling Lucky on adv/dis saves |
| `frontend/src/combat/combatEconomy.ts` | `BONUS_ACTION_SPELLS` + Misty Step / Shield of Faith |
| `tests/test_character_creation_v2.py`, `tests/test_rest_progression.py` | Aligned expectations |
| `frontend/e2e/*spell*`, `class-identity`, `cleric-channel`, `rogue-cunning`, `reactive-spellcasting`, `combat-action-economy` | E2E alignment with spell economy |

### Other / UNKNOWN (needs isolated review before commit)

| File | Notes |
|------|--------|
| `app/engine/service.py` | Small hunk (~1477) — inspect before grouping |
| `app/engine/ruleset_v1.py`, `design/RULESET_v1.md`, `docs/RULESET_v1.md`, `docs/SPELLCASTING_CONTRACT_V1.md` | Rules doc sync |
| `ROADMAP.md` | Roadmap edits |
| `frontend/src/App.tsx`, `CharacterScreen.tsx`, `characterSheet.ts` | UI sheet |
| `frontend/nginx.conf` | Deploy config |
| `scripts/secret_scan.py` | Scanner patterns |
| `?? data/` | Local DB — **never commit** |
| `?? scripts/audit_secret_hygiene.py`, `tools/audit_cs_suspects.py`, audit docs | Audit WIP |
| `?? tests/test_audit_g01_halfling_lucky.py`, `tests/test_sprint37_3_1_bell_warden_e2e.py` | Untracked tests — link to G-09 / BW |
| Root `?? .e2e-*`, `?? .pytest-*`, `?? .vitest-gate.txt` | Local run logs — **do not commit** |

---

## 4. Risky test / harness changes (verdict)

| Change | Verdict |
|--------|---------|
| **`test_spells.py` → `len(leveled) == 4`** | **Corrects obsolete expectation** — matches `SPELL_PICK_LIMITS["wizard"]["level_one_known"]: 4` and `test_character_creation_v2` in same tree. Not a weaken-only change. |
| **`test_alembic_v004.py` accepts v006** | **Test harness alignment** with optional untracked migration; does not relax v003→v004→v005 checks. CI without v006 still asserts `v005` head. |
| **`test_integration.py` fallen hook monkeypatch** | **Fixes test isolation** — production contract unchanged (`e2e_hooks_enabled()` still gates hook). Not weakening security assertion. |
| **`test_memory_hardening.py` mock signature** | **Tracks API** (`ledger_ref` on refund) — required for billing implementation. |
| **`test_e2e_runner_phase_timeouts.py`** | **Legitimate regression** — prevents recurrence of ghoul outer-kill. |
| **`earnBanditEvidenceViaEngine` soft return** | **Partial soften** — evidence no longer hard-required in helper; `earnChapterOneShopGold` still `expect`s `gold >= 45` via scavenge fallback. Document as **product-test compromise** for fighter skill path; bandit skill spec still tests evidence on rogue. |
| **Billing in `app/api.py`** | **Implementation fix** for untracked Sprint 37.4 tests — not test-only change. |

### E2E runner / combat

| Change | Verdict |
|--------|---------|
| Ghoul phase 225s | **Fix** — matches Playwright 180s + teardown (not blind inflation). |
| Ghoul UI driver | **Fix** — real UI combat + end-turn economy. |
| BW helpers in `chapter-one-e2e-helpers.ts` | **Fix** — P0.2 UI/API sync; largest merge-risk file. |

---

## 5. Classification counts (logical work items)

| Status | Count | Notes |
|--------|------:|-------|
| **DONE** (validated P0.1–P0.3 scope) | **~28** | RNG, BW UI economy, ghoul, backend fast/slow green, full E2E |
| **INCOMPLETE** | **~8** | v006 + billing untracked trio; postgres proof; CI unverified; `service.py` hunk unexplained |
| **BROKEN** | **0** | Per P0.3 local gates |
| **UNKNOWN** | **~12** | Audit scripts, product-reality docs, partial engine/rules UI without isolated rerun |

---

## 6. Proposed commit sequence (do not stage until approved)

**Order respects dependencies. Use `git add -p` on mixed files.**

### Commit A — `feat(e2e): stable per-identity RNG (P0.1)`

- `app/e2e_rng.py`, `app/engine/rng_state.py`
- `app/api.py` — **hunks only:** imports + `build_e2e_rng_identity` / bind in `commit_action_turn`
- `tests/test_rng_e2e_seed.py`
- **Tests:** `pytest tests/test_rng_e2e_seed.py -q`

### Commit B — `fix(combat-ui): offer End turn when action or bonus spent (P0.2)`

- `frontend/src/combat/combatEconomy.ts`, `*.test.ts` (combat)
- **Tests:** `cd frontend && npm run test -- --run src/combat`

### Commit C — `test(e2e): Bell Warden UI driver and reactions re-engage (P0.2)`

- `frontend/e2e/bell-warden-ui.spec.ts`, `frontend/e2e/combat-reactions.spec.ts`
- `frontend/e2e/chapter-one-e2e-helpers.ts` — **hunks:** BW-only (`completeBellWardenBossViaUI`, `settleFreshPlayerTurnAfterEngage`, `endCombatTurnViaUiIfSpent`, `clickCombatDeckButtonAwaitState`, `prepareBellWardenUiFight`, …)
- **Tests:** BW isolated ×1; `combat-reactions.spec.ts`

### Commit D — `fix(e2e): ghoul harness timeouts and UI combat loop (P0.3)`

- `frontend/e2e/run-tests.mjs`, `playwright.config.ts`, `ghoul-paralysis-combat.spec.ts`
- `frontend/e2e/chapter-one-e2e-helpers.ts` — **hunks:** `ghoulUiPlayerCombatTurn`, `startGhoulCombatForUi`, `combatProgressSignature` export
- `tests/test_e2e_runner_phase_timeouts.py` (add file)
- **Tests:** ghoul ×3; `pytest tests/test_e2e_runner_phase_timeouts.py -q`

### Commit E — `feat(billing): receipt ledger settlement (Sprint 37.4 / P0.3)`

- `app/billing_settlement.py`, `alembic/versions/v006_*.py`, `app/db.py`, `app/api.py` — **billing hunks only**
- `tests/test_sprint37_4_billing_settlement.py`, `tests/test_memory_hardening.py`
- `tests/test_alembic_v004.py`
- **Tests:** `pytest tests/test_sprint37_4_billing_settlement.py tests/test_alembic_v004.py tests/test_memory_hardening.py -q`; CI postgres job locally if possible

### Commit F — `fix(test): align spells and integration with current contracts (P0.3)`

- `tests/test_spells.py`, `tests/test_integration.py`
- **Tests:** those files + full `pytest -m "not slow"`

### Commit G — `feat(chars): G-09 wizard spell picks and bonus-action economy`

- `app/engine/character_creation.py`, `spells.py`, `combat_action_economy.py`, `saving_throws.py`
- `frontend/src/combat/combatEconomy.ts` — **hunk:** `BONUS_ACTION_SPELLS` only (if not in B)
- `tests/test_character_creation_v2.py`, `test_rest_progression.py`
- Related `frontend/e2e/*` spec tweaks
- **Tests:** `pytest tests/test_character_creation_v2.py tests/test_rest_progression.py`; targeted E2E smoke subset

### Commit H — `chore: docs sprint P0.1–P0.3`

- `docs/SPRINT_P0_*.md`, this `FINAL_CHANGE_AUDIT.md`

### **Do not commit (without separate approval / completion)**

- `?? data/`, root probe logs, `docs/product-reality-check*`, audit tooling WIP
- `ROADMAP.md`, `nginx.conf`, `secret_scan.py` until reviewed
- `app/engine/service.py` until hunk purpose documented
- Mixed `chapter-one-e2e-helpers.ts` bandit/scavenge hunks — include in **C** or **D** or **G** explicitly via `git add -p`

---

## 7. Confirmation

- **No** `git reset`, `clean`, `stash`, `checkout`, `revert`, **stage**, **commit**, or **push** was performed during this audit.
- **No** full E2E re-run (12 min) — existing `e2e-full-p03-final.log` and matrix JSONs used.
- **Only new file:** `docs/FINAL_CHANGE_AUDIT.md`

**Await explicit approval before staging, committing, or pushing.**
