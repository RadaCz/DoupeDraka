# Sprint 29 — Combat reactions & opportunity attacks V1

**Baseline:** `29745eb` (Sprint 28.1). **Committed:** `44066e3` on `clean-main` (= `origin/clean-main`).

## Audit (pre-implementation)

| Mechanic | Status before |
|----------|----------------|
| `reaction_used` flag | **Yes** (Sprint 25) — reset on player turn start |
| Opportunity attacks | **No** |
| Disengage | **No** |
| Enemy reaction tracking | **No** |
| Teleport OA exemption | N/A (teleport not modeled) |
| Forced movement | N/A (no forced combat movement) |

## Delivered

- `app/engine/combat_reactions.py` — leave-reach detection, Disengage flag, enemy reaction flag
- `DISENGAGE` intent + `_resolve_disengage` / OA hooks on combat move & enemy retreat
- Player OA uses `attack(..., opportunity=True)` + `spend_reaction`
- Enemy OA uses `_enemy_melee_strike` + `enemy_reaction_used`
- UI: Disengage chip (EN/CS), journal lines include “Opportunity attack”
- `tests/test_sprint29_combat_reactions.py`

## SRD gaps (documented)

| Rule | Status |
|------|--------|
| Reach weapons >5 ft | NOT MODELED |
| Multiple enemies | Single-combatant MVP |
| Shield / Hellish Rebuke reactions | NOT MODELED |
| Teleport / forced movement OA rules | Deferred until mechanics exist |

## Validation

| Suite | S29 commit (`44066e3`) | After Sprint 30 hardening (local) |
|-------|------------------------|-----------------------------------|
| `test_sprint29_combat_reactions.py` | 11 passed | 11 passed |
| `test_sprint30_combat_reactions_hardening.py` | — | 4 passed |
| Fast pytest | 654 passed, 2 skipped | 658 passed, 2 skipped |
| Regress | 186 passed | 190 passed |
| Full pytest | 675 passed, 2 skipped | 679 passed, 2 skipped |
| Playwright full (6 phases) | occasional `ghoul`/`spell-save` flake | **40 passed** (see Sprint 30 acceptance) |
| GitHub CI | run on push of `44066e3` | Sprint 30 CI **pending** push |

**Hardening:** [`SPRINT_30_COMBAT_REACTIONS_HARDENING_ACCEPTANCE.md`](SPRINT_30_COMBAT_REACTIONS_HARDENING_ACCEPTANCE.md).

**Status:** **IMPLEMENTED & COMMITTED** (S29). Sprint 30 hardening **READY FOR REVIEW** in working tree (uncommitted).
