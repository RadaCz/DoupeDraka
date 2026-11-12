# Sprint 35 / 35.1 — Level-Up & Character Progression (acceptance)

Last updated: **2026-11-12** (35.3 inventory E2E + full Playwright matrix; **uncommitted** on `clean-main`).

## MVP progression (not SRD XP table)

| Rule | Authority | Notes |
|------|-----------|--------|
| XP per level | 100 | `GameEngine.XP_THRESHOLD`, `chapter_one_progression.XP_PER_LEVEL` |
| Level cap | 3 | `MAX_MVP_LEVEL` |
| Chapter One total | ~200 XP | Unchanged story rewards → L3 via quest + combat |
| **Combat XP** | `_grant_xp` | Adds XP, then **at most one** `_level_up` per kill resolution; excess XP banks (e.g. 250 XP kill → L2 + 50 XP leftover at 150 before next kill applies again) |
| **Story / quest XP** | `apply_xp_with_level_ups` | Loops `_level_up` until `xp < 100` or cap; idempotent flags via `grant_idempotent_story_xp` |
| Dead character | `_level_up` | **No level-up while `hp <= 0`**; XP is not spent; story loop breaks if blocked |

## HP on level-up (MVP)

Average hit die \((die // 2) + 1\) plus CON modifier, minimum gain **1**.  
`max_hp` and `current_hp` both increase by `hp_gained` (wounds preserved; **no revive** at 0 HP).

| Class | Die | Base avg |
|-------|-----|----------|
| Fighter | d10 | 6 |
| Rogue / Cleric | d8 | 5 |
| Wizard | d6 | 4 |

## Class features L1–L3

### Mechanically implemented

| Class | Feature | Level |
|-------|---------|-------|
| Fighter | Fighting Style, Second Wind | 1 |
| Fighter | **Action Surge** | 2 |
| Rogue | Expertise, Sneak Attack | 1 |
| Rogue | **Cunning Action — Hide** (bonus action, L2+) | 2 |
| Cleric | Life domain, spellcasting, Disciple of Life on heals | 1 |
| Wizard | Arcane Recovery, spellbook / prepared | 1 |

### Partial

| Class | Feature | State |
|-------|---------|-------|
| Rogue | Cunning Action | **Hide only** as bonus action; **Dash** and **bonus Disengage** deferred |
| All | Disengage combat action | Main **action** (not Rogue Cunning Action bonus) — `DISENGAGE` intent |

### Deferred / narrative

| Class | Feature | UI / journal |
|-------|---------|--------------|
| Cleric | Channel Divinity | `class_features_deferred` + “Coming later” in LevelUpModal; not in combat UI |
| Wizard | Arcane Tradition | Same deferred treatment at L2 |
| Fighter | Martial Archetype | L3+ not in MVP |

## Spell slots (full casters L1–L3)

SRD slice: L1 `{1:2}`, L2 `{1:3}`, L3 `{1:4, 2:2}`.  
Fighter/Rogue: no slots. Level-up increases capacity via `advance_spellcasting`; does not refill spent slots.

## Persistence

- `action_surge_available` on `CharacterState` (default `False`); legacy backfill via `reconcile_level_gated_features`.
- Level-up facts: `class_features_gained`, `class_features_deferred`, spell slot snapshots.
- Action idempotency unchanged (`ActionReceipt` + `Idempotency-Key`).

## Tests

| Suite | Path |
|-------|------|
| Sprint 35 core | `tests/test_sprint35_level_progression.py` |
| Sprint 35.1 audit | `tests/test_sprint35_1_progression_validation.py` |
| Story / chapter | `tests/test_sprint15_story_progression.py` (slow) |
| E2E level path | `frontend/e2e/level-progression.spec.ts` |
| E2E inventory / shop | `frontend/e2e/inventory-gameplay.spec.ts` + `earnChapterOneShopGold` in `chapter-one-e2e-helpers.ts` |

## Sprint 35.3 — Chapter One shop gold (E2E)

Deterministic engine rewards (Folk Hero fighter, **45 gp** healing potion at Nib):

| Step | Engine reward | Flag |
|------|----------------|------|
| Folk Hero start | ~10 gp (`pouch with 10 gp`) | — |
| Return shrine bell | +10 gp (`QUEST_BELL_RETURN_GOLD_GP`) | `bell_quest_complete` |
| Talk to Caldus after bell | vault route | `vault_unlocked` |
| Search Forgotten Crypt | +15 gp (`CRYPT_RELIC_GOLD_GP`) | `crypt_relic_claimed` |
| Bandit Camp (stealth/social or captain combat) | +20 gp (`BANDIT_CAMP_EVIDENCE_GOLD_GP`) | `bandit_shrine_evidence` |
| Fallback explore scavenges | up to 1d4 gp per location (d6=3) | `gold_scavenge_*` |

Travel uses only **`travel_allowed` hops** (crypt via Sunken → Underground River; vault optional for crypt).

## Verification status (2026-11-12 local, Sprint 35.3)

| Gate | Result |
|------|--------|
| `run_tests.ps1 fast` | 746 passed |
| `run_tests.ps1 regress` | 278 passed |
| `run_tests.ps1 full` | 767 passed |
| `run_tests.ps1 slow` | 21 passed (Sprint 15 matrix) |
| Vitest | 171 passed |
| `npm run build` | OK |
| `secret_scan.py` | OK |
| Playwright full matrix (6 phases) | **42 passed** (~7.8 min) |
| `inventory-gameplay.spec.ts` (isolated) | **PASS** |
| PostgreSQL / Alembic CI | **Not re-run** (no new commit; awaiting CI on push) |
| Physical Telegram | NOT TESTED |

## Verdict

**READY FOR REVIEW** (Sprint 35) — level-up engine, E2E level path, inventory/shop E2E, ghoul 35.1.1 fix, and full local regression + Playwright matrix green. No commit in this closeout.
