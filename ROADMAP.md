# Roadmap

Updated 2026-11-08. Chapter one is a gated six-location slice on `clean-main`. ActionIntent routes player commands; Pro narration tier is disabled until OpenRouter exists.

## Priority 0 - Ship chapter one branch
- [x] ActionIntent routing with negation, shop/item/quest intents, ability-check DC rules, class weapon proficiency.
- [x] Mini App UI-1/UI-2: five-item bottom nav + More hub; quick actions submit turns directly.
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
