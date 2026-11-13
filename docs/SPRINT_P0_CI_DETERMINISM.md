# Sprint P0 — CI determinism

## Výchozí stav

- **HEAD:** `c749986` — `fix(play): quest travel chip from corridor to shrine`
- **Cíl:** RNG E2E seed, ghoul E2E, flaky short-rest pytest — bez změny Bell Warden timeoutu (240 s).

## Změněné soubory (P0 scope)

| Soubor | Důvod |
|--------|--------|
| `app/e2e_rng.py` | Parsování `E2E_RNG_SEED` na API vrstvě |
| `app/engine/rng_state.py` | `seed_for_character`, `bind_engine_rng(..., e2e_base)` |
| `app/api.py` | `_e2e_rng_base`, předání do `bind_engine_rng` |
| `tests/test_rng_e2e_seed.py` | Regrese: opakovatelnost, persist, izolace |
| `tests/test_sprint36_1_channel_idempotency.py` | Deterministický explore + asserty combat/rest |
| `frontend/e2e/chapter-one-e2e-helpers.ts` | MVP defeat recovery + ghoul corridor prep |
| `frontend/e2e/ghoul-paralysis-combat.spec.ts` | UI combat, fast-fail engage, engine+UI paralýza |

## Testy (příkaz → výsledek → doba)

| Příkaz | Výsledek | Doba |
|--------|----------|------|
| `pytest tests/test_rng_e2e_seed.py tests/test_sprint36_1_channel_idempotency.py::test_channel_restored_only_on_short_rest -q` | **7 passed** | ~4 s |
| `npm run test:e2e -- --project=combat-saves e2e/ghoul-paralysis-combat.spec.ts` | **1 passed** | ~123 s |
| `pytest -q` (celý backend) | **810 passed, 3 failed, 3 skipped** | ~78 s |
| `npm run test:run` (Vitest) | **173 passed** | ~32 s |
| `npm run typecheck` + `typecheck:e2e` + `build` | **OK** (po TS fix ghoul) | ~32 s |

### Backend failures mimo P0 (nesouvisející dirty tree)

- `tests/test_alembic_v004.py::test_v004_follows_v003_in_revision_chain`
- `tests/test_integration.py::test_e2e_fallen_hook_is_hidden_in_normal_runs`
- `tests/test_spells.py::test_character_initialization_assigns_class_ability_and_selected_spells`

## Verdikt P0

| Oblast | Stav |
|--------|------|
| E2E RNG determinismus | **IMPLEMENTED** — ověřeno pytest |
| Short rest / Channel | **FIXED** — deterministický explore |
| Ghoul E2E | **PASS** — UI combat + paralýza engine + UI |
| Celý backend pytest | **NOT GREEN** (3 pre-existing / nesouvisející faily) |
| Commit | **Zatím ne** — čeká na výslovný souhlas |

## Co nebylo měněno

- Bell Warden 240 s timeout a mechanika
- P1 (zkrácení chapter-one-quest, docs roadmap)
- Hromadný revert / stash dirty souborů
