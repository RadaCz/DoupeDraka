# Sprint 13 — Czech Narration & Immersion V1 (QA report)

**Baseline:** `b8c2efb` on `clean-main` (local implementation, **no commit/push** in sprint)  
**Scope:** Chapter 1 presentation only — engine IDs stay English; no XP/loot/DC/boss changes.  
**Mobile Telegram retest:** **NOT TESTED** on device in this sprint (automated + local vitest/pytest only).

## Summary

| Area | Outcome |
|------|---------|
| `narration_language` ↔ UI locale | Auto-sync on load when mismatch (`App.tsx`); Settings PATCH unchanged |
| CS offline + guard | `embed_catalog_names` after offline CS; stronger `coerce_narration_prose` EN/hybrid detection |
| Catalog cases | `localization/chapter_one_display.json` location cases + `arrival_beats_cs`; BE `display_location(..., case)` |
| Journal / map / actions | `journalActionPresent.ts`, `displayArrivalBeat`, `presentEngineEventLine` / `journalBlocks` |
| Meta on play surface | No Lite/fallback narrator banner during play (existing `App.test` guard); thinking lines stay in-world |
| Settings safe area | `character-settings.css` padding uses `--app-safe-top` |
| Offline variety | +variants in breath/rest/search/explore (`offline_prose.py`, `offline_variety.py`) |

## QA mapping (Telegram findings → fix)

| Finding (EN/hybrid) | Layer | Primary files | CS after (example) | Test |
|---------------------|-------|---------------|--------------------|------|
| `You probe…` / full EN paragraphs | Guard + offline | `narration_prose_guard.py`, `offline.py` | Czech offline beat | `test_narration_language.py`, `test_stream_cs_language.py` |
| `search The Forgotten Crypt` in journal header | FE present | `journalActionPresent.ts`, `JournalBeatCard.tsx` | `Prohledat: Zapomenutá krypta` | `journalActionPresent.test.ts` |
| EN `arrival_beat` on map | Catalog + map | `chapter_one_display.json`, `MapScreen.tsx` | CS beat from `arrival_beats_cs` | `test_display_localization_cases.py` |
| `v The Forgotten Crypt` (wrong case) | Catalog + offline | `display_localization.py`, `offline_prose.py` | `v zapomenuté kryptě` | `test_display_localization_cases.py` |
| EN mechanic lines in journal | FE present | `gameDisplay.ts`, `journalBlocks.tsx` | Localized rolls/HP/discovery | `gameDisplay.test.ts` |
| UI CS but `narration_language=en` | FE sync | `App.tsx` | PATCH to `cs` when UI is CS | `App.test.tsx` (sync case) |
| Visible “built-in offline storyteller…” on play | FE play | `sharedPlayUI.tsx` (no Lite banner) | (hidden) | `App.test.tsx` |

## Test matrix (executed locally)

**pytest (37 passed):**  
`test_display_localization.py`, `test_display_localization_cases.py`, `test_narration_language.py`, `test_stream_cs_language.py`, `test_immersion_narration.py`, `test_offline_cs_scenarios.py`

**vitest:**  
`journalActionPresent.test.ts`, `gameDisplay.test.ts`, `narrationPresentationPath.test.ts`, `CharacterInventoryPanel.test.ts`, `App.test.tsx` (19 tests)

## EN regression

- `narration_language=en` unchanged; EN stream deltas still allowed (`test_en_stream_still_emits_deltas`).
- Engine event strings in DB remain English; only presentation layers translate.

## Open / follow-up

- Physical Telegram safe-area / inventory layout — **NOT TESTED** on hardware.
- Long-tail EN mechanic lines not in `MECHANIC_PATTERNS_CS` may still appear until added.
- User who deliberately keeps EN narration while UI is CS will be overwritten on load by design (Sprint 13 A1); switch EN in Settings after load if needed.
