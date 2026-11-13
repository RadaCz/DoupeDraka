# P0.2 — Bell Warden E2E dokončeno

## Přesná příčina

1. **Frontend — `shouldOfferEndTurn()`** (`combatEconomy.ts`) vracelo `false`, když byly utraceny **action i bonus** (např. Attack + Second Wind v jednom tahu). Engine měl legální `end turn`, ale UI **nepřidalo tlačítko End turn** — všechny akční sloty byly disabled, zůstal jen pohyb → E2E loop čekal až do 210s timeout.

2. **Engage chip** (`attack the Bell Warden`) spotřebuje akci při vstupu do souboje (Sprint 25 economie). Driver neukončil první „poloviční“ tah přes UI **End turn** před hlavní smyčkou.

3. Sekundární: po porážce MVP obnova HP 1 + **expirovaný bearer token** při dlouhém UI fightu (401) — oprava refresh token + `reviveIfFallen` pro hp=1 na Whispering Cellar.

Žádná změna statistik Bell Wardena ani engine combat pravidel.

## Opravy

| Soubor | Změna |
|--------|--------|
| `frontend/src/combat/combatEconomy.ts` | `shouldOfferEndTurn`: nabídni End turn když `action_used \|\| bonus_action_used` |
| `frontend/src/combat/combatEconomy.test.ts` | Regrese obou slotů |
| `frontend/src/combat/combatActions.test.ts` | Regrese: deck má enabled End turn při obou spent |
| `frontend/e2e/chapter-one-e2e-helpers.ts` | `settleFreshPlayerTurnAfterEngage`, `endCombatTurnViaUiIfSpent`, token refresh, defeat/heal, bojová taktika |
| `frontend/e2e/combat-reactions.spec.ts` | Re-engage přes `startCellarCombat` (regrese po full-suite běhu) |
| P0.1 soubory | E2E RNG + BW driver (beze změny základu) |

## Validace

| Krok | Výsledek |
|------|----------|
| `pytest tests/test_rng_e2e_seed.py -q` | **6 passed** |
| Vitest | **174 passed** (včetně nových combat testů) |
| typecheck / typecheck:e2e / build | **OK** |
| Bell Warden ×3 (fresh DB) | **PASS** ~109–111s každý, `chapter_one_complete` |
| Full `npm run test:e2e` (1. běh) | BW **PASS**; fail `combat-reactions` (re-engage po API fight) — **opraveno** (`startCellarCombat`) |
| Full `npm run test:e2e` (2. běh) | BW **PASS (92s)**; phases 1–5 green; **TIMEOUT** `ghoul-paralysis-combat` (runner phase cap 120s vs test 180s) — mimo BW scope |
| `pytest -m "not slow"` | Lokálně **collection ERROR** na netrackovaném `tests/test_sprint37_4_billing_settlement.py` (mimo CI clean tree) |
| GitHub Actions | **`gh` CLI chybí**; bez push/commit nelze ověřit Actions na větvi |

## Tři běhy Bell Warden

| Run | Wall | Výsledek |
|-----|------|----------|
| `bw-p02-valid-run1.log` | 111s | PASS |
| `bw-p02-valid-run2.log` | 110s | PASS |
| `bw-p02-valid-run3.log` | 109s | PASS |

Vítězná linie končí `chapter_one_complete` v combat logu (round ~46 v run1).
