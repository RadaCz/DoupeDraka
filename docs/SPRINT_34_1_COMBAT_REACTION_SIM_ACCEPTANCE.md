# Sprint 34.1 — Combat reaction simulation repair

## Root cause
Sprint 33 leaves `combat_turn: reaction` and `combat_reaction_pending` after an enemy hit until the player **casts Shield** or **declines reaction**. Automated loops (`resolve_combat_action_for_simulation`, E2E `postCombatAttack`) assumed the next legal state was `player` or out of combat, so they stalled or sent illegal attacks.

## Fix (test/E2E only)
- `tests/combat_turn_helpers.py`: `resolve_pending_reaction_for_simulation()` calls engine `decline reaction` when pending exists.
- `frontend/e2e/chapter-one-e2e-helpers.ts`: `resolvePendingReactionForE2E()` (default auto-decline); poll in `postCombatAttack` clears reaction windows before waiting for player turn.

**Production engine unchanged** — live play still requires an explicit player choice.

## Verification
- `test_sprint15_story_progression.py` — 20/20 `level >= 3` (all classes × seeds).
- `tests/test_sprint34_1_combat_reaction_simulation.py` — targeted regression.

## CI
Re-run full matrix after commit; PostgreSQL via GitHub Actions.
