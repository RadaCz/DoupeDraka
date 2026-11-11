# Sprint 21 / 21.1 — Class identity V1 (acceptance)

**Datum:** 2026-11-11  
**Git baseline (commit):** `8b913cf` (`origin/clean-main`) — Sprint 21 pouze v **working tree** (necommitováno).  
**Stav Sprint 21.1:** **READY FOR COMMIT** po zelené verifikaci níže.

## Cíl

Čtyři MVP třídy mají engine-authoritative level‑1 identitu podle SRD 5.1 (2014): Fighting Style / Second Wind, Expertise / Sneak Attack / Hide, Life Domain / Disciple of Life, spellbook vs prepared / Arcane Recovery.

## SRD — Arcane Recovery (Wizard)

| Pravidlo | Engine |
|----------|--------|
| Počet obnovených **úrovní** slotů ≤ `ceil(level/2)` (lvl 1 → 1) | `arcane_recovery_slot_levels()` |
| Obnova až do `max_spell_slots`, ne nad cap | `use_arcane_recovery()` |
| 1× použití po krátkém odpočinku v cyklu long restu | `arcane_recovery_available` / `arcane_recovery_ready` |
| Krátký odpočinek **neobnoví** sloty sám | short rest + `on_short_rest_class_features` jen `ready` |
| Long rest resetuje dostupnost | `on_long_rest_class_features()` |
| Intent: `take a breather`, `short rest`, … | `REST_PATTERN` + `SHORT_REST_VERBS` v `service.py` |

## Mechaniky (engine)

| Třída | Feature | Ověření |
|-------|---------|---------|
| Fighter | Defense +1 AC, Dueling +2 dmg, Second Wind 1×/rest | `tests/test_class_identity_sprint21.py` |
| Rogue | Expertise 2× prof, Sneak Attack 1d6 + advantage/hidden, Hide | stejné |
| Cleric | Life domain spells, Disciple +2+level on heals | stejné + `spell_facts` |
| Wizard | 6 spellbook, prepared int+level, Arcane Recovery | stejné + E2E |

## E2E (21.1)

- `frontend/e2e/class-identity.spec.ts` — spend slot → combat end → short rest → **bez** auto-restore → arcane recovery → sloty na cap; persistence marker pro všechny 4 třídy.
- `mobile-text-first.spec.ts` — oprava **B** (lokalizované role názvy + `waitForAdventureComposerIdle`; scroll helper tolerantnější vůči stream timing).

## Verifikace (2026-11-11, lokálně)

| Vrstva | Výsledek |
|--------|----------|
| `pytest -q` | **593 passed**, 2 skipped |
| `tests/test_class_identity_sprint21.py` | **11 passed** |
| Vitest | **160 passed** (42 files) |
| `npm run build` | OK |
| `scripts/secret_scan.py` | OK |
| E2E full (`run-tests.mjs` 3 fáze) | **31 passed** (chapter 1 + combat-saves 3 + smoke 27) |

### Dřívější E2E selhání (před 21.1)

1. **class-identity** — `take a breather` nešlo do REST intentu; API 500 na `int` vs `str` klíče slotů; křehká reload asercece (`""` fighting_style).
2. **mobile-text-first** — české UI labely + scroll před dokončením streamu.

## Záměrně mimo scope

- Všechny fighting styles / domény SRD, plný bonus-action model, multi-class, každá kombinace race×class v Playwright.

## Navržený commit message

```
feat(engine): Sprint 21 class identity — four MVP classes and Arcane Recovery

Fighter/Rogue/Cleric/Wizard level-1 features in engine, API, UI; targeted pytest
and class-identity E2E; fix short-rest intent and arcane slot key coercion.
```
