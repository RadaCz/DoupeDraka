# Roadmap

Updated 2026-11-12 (`354e510` committed + **Sprint 36.1 uncommitted, READY FOR REVIEW** local). Chapter one is a gated six-location slice. ActionIntent routes player commands; **Pro NOT AVAILABLE** until OpenRouter exists.

## Priority 0j.5 — Level-up L1–L3 (Sprint 35 / 35.3, local)
- [x] MVP XP 100/level (not SRD table); combat vs story XP contracts
- [x] Average hit-die HP; no level-up at 0 HP
- [x] Fighter Action Surge L2; Rogue Cunning Action (Hide only)
- [x] LevelUpModal + deferred Channel Divinity / Arcane Tradition labeling
- [x] `test_sprint35_*`, `test_sprint35_1_*`, `e2e/level-progression.spec.ts`
- [x] Cunning Action Dash / bonus Disengage (Sprint 36.1 + E2E)
- [x] Channel Divinity mechanics (Sprint 36 — Preserve Life + Turn Undead + E2E)
- [x] Rogue Cunning Action Dash / Disengage / Hide (Sprint 36.1 E2E)
- [x] Sprint 36.1 gates local (pytest 784 full, Playwright 45/45)
- [ ] Push / CI after user commit

## Priority 0j.3 — Spellcasting gameplay (Sprint 32, local)
- [x] Concentration system + CON saves on damage
- [x] Bless, Shield of Faith, Mage Armor modeled
- [x] Bonus-action spell pairing rule
- [ ] Shield (reaction) — backlog

## Priority 0j.2 — Spellcasting rules integrity (Sprint 31, committed `36fb99c`)
- [x] `docs/SPELLCASTING_CONTRACT_V1.md`
- [x] Non-caster cast rejection (Fighter / Rogue)
- [x] `tests/test_sprint31_spellcasting_integrity.py` + `e2e/spellcasting-integrity.spec.ts`
- [ ] Concentration MVP — backlog
- [ ] Modeled spell count expansion — backlog

## Priority 0j.1 — Combat reactions hardening (Sprint 30, committed `b124063`)
- [x] E2E phasing: 4 isolated `combat-saves` API/DB phases (RNG seed 27)
- [x] OA guards vs dead / out-of-combat; idempotency integration test
- [x] `tests/test_sprint30_combat_reactions_hardening.py`
- [ ] Push + GitHub CI PostgreSQL — pending user

## Priority 0j — Combat reactions & OA (Sprint 29, committed `44066e3`)
- [x] Opportunity attacks on leave melee reach (player + enemy)
- [x] Disengage action (EN/CS UI)
- [x] `tests/test_sprint29_combat_reactions.py` + `combat-reactions.spec.ts`
- [ ] Shield / reaction spells — backlog

## Priority 0i — Engineering reliability (Sprint 28, committed `29745eb`)
- [x] pytest layers + `scripts/run_tests.ps1` (fast / diagnose / regress / full / slow)
- [x] `docs/GAMEPLAY_CONTRACTS_V1.md`, `ENGINE_DEPENDENCY_MAP_V1.md`, `DEVELOPMENT_WORKFLOW_V1.md`
- [x] CI JUnit + slow job split (workflow; GH run after push)
- [x] Sprint 27.1 committed (`4f9f5bc`)
- [ ] Playwright `chapter-one-quest` vault L3 — red locally (gameplay/E2E, not Sprint 28)

## Priority 0h — Racial traits V1 (Sprint 26, local)
- [x] `app/engine/race_features.py` — MVP Human / Elf / Dwarf / Halfling
- [x] Lucky unified pipeline; tagged saves (poison, charm, fear); poison resistance; Stonecunning flag
- [x] Wizard + Character Sheet UI; `/reference` modeled vs deferred
- [x] `tests/test_sprint26_racial_traits.py` + E2E wizard badges
- [ ] Darkvision as exploration mechanic — backlog
- [ ] Trance / Halfling Nimbleness — deferred

