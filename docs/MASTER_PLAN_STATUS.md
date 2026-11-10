# Master plan — stav (sync s DOUPEDRAKA_MASTER_PLAN.md v1.0)

Poslední revize: **2026-11-10 (Localization V3 / V3.1)**. Etapy 7–9 záměrně otevřené až po uzavření sólo smyčky.  
**Kódový HEAD (audit):** `f8ce5b1` na `clean-main`; V3.1 změny mohou být lokální diff.  
**CI:** ověř `gh run list --commit <HEAD>` — agent čísla pytest/Vitest uvádí jako lokální report, ne jako náhradu Actions.

| Etapa | Název | Stav | Poznámka |
|------:|-------|------|----------|
| 0 | Security & clean package | Hotovo (uživatel) | Secret scan v CI, clean export script; token rotován |
| 1 | P0 correctness | Hotovo v kódu | Idempotence, atomická energie, pending klíč ve frontendu; spell testy sjednocené s kontraktem `resolve_action` |
| 2 | Deploy & DB lifecycle | Hotovo v kódu | Alembic v003, Docker, health 503, PG job v CI |
| 3 | Ruleset v1 | Průběžně | `ruleset_v1.py` + MVP lock při tvorbě; UI „Planned“; iniciativa/akce — backlog |
| 4 | First campaign slice | Průběžně | `quests.py` + `/reference` katalog; side quest Crypt; hlavní quest refaktor |
| 5 | AI DM CZ | **P2 + P2.1 + P3 (WT)** | Paměť, online `scene_kind`, offline fallbacky (`offline_variety`), journal UX stream order + CZ mechaniky |
| 6 | Mini App & Telegram QA | **Kód připraven; fyzicky NOT TESTED** | V2/V3 checklist `PHYSICAL_TELEGRAM_QA_V2.md`; historické §N nálezy beze změny; agent nevyplňuje PASS na telefonu |
| 7 | Closed beta | **E1–E2b + minimální telemetrie implementováno** (lokální audit nad `e012532`); **E3 pozastaveno** | Postgres migrace **v005**, CI/dev deps, racial bonusy, vault hint, tier billing; playtest 10–15 hráčů ať po sign-off commitu |
| 8 | Co-op MP | Nezačato | Záměrně po sólo kapitole |
| 9 | Monetizace | Nezačato | GDS01 pilíře v dokumentaci; hypotézy 49/99/149 Kč v `ECONOMY_MODEL_V1.md`; **žádné platby** před playtestem a produktovým go (E6 až po validaci) |

## Backlog §13 (zkráceně)

| # | Položka | Stav |
|---|---------|------|
| 1 | Rotace tokenů | Uživatel |
| 2 | Concurrency + location testy | Hotovo |
| 3–4 | Idempotence / dual-character energy | Hotovo + `tests/test_concurrency.py` |
| 5 | Frontend pending SSE | Hotovo (`pendingTurn`, retry) |
| 6 | Alembic + Docker | Hotovo |
| 7 | CI clean checkout | Hotovo (tento repo) |
| 8 | Telegram launcher QA | Checklist připraven |
| 9 | Ruleset 5.1 lock | `design/RULESET_v1.md` |
| 10 | CZ locale + tiers | CZ tok + lite-only bez AI |

## Ověření (release gate)

```bash
python -m pytest -q   # lokální počty viz CHANGELOG / agent report; nefixujte bez CI na HEAD
python scripts/secret_scan.py
cd frontend && npm run test -- --run && npm run build && npm run test:e2e
```
