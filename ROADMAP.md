# Roadmap

Updated 2026-11-08. Chapter one is a gated six-location slice on `clean-main`. ActionIntent routes player commands; Pro narration tier is disabled until OpenRouter exists.

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
- [ ] Confirm GitHub Actions green on latest `origin/clean-main`.
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
- [ ] Decide whether to localize generated narration; Czech UI is already available without diacritics.

## Deferred product decisions
- Payments (Telegram Stars/YooKassa), referrals, Redis, campaigns/payments tables, multiplayer, and higher-level spell progression remain out of scope until separately prioritized.
- Do not present reference-only SRD content as implemented game mechanics.
