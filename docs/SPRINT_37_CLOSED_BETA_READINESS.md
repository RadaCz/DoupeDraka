# Sprint 37 — Chapter One Closed Beta Readiness V1

**Audit date:** 2026-11-12  
**Repository:** RadaCz/DoupeDraka  
**Branch:** `clean-main` @ **`580494e`** (`feat(classes): Sprint 36 Cunning Action and Channel Divinity`)  
**Working tree:** clean kromě untracked `data/`, běhových logů, `tools/audit_cs_suspects.py`  
**CI (GitHub Actions):** workflow definován v `.github/workflows/ci.yml` (backend, backend-postgres, frontend, e2e). Lokálně **`gh` není k dispozici** — stav běhu pro `580494e` **neověřen v tomto auditu** (uživatel hlásil zelený CI po pushi Sprint 36).

---

## Executive verdict

| Verdict | Meaning |
|---------|---------|
| **Sprint 37 audit** | **READY FOR REVIEW** — mapa cesty, testovací gate, dokumentace, playtest protokol |
| **Closed beta (product)** | **NOT READY** — chybí provedený lidský playtest, fyzický Telegram (Android/iOS), staging HTTPS; CI z tohoto auditu nepotvrzen |

Nezaměňovat **READY FOR REVIEW** s **READY FOR PUBLIC / CLOSED BETA RELEASE**.

---

## 1. Player journey map (Chapter One)

Legenda statusů: **VERIFIED** (automatizovaný důkaz), **IMPLEMENTED** (kód + unit), **PARTIAL**, **PENDING** (čeká na člověka), **COMING LATER**.

| Step | Player action | Engine result | Persistence | UI feedback | Status |
|------|---------------|---------------|-------------|-------------|--------|
| 0 | Otevřít Mini App (Telegram `initData`) | Auth + session | User row | Gate mimo Telegram | **VERIFIED** `adventure.spec.ts` |
| 1 | Vytvořit postavu (4×4 MVP) | `create_character`, equip, spells | DB payload | Wizard 9 kroků | **VERIFIED** `character-creation-wizard.spec.ts`, `character-to-adventure.spec.ts`, `test_character_creation_mvp_matrix.py` |
| 2 | První tah (explore / look) | `resolve_action` | Journal + state | Adventure journal stream | **VERIFIED** `adventure.spec.ts` |
| 3 | Cestování mapou / travel | `travel_allowed`, location | `location`, flags | Map + quest chips | **VERIFIED** `chapter-one-quest.spec.ts`, `player-journey-hub.spec.ts` |
| 4 | Caldus → bell quest | `bell_quest_*` flags | `quest_flags` | Quest strip + chips | **VERIFIED** E2E + `test_quests_engine` |
| 5 | Nib, zvon, návrat | gold, XP, `bell_quest_complete` | gold/xp/flags | Journal | **VERIFIED** E2E + Sprint 22 pytest |
| 6 | Vault unlock + descent | `vault_unlocked`, story XP | flags, level | Chips / map | **VERIFIED** helpers + `level-progression.spec.ts` |
| 7 | Bell Warden boss | boss spawn, combat, rewards | `chapter_one_complete` | Combat / journal | **PARTIAL** — E2E: UI quest chain + **engine boss helper** `completeBossViaEngine`; plný boss **čistě přes UI tlačítka** ne automatizován |
| 8 | Crypt / bandit (optional) | side rewards | flags | Map | **VERIFIED** engine; **PARTIAL** E2E (`bandit-camp-skill`, inventory crypt path) |
| 9 | Combat loop | AC, damage, OA, economy | combat state | Combat deck | **VERIFIED** regress + mnoho E2E |
| 10 | Class L2 features | Cunning / CD / Surge / AR | class fields | Combat actions | **VERIFIED** Sprint 36 pytest + E2E |
| 11 | Inventory / potion / equip | equipment slots | inventory payload | Inventory panel | **VERIFIED** `inventory-gameplay.spec.ts` |
| 12 | Reload / pokračování | GET character | DB | Continue adventure | **VERIFIED** `adventure.spec.ts`, persistence tests |
| 13 | Lite narration | offline journal | no ⚡ debit | stream events | **VERIFIED** `test_api_systems.py` |
| 14 | Normal narration | provider / fallback | billing ledger | tier picker | **IMPLEMENTED** pytest refunds; **PENDING** staging + real provider |

**Idempotence / receipts:** **VERIFIED** (`test_integration`, `test_sprint36_1_channel_idempotency.py`, replay E2E).

---

## 2. Four classes — Chapter One playability

