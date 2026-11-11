# Sprint 15.3.1 — Staging Documentation Truth Sync

**Cíl:** Sjednotit repo baseline vs runtime staging v hlavních staging dokumentech a propojit výstup Sprintu 15.3 s runbookem. Žádné změny herního kódu ani infrastruktury.

---

## 1. Git precheck

| Kontrola | Stav | Důkaz |
|----------|------|-------|
| HEAD | **PASS** | `50a88900756792d72284b40fb162f5639a5c29e9` |
| Branch | **PASS** | `clean-main` |
| Origin sync | **PASS** | `Your branch is up to date with 'origin/clean-main'.` |
| Destruktivní git | **PASS** | nepoužito reset/clean/stash/checkout/revert |
| Untracked zachováno | **PASS** | pytest logy, `data/`, `tools/audit_cs_suspects.py`, sprint docs |
| Tracked herní kód | **PASS** | žádné změny mimo `docs/` |

**Working tree:** 3 upravené tracked soubory (`docs/DEPLOYMENT.md`, `docs/STAGING_DEVICE_VALIDATION_V1.md`, `docs/STAGING_RUNBOOK_V1.md`); untracked `docs/SPRINT_15_3_STAGING_AND_PLAYER_VALIDATION.md`, tento soubor.

---

## 2. Dokumentační audit — baseline hashe

**Pravidlo:** *Repo baseline (audit)* = aktuální ověřený HEAD pro deploy přípravu. *Poslední nasazený commit* = runtime; zůstává **NOT DEPLOYED**, dokud neexistuje důkaz deploye.

| Soubor | Před 15.3.1 | Po 15.3.1 | Význam pole |
|--------|-------------|-----------|-------------|
| `STAGING_RUNBOOK_V1.md` | `339271d` + CI `42824720654` | Repo `50a8890`; runtime **žádný** / NOT DEPLOYED | Audit baseline aktualizován; nasazení stále ne |
| `DEPLOYMENT.md` | `339271d` + run `42824720654` | Repo `50a8890`; staging NOT DEPLOYED | Stejné oddělení |
| `STAGING_DEVICE_VALIDATION_V1.md` | `339271d` | Repo `50a8890`; NOT DEPLOYED | GO beta text bez tvrzení, že staging běží |
| `SPRINT_15_3_…md` | už `50a8890` | odkazy na 15.3.1 + runbook | Propojení |

**Záměrně nezměněno v tomto slice** (mimo scope 15.3.1, stále obsahují starší repo baseline — **ne tvrdí**, že staging běží):

| Soubor | Hash / poznámka | Doporučení |
|--------|-----------------|------------|
| `CLOSED_BETA_ONBOARDING_V1.md` | `339271d` | Aktualizovat při closed-beta kickoffu |
| `MASTER_PLAN_STATUS.md` | `339271d` | Periodický status refresh |
| `GAMEPLAY_COMPLETENESS_AUDIT_V1.md` | `aa8faea` | Samostatný audit dokument |
| `SPRINT_15_2_E2E_CHAPTER_JOURNEY_FIX.md` | historický `6238e53` | Sprint historie — neměnit |

---

## 3. Provedené aktualizace

| Oblast | Stav | Shrnutí |
|--------|------|---------|
| Oddělení repo vs runtime | **PASS** | Všude NOT DEPLOYED / staging neběží |
| Lite-first + secrets | **PASS** | Beze změny politiky; žádné vypisování secretů |
| Compose v2.24+ | **PASS** | Runbook §2, device validation, DEPLOYMENT |
| Pořadí deploy kroků | **PASS** | konfigurace → preflight → compose config → postgres → migrace → api/frontend/bot → HTTPS → health/ready → Telegram |
| Propojení 15.3 ↔ runbook | **PASS** | Vzájemné odkazy v hlavičkách |
| „Staging připravený k použití“ | **PASS** | Explicitně zakázáno bez runtime checklistu |

**Not verified (beze změny oproti 15.3):**

- Živé HTTPS staging
- Reálný produkční `.env.docker`
- `docker compose config` na VPS
- Fyzický Telegram test

---

## 4. Kontrola

| Kontrola | Stav | Důkaz |
|----------|------|-------|
| Odkazy mezi 4 hlavními docs + 15.3 | **PASS** | ruční kontrola relativních cest |
| Žádný doc netvrdí běžící staging | **PASS** | grep — pouze negace / NOT DEPLOYED / playtest až po deployi |
| `pytest tests/test_staging_preflight.py` | **PASS** | 17 passed |
| `python scripts/secret_scan.py` | **PASS** | `Secret scan: OK` |
| Preflight na `.env.docker.example` | **FAIL** (očekávané) | placeholdery — šablona není runtime env |
| Preflight na reálném `.env.docker` | **NOT VERIFIED** | soubor na audit hostu chybí |
| `docker compose config` | **NOT VERIFIED** | Docker není na PATH (Windows dev host) |
| `gh` / CI run ID pro `50a8890` | **NOT VERIFIED** | `gh` není nainstalované |

---

## 5. Změněné soubory

| Soubor | Typ změny |
|--------|-----------|
| `docs/STAGING_RUNBOOK_V1.md` | modified (tracked) |
| `docs/DEPLOYMENT.md` | modified (tracked) |
| `docs/STAGING_DEVICE_VALIDATION_V1.md` | modified (tracked) |
| `docs/SPRINT_15_3_STAGING_AND_PLAYER_VALIDATION.md` | updated (untracked → obsah sync) |
| `docs/SPRINT_15_3_1_DOCUMENTATION_TRUTH_SYNC.md` | new (untracked, tento report) |

### Diff (tracked)

```
 docs/DEPLOYMENT.md                   | 33 +++++++++++++++---------
 docs/STAGING_DEVICE_VALIDATION_V1.md | 35 +++++++++++++++----------
 docs/STAGING_RUNBOOK_V1.md           | 50 +++++++++++++++++++++++++++---------
 3 files changed, 80 insertions(+), 38 deletions(-)
```

Úplný diff: `git diff docs/DEPLOYMENT.md docs/STAGING_DEVICE_VALIDATION_V1.md docs/STAGING_RUNBOOK_V1.md`

---

## 6. Závěr pro rozhodnutí

| Otázka | Odpověď |
|--------|---------|
| Jsou staging podklady pro **první deploy** jednoznačné? | **PASS** — runbook + DEPLOYMENT + device validation + report 15.3 |
| Je staging **ověřený a použitelný testerům**? | **NOT VERIFIED** — runtime checklist neproběhl |
| Může ops začít deploy? | Ano, podle `STAGING_RUNBOOK_V1.md` §4–6 na commitu s zeleným CI (`50a8890` jako audit výchozí bod) |
| Commit / push v 15.3.1? | **Neprovedeno** — čeká na schválení |

---

## STOP

Žádný commit, push, deploy ani změna herního kódu. Report předán ke kontrole.
