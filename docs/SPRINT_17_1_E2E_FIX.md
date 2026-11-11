# Sprint 17.1 — E2E failure diagnosis & equipment acceptance fix

**Baseline commit:** `102c1a65a0d308e06229fb32c7accf5dff641dee` (`clean-main`)  
**GitHub Actions run referenced:** `42999293685`  
**Date:** 2026-11-11  
**Commit / push:** none (per sprint scope)

## A. `inventory-equip.spec.ts`

### Symptom
After `Unequip shield`, UI AC stayed **18** (chain 16 + shield 2).

### Diagnosis
1. Fighter from wizard has chain mail + shield equipped; starting AC **18** on server.
2. Frontend sends `unequip shield` via `takeAction` → `/actions/stream` (correct path).
3. **Root cause:** `parse_action_intent("unequip shield")` returned `ability_check`, not `equip`. `resolve_action` never called `_equip_item` → no slot change, no `refresh_armor_class`, state persisted unchanged.
4. Frontend updated from stream `turn` payload only when engine changed state; with CHECK path, `armor_class` remained 18 — server and UI agreed but were **wrong** for the intended action.

### Fix
- `app/engine/intent.py`: treat `UNEQUIP_PATTERN` matches as `EQUIP` intent; extend negation terms.
- Tests: `tests/test_intent.py`, `tests/test_equipment_armor_v1.py` (`resolve_action` unequip → AC 16).

### E2E hardening (not weakening)
- Wait for character inventory stream idle (`waitForCharacterInventoryIdle`).
- Assert AC **18 → 16** via precise vital locator (Fighter chain + shield).

## B. `player-journey-hub.spec.ts`

### Symptom
First CI attempt timed out (120s) on adventure composer; retry passed quickly.

### Diagnosis
1. Test waited for HTTP **200** on `/actions/stream` then immediately filled the textbox again.
2. **200** arrives when the stream **opens**, while `busy`/`aria-busy` remain true until SSE **`complete`** — second action raced a locked composer (flake).
3. Minor: English-only `Your action` / `Send action` labels fragile if locale drifts (bilingual helpers already used elsewhere).

### Fix
- `frontend/e2e/telegram.ts`: `ACTION_TEXTBOX`, `SEND_ACTION_BTN`, `waitForAdventureComposerReady` (input enabled, not narrating), `waitForAdventureComposerIdle` (post-turn: `aria-busy` false).
- `player-journey-hub.spec.ts`: cellar heading gate, bilingual selectors, idle wait **after** first stream before second action/dblclick.

No idempotency assertions removed.

## Changed files (Sprint 17.1 only)

| File | Change |
|------|--------|
| `app/engine/intent.py` | Unequip → EQUIP routing |
| `tests/test_intent.py` | Unequip intent tests |
| `tests/test_equipment_armor_v1.py` | `resolve_action` integration |
| `frontend/e2e/telegram.ts` | Composer wait helpers + bilingual labels |
| `frontend/e2e/inventory-equip.spec.ts` | AC 18→16, stream idle |
| `frontend/e2e/player-journey-hub.spec.ts` | Composer sync + selectors |

## Local verification

| Suite | Result |
|-------|--------|
| `pytest tests/test_intent.py tests/test_equipment_armor_v1.py` | 20 passed |
| Vitest (unchanged UI prod code) | 153 passed (prior run) |
| `npm run build` | OK |
| `inventory-equip.spec.ts` | Pass |
| `player-journey-hub.spec.ts` | Pass |
| Full E2E (`npm run test:e2e`) | **23/23 passed**, ~4.5 min, workers 1, retries 0 locally |

## Acceptance answers

| Question | Answer |
|----------|--------|
| Real AC bug or test-only? | **Real engine bug** (intent routing); E2E expectations tightened, not lowered |
| Server/UI AC parity? | Yes after fix (`unequip shield` → persisted AC 16) |
| Both E2E specs without retry? | Yes locally (retries=0) |
| Full E2E matrix? | Yes, 23 passed |
| Ready for separate commit? | Yes — 6 files above only |

## Unverified / unchanged

- Staging 15.3 docs, `data/`, logs untouched  
- No change to narrator billing, Chapter One logic, or equipment catalog breadth  
- CI re-run on GitHub not executed from this machine