| Class | Create → play | Combat identity | Progression L2 | Chapter One viable | Status |
|-------|----------------|-----------------|----------------|---------------------|--------|
| Fighter | E2E | Second Wind, Action Surge, Disengage (action) | L2 surge | Ano (melee, potion) | **VERIFIED** |
| Rogue | E2E | Sneak attack, Cunning Dash/Disengage/Hide | L2 | Ano | **VERIFIED** Sprint 36 E2E |
| Cleric | E2E | Spells, Preserve Life, Turn Undead | L2 CD | Ano | **VERIFIED** Sprint 36 E2E |
| Wizard | E2E | Cantrips/slots, Arcane Recovery | L2 tradition **COMING LATER** (UI) | Ano (ranged/cantrip) | **VERIFIED**; tradition nehraje mechanicky |

Wizard **Arcane Tradition** zůstává označena **COMING LATER** — žádné falešné tlačítko schopnosti.

---

## 3. Narration & economy (no pay-to-win)

| Check | Evidence | Status |
|-------|----------|--------|
| Lite bez externího providera | `LLM_PROVIDER=fallback`, `narration_status=offline` | **VERIFIED** |
| Lite ⚡ cost 0 | `economy.py`, `test_api_systems` | **VERIFIED** |
| Normal debit jen při `narrated` | `reconcile_narrator_billing` | **VERIFIED** pytest |
| Refund při fallback/timeout | `test_paid_narration_fallback_*` | **VERIFIED** |
| Kredity neovlivňují combat/loot | engine-only authority | **VERIFIED** (design + lack of hooks) |
| Chapter One dokončitelný zdarma (Lite) | main quest nevyžaduje ⚡ | **VERIFIED** |

---

## 4. Security & reliability (spot audit)

| Area | Status | Notes |
|------|--------|-------|
| Telegram `initData` validation | **IMPLEMENTED** | `test_telegram_auth`, E2E signed init |
| Character ownership on API | **IMPLEMENTED** | integration tests |
| Server-side action validation | **IMPLEMENTED** | engine gate; fail-closed unknown intents |
| Idempotency-Key / receipts | **IMPLEMENTED** | API + Sprint 36.1 |
| Secret scan | **VERIFIED** local | CI job in workflow |
| PostgreSQL + Alembic | **IMPLEMENTED** | CI job `backend-postgres` — **PENDING** confirm on GHA |
| Stream cancellation / billing | **IMPLEMENTED** | `test_stream_cancellation.py` |

---

## 5. Mobile / Telegram UX

| Layer | Status |
|-------|--------|
| Playwright `mockTelegramWebApp` | **VERIFIED** — většina E2E |
| `mobile-viewports.spec.ts`, `play-layout.spec.ts` | **VERIFIED** automated |
| **Fyzický Telegram** (Android/iOS) | **PENDING** — viz `TELEGRAM_MOBILE_QA_V1.md` |
| Jednoruční ovládání na reálném zařízení | **NOT VERIFIED** |

---

## 6. E2E scenario coverage (risk-based)

| # | Scenario | Primary spec / test | Status |
|---|----------|---------------------|--------|
| 1 | Fresh creation → first adventure | `character-to-adventure.spec.ts` | **VERIFIED** |
| 2 | Chapter One main story | `chapter-one-quest.spec.ts` | **VERIFIED** (UI + hybrid boss) |
| 3 | Combat → progression → equipment | `level-progression.spec.ts`, `inventory-gameplay.spec.ts` | **VERIFIED** |
| 4 | Boss → chapter complete → rewards | `chapter-one-quest.spec.ts` + engine helper | **PARTIAL** UI boss |
| 5 | Reload continue | `adventure.spec.ts` | **VERIFIED** |
| 6 | Lite ohne AI | `test_lite_action_reports_offline_narration_status` | **VERIFIED** |

---

## 7. Test gates (local, 2026-11-12, HEAD `580494e`)

| Gate | Result |
|------|--------|
| fast | **763** passed, 2 skipped, 21 deselected |
| regress | **295** passed |
| full | **784** passed, 2 skipped |
| slow | **21** passed |
| Vitest | **171** passed |
| frontend build | OK |
| secret_scan | OK |
| Playwright matrix | **45/45** (jeden běh, ~3.6 min) |

**vs Sprint 36.1:** pytest full **784** (= předchozí); Playwright **45/45** stabilní.

---

## 8. Real player playtest

**Status: PENDING** — žádní externí testeři v tomto sprintu.

