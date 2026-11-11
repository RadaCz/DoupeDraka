# Master plan — stav (sync s DOUPEDRAKA_MASTER_PLAN.md v1.0)

Poslední revize: **2026-11-11 (Sprint 23 — skill checks & player agency; lokálně, necommitováno)**. Etapy 7–9 záměrně otevřené až po uzavření sólo smyčky.

**Kódový HEAD (commit):** `9e7fbac` na `clean-main` (= `origin/clean-main`). **Sprint 22:** commitnutý — viz `docs/SPRINT_22_CHAPTER_ONE_GAMEPLAY_ACCEPTANCE.md`. **Sprint 23:** viz `docs/SPRINT_23_SKILL_CHECKS_PLAYER_AGENCY_ACCEPTANCE.md`.

**CI (baseline `9e7fbac`):** GitHub Actions run **`43061224115`** — GREEN (pytest 596, PostgreSQL 10, Vitest 161, E2E 31, build + secret scan). **Sprint 23 diff** — ověřit lokálním během před commitem.
**Staging HTTPS:** **NOT DEPLOYED** — viz `docs/STAGING_DEVICE_VALIDATION_V1.md`.  
**Fyzický Telegram:** Android / iOS **NOT TESTED** (`docs/TELEGRAM_MOBILE_QA_V1.md`).  
**Normal debit/refund na stagingu:** **NOT TESTED**.

| Etapa | Název | Stav | Poznámka |
|------:|-------|------|----------|
| 0 | Security & clean package | Hotovo (uživatel) | Secret scan v CI, clean export script; token rotován |
| 1 | P0 correctness | Hotovo v kódu | Idempotence, atomická energie, pending klíč ve frontendu; spell testy sjednocené s kontraktem `resolve_action` |
| 2 | Deploy & DB lifecycle | Hotovo v kódu | Alembic v003, Docker, health 503, PG job v CI |
| 3 | Ruleset v1 | Průběžně | SRD 5.1 AC + **player saving throws in play** (`saving_throws.py`, hazards/enemy riders); iniciativa/ekonomie akcí — backlog |
| 4 | First campaign slice | Průběžně | `quests.py` + `/reference` katalog; side quest Crypt; hlavní quest refaktor |
| 5 | AI DM CZ | **P2 + P2.1 + P3 (WT)** | Paměť, online `scene_kind`, offline fallbacky (`offline_variety`), journal UX stream order + CZ mechaniky |
| 6 | Mini App & Telegram QA | **Kód připraven; fyzicky NOT TESTED** | Sprint 5: BackButton lifecycle, viewport E2E; `TELEGRAM_MOBILE_QA_V1.md` + `PHYSICAL_TELEGRAM_QA_V2.md` |
| 7 | Closed beta | **Připraveno protokolem; E3 playtest neběžel** | `CLOSED_BETA_ONBOARDING_V1.md`, CHAPTER_ONE_PLAYTEST; blocker = fyzické QA Android/iOS |
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
