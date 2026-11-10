# Sprint 15.1 — CI Regression Fix (no gameplay change)

**Datum:** 2026-11-10  
**HEAD (start):** `c0a6432`  
**Branch:** `clean-main`  
**CI run:** [42880229614](https://github.com/RadaCz/DoupeDraka/actions/runs/42880229614)  
**Commit/push:** **neprovedeno** (čeká na schválení)

---

## Git / E2E run #47

| Kontrola | Výsledek |
|----------|----------|
| HEAD | `c0a6432294f5c41dbcefabc0b0199e14bd5768e3` |
| Branch | `clean-main`, sync s `origin` |
| Untracked | zachováno (pytest logy, `data/`, `tools/audit_cs_suspects.py`) |
| E2E job finální stav | **Neověřeno z tohoto prostředí** — GitHub API vrátilo 404 (pravděpodobně privátní repo / bez tokenu). Vstupní report: backend FAIL (2), frontend FAIL (1), e2e **stále běžel**. Lokální E2E chapter **nespuštěno** (vyžaduje běžící API + Playwright stack). |

---

## Příčiny a opravy

### 1. Frontend — `displayCatalogParity.test.ts`

| | |
|--|--|
| **Příčina** | Sprint 13 převedl `chapter_one_display.json` lokace na objekty s `nom`…`ins`; `LOCATION_CS` exportuje **nominativ** (`locationNom()`), test porovnával celý objekt vs. string. |
| **Kontrakt** | FE `LOCATION_CS[id]` = JSON `locations[id].nom`; pády zůstávají v JSON pro backend / budoucí FE. |
| **Oprava** | Test porovnává `LOCATION_CS[en]` s `entry.nom` (nebo flat string). |
| **Soubor** | `frontend/src/integration/displayCatalogParity.test.ts` |

### 2. Backend — `test_defeat_respawn_location_localized_cs`

| | |
|--|--|
| **Příčina** | CS offline defeat používá `display_location(..., "loc")` → „v **šeptajícím sklepu**“; test očekával nominativ „Šeptající sklep“. |
| **Oprava** | Assertion na lokál ve větě (`šeptajícím sklepu`), bez anglického ID. |
| **Soubor** | `tests/test_offline_display_cs.py` |

### 3. Backend — `test_level_up_only_advances_one_level_per_resolved_turn`

| | |
|--|--|
| **Příčina** | Sprint 15 rozšířil `GameEngine._grant_xp` o smyčku `_level_up` → jeden boj s 250 XP dal L2→L3 v **jednom** `resolve_action` tahu. |
| **Invariant** | **Combat XP:** maximálně **jeden** level-up za jeden vyřešený tah (existující gameplay test). |
| **Story XP** | Beze změny: `apply_xp_with_level_ups` v `chapter_one_progression.py` může levelovat vícekrát **pouze** v quest/story grantech (oddělené události nebo větší jednorázové story balíky — ne v `_grant_xp`). |
| **Oprava** | Vrácení `_grant_xp` k jednomu volání `_level_up`; story cesta 30+50+35+85 zůstává přes více tahů + `apply_xp_with_level_ups`. |
| **Soubor** | `app/engine/service.py` |

**Boss gate / rewards / story flagy:** beze změny.

---

## Ověření (lokálně)

| Sada | Výsledek |
|------|----------|
| 3 původně failing testy | **PASS** |
| `tests/test_sprint15_story_progression.py` | **29 PASS** |
| Celý `pytest` | **506 passed**, 2 skipped |
| Celý `vitest` | **153 passed** (40 souborů) |
| `npm run build` | **OK** |
| E2E chapter journey | **NOT RUN** lokálně |
| `simulate_story_main_path.py` | všechny třídy/seedy **OK** (žádný FAIL) |
| `ensureLevelAtLeast` / topup v chapter E2E | **není** v `chapter-one-quest.spec.ts` |

---

## Změněné soubory (15.1)

- `frontend/src/integration/displayCatalogParity.test.ts`
- `tests/test_offline_display_cs.py`
- `app/engine/service.py` (`_grant_xp` revert smyčky)

---

## Zbylé riziko

- **E2E** na CI po pushi 15.1 stále vyžaduje potvrzení na GitHubu (vault descent flow, timeout).
- Pokud by jeden quest krok někdy dal **≥200 XP** přes `apply_xp_with_level_ups` v jednom tahu, mohl by porušit „jeden level za tah“ — dnes story granty jsou rozdělené; monitorovat.

---

*Sprint 16 nezačínán. Čeká na schválení commit/push.*
