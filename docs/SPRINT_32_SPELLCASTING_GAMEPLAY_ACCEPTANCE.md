# Sprint 32 — Spellcasting gameplay V1

**Baseline (committed):** `36fb99c` (Sprint 31).  
**Sprint 32:** local working tree — concentration + Bless / Shield of Faith / Mage Armor + bonus-action spell rule.

## Delivered

| Area | Change |
|------|--------|
| Concentration | `app/engine/concentration.py`, fields on `CharacterState`, CON save on damage, replace on new concentration, long rest clear |
| Bless | Self, 1d4 roll persisted in `concentration_bonus`, attack + save bonus |
| Shield of Faith | Bonus action, +2 AC via `compute_armor_class` |
| Mage Armor | 13 + DEX when unarmored; long rest clears |
| Bonus-action spell rule | `spell_cast_rules.py`, Healing Word + cantrip OK |
| Reference API | `concentration`, `casting_time` on spell library |
| UI | Character sheet concentration / Mage Armor; spell detail metadata |
| Tests | `test_sprint32_spellcasting_gameplay.py`, E2E `spellcasting-gameplay.spec.ts` |

## Modeled spells (14)

Prior 11 + **Bless**, **Shield of Faith**, **Mage Armor**. **Shield** (reaction) remains catalog-only.

## Solo MVP limits

- Bless targets self only (no party).
- Concentration on Invisibility uses same stack as Bless/SoF.
- Mage Armor dormant while wearing armor (flag may remain until long rest).

## Validation (local, 2026-11-12)

| Command | Result |
|---------|--------|
| `run_tests.ps1 fast` | 674 passed, 2 skipped |
| `run_tests.ps1 regress` | 206 passed |
| `run_tests.ps1 full` | 695 passed, 2 skipped |
| `test_sprint32` | 8 passed |
| Vitest | 171 passed |
| Build / secret scan | OK |
| `spellcasting-gameplay.spec.ts` | 2 passed |
| Celý Playwright | Ne/spuštěno (doporučeno po commitu) |

**CI:** Sprint 31 `36fb99c` — verify in GitHub UI; Sprint 32 not pushed.

**Verdict:** **READY FOR REVIEW** after full local matrix green.
