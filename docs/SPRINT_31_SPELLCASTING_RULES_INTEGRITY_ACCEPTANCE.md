# Sprint 31 — Spellcasting rules integrity V1

**Baseline (committed):** `b124063` = `origin/clean-main` (Sprint 30).  
**Sprint 31:** local working tree — audit + hardening, no spell catalog expansion.

## Sprint 30 release gate (CI)

| Item | Status |
|------|--------|
| Commit `b124063` on `origin/clean-main` | **Yes** (user push) |
| GitHub Actions (this environment) | **Not queried** — `gh` CLI missing; public API returned 404 (private repo). **Verify manually** in GitHub Actions for commit `b124063`. |
| Local PostgreSQL | Not assumed |

## Audit summary

### Engine

- **Catalog:** full SRD list in `reference.SPELLS` / `srd_spells.json`.
- **Modeled effects:** 11 spells in `MODELED_SPELL_EFFECTS` (see `docs/SPELLCASTING_CONTRACT_V1.md`).
- **Resolution:** `_cast_spell` in `service.py` — authoritative.
- **Saves:** `spell_saves.py` → `saving_throws.perform_monster_saving_throw`.
- **Slots / rest:** long rest restores all slots; short rest does not (Wizard Arcane Recovery is separate).
- **Concentration:** **not implemented** (except Invisibility flag).
- **Bless / Shield / most starters:** sheet + catalog only; `effect_modeled: false` in API.

### Gap fixed (Sprint 31)

| Gap | Fix |
|-----|-----|
| Fighter/Rogue could cast if `known_spells` tampered | Reject when `character_class not in CASTER_CLASSES` |

### Deferred

- SRD concentration system (Bless, Shield of Faith, etc.)
- Bonus-action + leveled spell same turn restriction
- Full spell range / AoE geometry
- Multiclass, full spellbook, Shield reaction

## Deliverables

- `docs/SPELLCASTING_CONTRACT_V1.md` — authoritative MVP contract
- `app/engine/service.py` — non-caster cast gate
- `tests/test_sprint31_spellcasting_integrity.py`
- `frontend/e2e/spellcasting-integrity.spec.ts`
- `frontend/e2e/test-config.ts` — `spellIntegrity` ID band

## Validation (local, 2026-11-12)

| Command | Result |
|---------|--------|
| `.\scripts\run_tests.ps1 fast` | 667 passed, 2 skipped |
| `.\scripts\run_tests.ps1 regress` | 199 passed |
| `python scripts/secret_scan.py` | OK |
| `cd frontend; npm run test:run` | 171 passed |
| `cd frontend; npm run build` | OK |
| `test_spells.py` + `test_sprint31_spellcasting_integrity.py` | 18 + 9 passed |
| `npm run test:e2e e2e/spellcasting-integrity.spec.ts` | 2 passed |

Full Playwright matrix not re-run this session (Sprint 30 baseline 40/40 on `b124063`).

## Status legend

| | Sprint 31 |
|---|-----------|
| Implemented | Contract doc + caster gate + tests |
| Tested locally | Matrix above |
| Verified GitHub CI | Sprint 30 `b124063` — **confirm in GitHub UI** (no `gh` here); Sprint 31 not pushed |
| Deferred | Concentration, unmodeled spells, SRD bonus-cast rule |

**Verdict:** **READY FOR REVIEW** (local gates green; CI PostgreSQL on next push).
