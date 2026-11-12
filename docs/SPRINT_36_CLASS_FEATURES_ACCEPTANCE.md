# Sprint 36 / 36.1 — Class Identity & Real Class Features V1 (acceptance)

Last updated: **2026-11-12** (Sprint **36.1** E2E + gates; **uncommitted** on `clean-main` @ `354e510`).

## Status matrix

| Class | Feature | Level | Status | Engine | UI | E2E |
|-------|---------|-------|--------|--------|-----|-----|
| Fighter | Fighting Style, Second Wind | 1 | **IMPLEMENTED** | `class_features.py` | Combat + sheet | regress |
| Fighter | Action Surge | 2 | **IMPLEMENTED** | `use_action_surge` | Combat | regress |
| Rogue | Sneak Attack, Expertise | 1 | **IMPLEMENTED** | combat + skills | Sheet | regress |
| Rogue | Cunning Action — Hide | 2 | **IMPLEMENTED** | `try_hide_in_combat` | Bonus combat | `rogue-cunning-action.spec.ts` |
| Rogue | Cunning Action — Dash | 2 | **IMPLEMENTED** | `use_cunning_dash` | Bonus combat | `rogue-cunning-action.spec.ts` |
| Rogue | Cunning Action — Disengage | 2 | **IMPLEMENTED** | `use_cunning_disengage` | Bonus disengage | `rogue-cunning-action.spec.ts` |
| Rogue | (non-rogue) Disengage | — | **IMPLEMENTED** | action disengage | Combat | `rogue-cunning-action.spec.ts` (fighter) |
| Cleric | Life Domain spells, Disciple of Life | 1 | **IMPLEMENTED** | spells / heals | Sheet | regress |
| Cleric | Channel Divinity — Preserve Life | 2+ | **IMPLEMENTED** | `use_preserve_life` | Combat action when in fight | `cleric-channel-divinity.spec.ts` |
| Cleric | Channel Divinity — Turn Undead | 2+ | **IMPLEMENTED** | `use_turn_undead` | Combat vs skeleton/ghoul/zombie | `cleric-channel-divinity.spec.ts` |
| Cleric | Other domains | — | **COMING LATER** | MVP Life only | — | — |
| Wizard | Arcane Recovery | 1 | **IMPLEMENTED** | `use_arcane_recovery` | Sheet chips | `class-identity.spec.ts` |
| Wizard | Arcane Tradition (school) | 2+ | **COMING LATER** | deferred in level-up facts | LevelUpModal | no fake mechanics |

## Resource rules

| Resource | Recharge | Field | Verified (36.1) |
|----------|----------|-------|------------------|
| Action Surge | Short rest | `action_surge_available` | pytest 35.1 |
| Channel Divinity | Short / long rest | `channel_divinity_available` | E2E short rest + legacy payload pytest |
| Second Wind | Short / long rest | `second_wind_available` | class-identity |
| Arcane Recovery | Long rest (+ short rest gate) | `arcane_recovery_*` | class-identity |

## Idempotence & persistence (36.1)

| Check | Coverage |
|-------|----------|
| Legacy save without `channel_divinity_available` | `test_sprint36_1_channel_idempotency.py` |
| `Idempotency-Key` replay on Preserve Life | API `/actions` + E2E stream |
| Short rest restores CD; explore alone does not | pytest + E2E |
| Turn Undead kill exits combat without server crash | `service.py` kill path + pytest |

## Tests

| Suite | Path | Count |
|-------|------|-------|
| Sprint 36 core | `tests/test_sprint36_class_features.py` | **13** |
| Sprint 36.1 CD / API | `tests/test_sprint36_1_channel_idempotency.py` | **4** |
| Rogue Cunning E2E | `frontend/e2e/rogue-cunning-action.spec.ts` | 2 cases |
| Cleric Channel E2E | `frontend/e2e/cleric-channel-divinity.spec.ts` | 1 case |

## Verification (local, 2026-11-12 — Sprint 36.1)

| Gate | Sprint 35.3 @ `354e510` | Sprint 36.1 local |
|------|-------------------------|-------------------|
| fast | 758 | **763** passed, 2 skipped, 21 deselected |
| regress | 290 | **295** passed |
| full | 779 | **784** passed, 2 skipped |
| slow | 21 | **21** passed |
| Vitest | 171 | **171** passed |
| build | OK | OK |
| secret_scan | OK | OK |
| Playwright matrix | 42/42 | **45/45** (single `npm run test:e2e`) |
| GitHub Actions | green on `354e510` | **not run** (no push) |

## Verdict

**READY FOR REVIEW** (local) — Rogue + Cleric E2E green, full Playwright matrix green, pytest/Vitest/build/secret_scan green, idempotence and CD persistence covered. Push required for GitHub Actions confirmation. Wizard Arcane Tradition remains **COMING LATER**.