Protokol: [`CLOSED_BETA_PLAYTEST_GUIDE.md`](CLOSED_BETA_PLAYTEST_GUIDE.md) (3–5 testerů, bez vývojářského návodu).

Bez provedeného playtestu **nelze** uzavřenou betu označit **READY**.

---

## 9. Prioritized findings

### P0 (blokátory bety)

| ID | Issue | Status |
|----|-------|--------|
| P0-1 | Žádný provedený closed-beta playtest s reálnými hráči | **OPEN** |
| P0-2 | Fyzický Telegram Mini App (Android/iOS) neověřen | **OPEN** |
| P0-3 | Staging HTTPS / production-like deploy **NOT DEPLOYED** | **OPEN** |

### P1

| ID | Issue | Status |
|----|-------|--------|
| P1-1 | Bell Warden — plný boss fight pouze přes UI ne E2E | **OPEN** |
| P1-2 | GitHub CI po `580494e` — neověřeno v tomto auditu (`gh` chybí) | **OPEN** (uživatel: měl být zelený) |
| P1-3 | Normal tier na stagingu s reálným providerem | **PENDING** ops |

### P2

| ID | Issue | Status |
|----|-------|--------|
| P2-1 | „Human fun“ / srozumitelnost bez facilitátora | **PENDING** playtest |
| P2-2 | Unequip weapon (engine swap only) | **OPEN** (známé z auditu V1) |
| P2-3 | Většina kouzel katalog-only | **COMING LATER** (označeno) |

### P3

| ID | Issue | Status |
|----|-------|--------|
| P3-1 | Pro narrator tier | **INTENTIONALLY_DEFERRED** |
| P3-2 | Kosmetika journal / copy | backlog |

**Žádný P0 bezpečnostní / ztráta dat defect** nebyl v gate nalezen.

---

## 10. Changed files this sprint

Pouze dokumentace (žádný commit v rámci Sprint 37 bez souhlasu):

- `docs/SPRINT_37_CLOSED_BETA_READINESS.md` (nový)
- `docs/CLOSED_BETA_PLAYTEST_GUIDE.md` (nový)
- Aktualizace: `MASTER_PLAN_STATUS.md`, `ROADMAP.md`, `GAMEPLAY_COMPLETENESS_AUDIT_V1.md`, `PRODUCT_GAP_REGISTER_V1.md`, `GAMEPLAY_CONTRACTS_V1.md`, `ENGINE_DEPENDENCY_MAP_V1.md`

---

## 11. Závěr pro stakeholdery

Hra má **implementovanou a automaticky testovanou** Chapter One sólo smyčku, čtyři MVP povolání, Lite hratelnost bez AI, a širokou regresní mřížku. Pro **uzavřenou betu** chybí **ověření na reálném zařízení a s reálnými hráči** plus **provozní staging**.

**Doporučený další krok:** spustit playtest dle guide → opravit P0/P1 z protokolu → staging deploy → fyzický Telegram QA → teprve pak **Closed Beta READY**.

---

## Sprint 37.1 — Closed Beta Blocker Closure (2026-11-12)

**HEAD (kód):** stále **`580494e`** — lokální změny **necommitnuté** (E2E + docs).  
**Verdikt Sprint 37.1:** **READY FOR REVIEW** (Bell Warden UI E2E + brány zelené lokálně).  
**Closed beta (product):** stále **NOT CLOSED BETA READY** — playtest, staging HTTPS, fyzický Telegram.

### Bell Warden — UI E2E (P1)

| Položka | Status |
|---------|--------|
| `frontend/e2e/bell-warden-ui.spec.ts` — quest chain UI + boss pouze combat deck | **VERIFIED** (~2.8 min) |
| `chapter-one-quest.spec.ts` + `completeBossViaEngine` zachován | **VERIFIED** |
| Vault L3 grind přes `completeVaultDescentViaEngine` (stream jako UI) | **IMPLEMENTED** (scope 37.1) |
| Zakázané zkratky v novém specu | **VERIFIED** (žádný `completeBossViaEngine`) |
| Reload + persistence `chapter_one_complete` | **VERIFIED** |
| E2E token po `page.reload()` (prune ApiKey) | **IMPLEMENTED** — refresh `apiTelegramToken` |
| Playwright matrix — oddělené fáze chapter specs (RNG seed) | **IMPLEMENTED** `run-tests.mjs` |

### Test gates (lokálně, po 37.1, stále nad `580494e` + E2E diffs)

