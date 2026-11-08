# Roadmap

Updated 2026-11-07. Core play loop, Mini App, spell MVP, streaming, rest/progression, and the first four connected locations are implemented. The checks below distinguish implementation from external verification.

## Priority 1 - Verify actual deployment
- [ ] Run signed Telegram Mini App visual QA on a real phone: character creation, location travel, exploration, combat, spellcasting, rest, level-up, and death. Local browser E2E is not a substitute.
- [ ] Build and start Docker Compose in an environment with Docker.
- [ ] Apply Alembic migrations and run integration/concurrency checks against a live PostgreSQL service.

## Priority 2 - Make the campaign last longer
- [x] Add three locations beyond The Whispering Cellar, location-specific encounter/discovery tables, constrained travel, and first-visit NPC beats.
- [x] Add persistent engine-resolved quest flags and a bounded Caldus/Nib bell quest with one-time rewards.
- [ ] Add further locations and encounters; test a 30+ minute route for repetition and balance.

## Priority 3 - Maintainability and narrative quality
- [x] Split project history, decisions, roadmap, architecture, engine, content, and deployment documentation.
- [x] Move one-off `tools/brain_step1.py` and `tools/step1_patch.py` into a clearly marked archive after checking tracked references.
- [x] Extract the narrator provider boundary into `app/ai/` while preserving offline fallback and post-commit streaming.
- [ ] Add another narration provider only after provider selection, costs, and privacy are reviewed.
- [ ] Decide whether to localize generated narration; Czech UI is already available without diacritics.

## Deferred product decisions
- Payments (Telegram Stars/YooKassa), referrals, Redis, campaigns/payments tables, and higher-level spell progression remain out of scope until separately prioritized.
- Do not present reference-only SRD content as implemented game mechanics.
