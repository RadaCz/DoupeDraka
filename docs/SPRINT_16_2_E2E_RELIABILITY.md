# Sprint 16.2 — E2E Reliability & Runtime Optimization

**Baseline:** `ab3aaec` (`feat(character): SRD 5.1 creation v2…`)  
**CI reference:** GitHub Actions run `42992223490` — 22/23 passed; `play-layout` @ 360×800 failed at `telegram.ts:103` (`Create your character` not found, 120s × retry).  
**Policy:** No commit / push in this sprint.

---

## Root cause (CI failure)

Two independent issues:

1. **Locale pollution (primary CI narrative):** Serial Playwright context + `locale.spec.ts` sets `app_locale=cs`. Later specs still had English-only selectors (`/create your character/i`), while UI shows **Vytvořit postavu**. Same failure mode as run `42992223490` when `locale.spec` precedes `play-layout`.

2. **Telegram user ID collision (local full-suite repro):** `play-layout.spec.ts` used `760_100_000 + index` → `760100001` collides with `character-creation-wizard` caster test. Home showed **Welcome back** (no create CTA) → helper timeout.

Not a viewport/rendering defect at 360×800.

---

## Fixes

| Area | Change |
|------|--------|
| `telegram.ts` | `addInitScript` resets `app_locale=en`, clears stale `active_character_id` / `api_token`; bilingual patterns; `openCharacterCreation()` with diagnostics; returning-user path via More → Create another adventurer |
| `test-config.ts` | Documented non-overlapping Telegram ID bands per spec file |
| `play-layout.spec.ts` | IDs → `762_200_000 + index` |
| `player-journey-hub.spec.ts` | IDs → `763_000_000 + worker` (avoid `760000001` clash) |
| `chapter-one-e2e-helpers.ts` | Tighter `waitForActionRound` (45s), faster quest-flag poll intervals; vault descent actively fights/grinds; boss loop cap 200 (was 400) |
| `chapter-one-quest.spec.ts` | Phase timing `console.info` for profiling |
| `playwright.config.ts` | `list` + `line` reporters (per-test durations) |
| Viewport / creation specs | `HOME_HEADING` + shared helpers |

**Not changed:** `workers: 1`, chapter UI path, RNG seed ordering, retries in CI.

---

## Timings (local, after fix)

### Full suite (23 tests)

| Run | Result | Wall clock |
|-----|--------|------------|
| 1 (pre ID fix) | 22/23 — `play-layout` 360×800 | ~4.3 min |
| 2 | **23/23** | **4.1 min** |
| 3 | **23/23** | **3.9 min** |

### `chapter-one-quest.spec.ts` phases (typical)

```
wizard≈1.3s  travel_shrine≈25s  caldus_quest≈126s  vault_unlocked≈1s
vault_descent_l3≈3s  boss_complete≈1s  total≈160s
```

Chapter journey **~2.7 min** (down from ~6 min reported for run `42992223490`).  
**caldus_quest** (~126s) remains the bottleneck: real UI chip + narration round-trips through Goblin Market / Nib / return bell arc.

**5 min whole-suite target:** Not met without removing checks (~4 min actual). Dominant cost is one intentional full UI quest chain; engine helpers already cover vault descent + Bell Warden.

### Per-test smoke highlights (run 3)

| Test | ~Duration |
|------|-----------|
| chapter-one journey | 2.7m |
| adventure + journal reload | 3.7s |
| character-creation ×4 | 2–4s each |
| play-layout ×4 | 3.4–3.8s each |
| mobile-viewports ×5 | 3.6–4.0s each |
| locale (CS) | 3.7s |

---

## Other verification

| Suite | Result |
|-------|--------|
| Vitest | 153 passed |
| `npm run build` | OK |

---

## Changed files

- `frontend/e2e/telegram.ts`
- `frontend/e2e/test-config.ts`
- `frontend/e2e/playwright.config.ts`
- `frontend/e2e/play-layout.spec.ts`
- `frontend/e2e/mobile-viewports.spec.ts`
- `frontend/e2e/character-creation-wizard.spec.ts`
- `frontend/e2e/chapter-one-e2e-helpers.ts`
- `frontend/e2e/chapter-one-quest.spec.ts`
- `frontend/e2e/player-journey-hub.spec.ts`
- `docs/SPRINT_16_2_E2E_RELIABILITY.md`
- `docs/PRODUCT_GAP_REGISTER_V1.md` (E2E row)

---

## Commit readiness

Ready for a focused `fix(e2e):` commit after review. Staging docs 15.3 remain untracked/uncommitted.

**STOP** — no git commit performed.
