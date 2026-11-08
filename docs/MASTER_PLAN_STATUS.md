# Master plan — stav (sync s DOUPEDRAKA_MASTER_PLAN.md v1.0)

Poslední revize: 2026-03-29. Etapy 7–9 záměrně otevřené až po uzavření sólo smyčky.

| Etapa | Název | Stav | Poznámka |
|------:|-------|------|----------|
| 0 | Security & clean package | Hotovo (uživatel) | Secret scan v CI, clean export script; token rotován |
| 1 | P0 correctness | Hotovo v kódu | Idempotence, atomická energie, pending klíč ve frontendu; spell testy sjednocené s kontraktem `resolve_action` |
| 2 | Deploy & DB lifecycle | Hotovo v kódu | Alembic v003, Docker, health 503, PG job v CI |
| 3 | Ruleset v1 | Průběžně | `ruleset_v1.py` + MVP lock při tvorbě; UI „Planned“; iniciativa/akce — backlog |
| 4 | First campaign slice | Průběžně | `quests.py` + `/reference` katalog; side quest Crypt; hlavní quest refaktor |
| 5 | AI DM CZ | Průběžně | `narration_language`, offline CS, prose guard telemetry |
| 6 | Mini App & Telegram QA | Hotovo (uživatel) | Checklist vyplněn; CS chips; frontend polish fáze 0–6 (theme-dark, play, polish moduly, `styles/README.md`, volitelný `e2e/visual-baseline.spec.ts`) |
| 7 | Closed beta | Nezačato | Telemetry částečně (`analytics_events`) |
| 8 | Co-op MP | Nezačato | Záměrně po sólo kapitole |
| 9 | Monetizace | Nezačato | Lite-only bez LLM provideru; Pro vypnuto |

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
python -m pytest -q
python scripts/secret_scan.py
cd frontend && npm run test -- --run && npm run build && npm run test:e2e
```
