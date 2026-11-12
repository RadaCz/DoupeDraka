# Sprint 35.1.1 — Ghoul paralysis E2E fix

**Root cause:** After Sprint 33 reactive Shield, a ghoul hit against an elf wizard can open `combat_reaction_pending` (`combat_turn: reaction`). The ghoul spec sent `defend` on non-player turns without declining the reaction, so the enemy attack never completed and CON save → `paralyzed` never applied.

**Fix (E2E only):** `frontend/e2e/ghoul-paralysis-combat.spec.ts` — `resolvePendingReactionForE2E`, `postCombatAttack`, no `defend` while reaction pending. `isCombatReactionPending` exported from `chapter-one-e2e-helpers.ts`.

**Production:** unchanged (Shield still player choice).

**Verified (local, E2E_RNG_SEED=27):** ghoul spec PASS; combat-reactions PASS; included in full matrix phase 3/6 when run sequentially.