## Priority 0g — Combat action economy (Sprint 25, committed `3573362`)
- [x] `app/engine/combat_action_economy.py` — action / bonus / reaction flags per player turn
- [x] Healing Word, Second Wind, Hide, attacks, defend/flee/potion wired
- [x] Combat UI economy strip (EN/CS)
- [x] Tests + E2E spec `combat-action-economy.spec.ts`
- [x] Opportunity attacks (Sprint 29)
- [ ] Reaction spells (Shield, …) — backlog

## Priority 0f — Background features (Sprint 24, committed `53a6fed`)
- [x] `app/engine/background_features.py` — six one-shot chapter gifts
- [x] Play chips + character sheet status
- [x] Stealth disadvantage success fix (`skill_challenges.py`)
- [x] Tests + E2E (acolyte + criminal)

## Priority 0e — Skill checks & player agency (Sprint 23, committed `32ebfd7`)
- [x] Fail-closed action resolution (`intent.UNKNOWN`, no generic Cha/skill fallback)
- [x] `app/engine/skill_challenges.py` — Bandit Camp stealth / social / combat evidence
- [x] UI chips + `bandit-camp-skill.spec.ts`
- [x] `tests/test_sprint23_skill_challenges.py`
- [ ] More optional locations with challenges — backlog
- [x] Background feature mechanics — Sprint 24 (Chapter One six)

## Priority 0d — Character Creation V2 (Sprint 16+, committed)
- [x] Engine: `app/engine/character_creation.py`, persisted fields on `CharacterState`
- [x] API: extended `CharacterCreate`, `/reference` → `character_creation`
- [x] UI: 9-step `CharacterWizard.tsx` + quick generate with same rules
- [x] Tests: `tests/test_character_creation_v2.py`; full pytest green on `9e7fbac` baseline (596+)
- [x] Vitest **161 passed** on baseline CI #64; E2E **31 passed**
- [x] Racial traits MVP — Sprint 26 (`docs/SPRINT_26_RACIAL_TRAITS_ACCEPTANCE.md`)
- [x] Background feature mechanics — Sprint 24

## Priority 0c — Product UX Redesign V1 (historical audit 2026-11-09; partial implementation since)
- [x] [`docs/PRODUCT_UX_AUDIT_V1.md`](docs/PRODUCT_UX_AUDIT_V1.md) — **historický** P0–P3 inventář (2026-11-09), ne aktuální backlog
- [x] [`docs/PRODUCT_UX_REDESIGN_V1.md`](docs/PRODUCT_UX_REDESIGN_V1.md) — **historický** IA report (2026-11-09)
- [x] Hub dedup (roster/invite), campaign pulse, More menu, journal filters, contextual play chips
- [x] Combat layout V2 (bez nových mechanik) — `combat/CombatUI.tsx`, phone QA pending
- [ ] Tools: Moje / Dostupná / Pravidla tabs
- [ ] Backend gaps: [`design/BACKEND_UX_GAPS_V1.md`](design/BACKEND_UX_GAPS_V1.md)
- [ ] Telefonní QA redesign checklist (§9 redesign report)

## Priority 0b — Immersion & combat UX (in progress locally)
- [x] Offline narrator meta-language removed; breath/search/combat variety (`offline_prose.py`).
- [x] Mobile polish: Telegram safe-area header, bottom-nav active indicator, composer sizing.
- [x] Combat tactics proposal (Heavy/Aim/Defend) — design only: `design/COMBAT_TACTICS_PROPOSAL_V1.md`.
- [ ] Real-phone verification of header, nav, and keyboard overlap.

## GDS01 — Dice, Resources & Economy (E1–E2b on `clean-main`; product sign-off pending)

- [x] [`design/DICE_AND_ECONOMY_V1.md`](design/DICE_AND_ECONOMY_V1.md) — kostky, zdroje, billing contract, D6 doporučení
- [x] [`design/ECONOMY_MODEL_V1.md`](design/ECONOMY_MODEL_V1.md) — session model, náklady (známé/hypotézy)
- [x] [`design/CHAPTER_ONE_PLAYTEST_V1.md`](design/CHAPTER_ONE_PLAYTEST_V1.md) — closed beta 10–15 hráčů
- [ ] **Produktové sign-off GDS01** (dokumentace připravena k review; **ne** schválená implementace)
- [ ] Implementační epiky (až po sign-off) v tomto pořadí:

