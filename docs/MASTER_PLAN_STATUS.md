# Master plan — stav (sync s DOUPEDRAKA_MASTER_PLAN.md v1.0)

Poslední revize: **2026-11-13 (Sprint 39 + repo audit)**. Aktuální pravda: [`REPO_STATUS_CURRENT.md`](REPO_STATUS_CURRENT.md). Etapy 7–9 až po staging + fyzickém QA.

**Kódový HEAD (remote):** `2f0669c9a9a12aea9437e5137b007a5551029272` = `origin/main`. **Uzavřená beta NOT READY** — staging **NOT DEPLOYED**, Telegram **NOT TESTED**, playtest **NOT TESTED**.

**CI (main):** GitHub Actions run **#43493374882** @ `2f0669c` — **5/5 success**.
**Staging HTTPS:** **NOT DEPLOYED** — viz `docs/STAGING_DEVICE_VALIDATION_V1.md`.  
**Fyzický Telegram:** Android / iOS **NOT TESTED** (`docs/TELEGRAM_MOBILE_QA_V1.md`).  
**Normal debit/refund na stagingu:** **NOT TESTED**.

| Etapa | Název | Stav | Poznámka |
|------:|-------|------|----------|
| 0 | Security & clean package | Hotovo (uživatel) | Secret scan v CI, clean export script; token rotován |
| 1 | P0 correctness | Hotovo v kódu | Idempotence, atomická energie, pending klíč ve frontendu; spell testy sjednocené s kontraktem `resolve_action` |
| 2 | Deploy & DB lifecycle | Hotovo v kódu | Alembic v003, Docker, health 503, PG job v CI |
| 3 | Ruleset v1 | Průběžně | SRD 5.1 AC + saving throws; **Action / Bonus (Sprint 25)**; **rasové vlastnosti 4 MVP ras (Sprint 26)**; **OA + Disengage (Sprint 29–30)**; reaction spells backlog |
| 4 | First campaign slice | Průběžně | `quests.py` + `/reference` katalog; side quest Crypt; hlavní quest refaktor |
| 5 | AI DM CZ | **P2 + P2.1 + P3 (WT)** | Paměť, online `scene_kind`, offline fallbacky (`offline_variety`), journal UX stream order + CZ mechaniky |
| 6 | Mini App & Telegram QA | **Kód připraven; fyzicky NOT TESTED** | Sprint 5: BackButton lifecycle, viewport E2E; `TELEGRAM_MOBILE_QA_V1.md` + `PHYSICAL_TELEGRAM_QA_V2.md` |
| 7 | Closed beta | **E2E boss VERIFIED; playtest PENDING** | `bell-warden-ui.spec.ts` + full suite green @ `188f187`; blocker = staging + fyzický Telegram + P1 UX (`docs/SPRINT_38_UX_BACKLOG.md`) |
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

```powershell
.\scripts\run_tests.ps1 fast      # diagnostika bez slow simulací
.\scripts\run_tests.ps1 full      # včetně Sprint 15 parametrizovaných simů
python scripts/secret_scan.py
cd frontend; npm run test -- --run; npm run build; npm run test:e2e
```
