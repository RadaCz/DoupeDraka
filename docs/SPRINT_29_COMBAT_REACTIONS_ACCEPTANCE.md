# Sprint 29 — Combat reactions & opportunity attacks V1

**Baseline:** `29745eb` (Sprint 28.1) on `clean-main`.

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

## Validation (local, 2026-11-12)

| Suite | Result |
|-------|--------|
| `test_sprint29_combat_reactions.py` | 11 passed |
| Fast pytest | 654 passed, 2 skipped |
| Regress | 186 passed |
| Full pytest | 675 passed, 2 skipped |
| Slow | 21 passed |
| Vitest | 171 passed |
| Build | OK |
| Secret scan | OK |
| Playwright full | **31+ passed**; isolated `combat-reactions` OK; occasional `ghoul`/`spell-save` flake in phased run (investigate) |
| GitHub CI | NOT RUN (no push) |
| PostgreSQL | CI job only |

**Status:** **READY FOR REVIEW** (pytest + regress + Sprint 29 green; verify full Playwright matrix before push).