| Gate | Result | Poznámka |
|------|--------|----------|
| fast | **763** passed, 2 skipped | 1× flake `test_channel_restored_only_on_short_rest` v `-m not slow` před full během |
| regress | **295** passed | stejný test občas padá v `-m regress` alone; zelený po full |
| full | **784** passed, 2 skipped | |
| slow | **21** passed | |
| Vitest | **171** passed | |
| frontend build | OK | |
| secret_scan | OK | |
| Playwright matrix | **46/46** (~14 min, 7 fází) | +1 spec `bell-warden-ui` |

### CI / PostgreSQL (GitHub Actions @ `580494e`)

| Job | Status |
|-----|--------|
| backend (`pytest -m "not slow"`) | **BLOCKED** lokální ověření — `gh` v PATH chybí; bez nového pushu nelze číst run |
| backend-postgres + Alembic | **BLOCKED** (stejný důvod) |
| frontend Vitest/build | **BLOCKED** na GHA |
| e2e | **BLOCKED** na GHA |

**Post-push postup:** `gh run list --branch clean-main --commit 580494e` → ověřit joby `ci.yml`; po commitu 37.1 zopakovat na novém SHA.

### Normal narration — staging readiness

| Kontrola | Status | Evidence |
|----------|--------|----------|
| Provider config (`LLM_PROVIDER`, chain) | **IMPLEMENTED** | `app/settings.py`, `app/ai/registry.py` |
| Timeout / fallback / `narration_status` | **VERIFIED** pytest | `test_paid_narration_fallback_*`, `test_stream_cancellation.py` |
| Debit jen při `narrated`; refund offline/fallback | **VERIFIED** | `reconcile_narrator_billing` v `app/api.py` |
| Lite bez účtování | **VERIFIED** | |
| **Reálný provider na stagingu** | **BLOCKED** | Chybí ověřené `MINI_APP_URL` + platné provider env (bez lokálních secretů) |
| **Staging test scenář** (manuální, nízký objem) | **PENDING** | Viz níže |

**Staging scenář (až jsou credentials + HTTPS deploy):**

1. `python scripts/staging_preflight.py` — musí projít bez placeholderů.
2. Nová postava, tier **Normal**, 2× explore v Cellar — journal obsahuje provider text, `narration_status=narrated`, ⚡ klesne.
3. Odpojit provider / simulovat timeout — journal fallback, ⚡ refund nebo žádný debit (`narration_status≠narrated`).
4. Přerušit stream (zavřít app) — žádný dvojitý billing na replay stejné idempotency key.

**Nepoužívat** mock provider jako důkaz stagingu.

### Telegram Android / iOS

| Vrstva | Status |
|--------|--------|
| Playwright `mockTelegramWebApp` | **VERIFIED** |
| Vitest telegram / layout | **VERIFIED** |
| **Fyzický Android** | **PENDING** — checklist `TELEGRAM_MOBILE_QA_V1.md` |
| **Fyzický iOS** | **PENDING** — stejný checklist |

Krátký pre-flight: C1 init, C2 safe area, C3 klávesnice, combat modaly, reload (B5/C5).

### Playtest

| Položka | Status |
|---------|--------|
| `CLOSED_BETA_PLAYTEST_GUIDE.md` | **IMPLEMENTED** |
| Provedení 3–5 testerů | **PENDING** |
| Feedback šablona | **IMPLEMENTED** (guide § zápis) |

### Aktualizované položky journey (vs §1)

| Step 7 Bell Warden boss | **VERIFIED** UI (`bell-warden-ui.spec.ts`) + **VERIFIED** hybrid (`chapter-one-quest.spec.ts`) |
| E2E scenario #4 | **VERIFIED** UI boss path |

### P1 uzavření

| ID | Po 37.1 |
|----|---------|
| P1-1 Bell Warden UI E2E | **CLOSED** (tech) |

### Verdikty (Sprint 37.1)

| Label | Splněno? |
|-------|----------|
| **READY FOR REVIEW** | Ano — lokální brány + Bell Warden UI |
| **CLOSED BETA TECHNICALLY READY** | Ne — GHA neověřeno, staging/provider, fyzický Telegram |
| **CLOSED BETA READY** | Ne — lidský playtest chybí |

### Změněné soubory (37.1, uncommitted)

- `frontend/e2e/bell-warden-ui.spec.ts` (nový)
- `frontend/e2e/chapter-one-e2e-helpers.ts`
- `frontend/e2e/run-tests.mjs`, `playwright.config.ts`, `test-config.ts`
- Dokumentace: tento soubor, `MASTER_PLAN_STATUS.md`, `ROADMAP.md`, `GAMEPLAY_CONTRACTS_V1.md`, `CLOSED_BETA_PLAYTEST_GUIDE.md` (verze 1.1)