| # | Epic | Obsah |
|---|------|--------|
| 1 | **E1** | UI copy: Kredity vypravěče; legacy mana — **implemented on `clean-main`** |
| 2 | **E2** | Default Lite + tier gating dle providera — **implemented on `clean-main`** |
| 3 | **E2b** | Billing: no charge / refund při fallback — **implemented on `clean-main`** |
| 4 | **Min. telemetrie** | `state_changed`, narration outcome, turn/session (E5 minimální rozsah) |
| 5 | **Playtest** | `CHAPTER_ONE_PLAYTEST_V1` — 10–15 hráčů, kvalitativní go/no-go |
| 6 | **E3** *(pozastaveno)* | Dice v1.1 (DC, D6 varianta A); `explore_track` není v enginu |
| 7 | **E4** | Kapitola 1 motivation polish |
| 8 | **E6** | Monetizace / platby — **až po** go z playtestu a validaci produktu |

Platby a produkční top-up zůstávají v **Deferred product decisions** (Priority roadmap) do dokončení řetězce výše.

## Priority 0 - Ship chapter one branch
- [x] ActionIntent routing with negation, shop/item/quest intents, ability-check DC rules, class weapon proficiency.
- [x] Mini App UI-1–UI-6: nav, quick actions, graph map, quest next step, hero panels, Telegram chrome.
- [x] Frontend stabilization: MainButton handler cleanup, Talk/NPC chips, error panel retry, theme/viewport listeners (+ Vitest regressions).
- [x] Vault/pit travel gating, `bell_acquired` quest persistence, Map/Quest UI.
- [x] CI on `clean-main`: pytest, Vitest/build, Postgres `alembic upgrade` + concurrency, Playwright E2E.
- [x] GitHub Actions green on `ec646fc` (run `42679663584`, 4/4 SUCCESS).
- [x] Inventory equip/use + journal fact layering + chapter-one engine journey tests (local; phone QA pending).
- [ ] Merge `clean-main` → `main` only after full CI pass (see [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md)).

## Priority 1 - Verify actual deployment
- [ ] Run signed Telegram Mini App visual QA on a real phone: chapter one quest chain, vault gating, Bell Warden, combat, spells, rest.
- [ ] Build and start Docker Compose in an environment with Docker.
- [ ] Run integration/concurrency checks against a live PostgreSQL service outside CI.

## Priority 2 - Make the campaign last longer
- [x] Six connected locations, bell quest, vault finale, Bell Warden boss.
- [ ] General NPC dialogue beyond Caldus/Nib/Mara engine lines.
- [ ] Further locations and encounters; test a 30+ minute route for repetition and balance.

## Priority 3 - Maintainability and narrative quality
- [x] Split project history, decisions, roadmap, architecture, engine, content, and deployment documentation.
- [x] Narrator provider boundary in `app/ai/` with offline fallback.
- [ ] Implement OpenRouter adapter, then re-enable Pro tier with honest pricing.
- [x] Czech UI diacritics + presentation-layer names (V3); CS SSE buffered/coerced (`f8ce5b1`).
- [ ] Physical Telegram QA on device — **NOT TESTED** (`docs/TELEGRAM_MOBILE_QA_V1.md`, `docs/PHYSICAL_TELEGRAM_QA_V2.md`).
- [ ] Closed beta 10–15 hráčů — protokol připraven (`docs/CLOSED_BETA_ONBOARDING_V1.md`); **čeká na fyzické QA**.
- [x] Sprint 7–8 mobile UX — Overview/journal prezentace, play layout, Settings IA — **`885ea4e`**; CI run `42822949152` (4/4 SUCCESS).
- [x] Sprint 9 staging checklist — `docs/STAGING_DEVICE_VALIDATION_V1.md` (v `885ea4e`).
- [x] Sprint 10.3 — `docker-compose.staging.yml` + hardened `staging_preflight` (lokálně, pending commit).
- [ ] HTTPS staging deploy — **NOT DEPLOYED**.

## Deferred product decisions
- Payments (Telegram Stars/YooKassa), referrals, Redis, campaigns/payments tables, multiplayer, and higher-level spell progression remain out of scope until separately prioritized.
- Do not present reference-only SRD content as implemented game mechanics.
