# Product Gap Register V1

**Repo baseline (commit):** `9e7fbac25467d30055efb295e9e863b443ca88d2` (`clean-main` = `origin/clean-main`)  
**Last acceptance pass (committed):** Sprint 22 — [`SPRINT_22_CHAPTER_ONE_GAMEPLAY_ACCEPTANCE.md`](SPRINT_22_CHAPTER_ONE_GAMEPLAY_ACCEPTANCE.md)  
**In progress (local):** Sprint 23 — [`SPRINT_23_SKILL_CHECKS_PLAYER_AGENCY_ACCEPTANCE.md`](SPRINT_23_SKILL_CHECKS_PLAYER_AGENCY_ACCEPTANCE.md)  
**Authority:** engine + persisted `CharacterState`; UI must not pretend unmodeled rules apply.  
**Related audits:** [`GAMEPLAY_COMPLETENESS_AUDIT_V1.md`](GAMEPLAY_COMPLETENESS_AUDIT_V1.md), [`SPRINT_16_CHARACTER_CREATION_V2.md`](SPRINT_16_CHARACTER_CREATION_V2.md)

## Status legend

| Status | Meaning |
|--------|---------|
| **IMPLEMENTED** | Player-facing and enforced in engine with tests |
| **PARTIAL** | Some paths work; gaps documented |
| **REFERENCE_ONLY** | Shown in `/reference` or UI; not applied in combat/exploration |
| **MISSING** | Not built |
| **INTENTIONALLY_DEFERRED** | Out of MVP / closed beta scope |

## Narrator tiers (Sprint 16 note)

| Tier | Status | Notes |
|------|--------|-------|
| **Lite** | **IMPLEMENTED** | Offline; `LLM_PROVIDER=fallback`; no ⚡ cost (`app/engine/economy.py`) |
| **Normal** | **PARTIAL** | 1 ⚡ only when `narration_status=narrated`; refunds on failure (`app/api.py` `reconcile_narrator_billing`) |
| **Pro** | **INTENTIONALLY_DEFERRED** | Disabled in API until provider available |
| Provider chain | **REFERENCE_ONLY** for players | Server env (`LLM_PROVIDER`, keys); not a player-facing multi-provider picker today |

---

## Register

| Area | Status | Source / evidence | Player impact | Priority | Next sprint |
|------|--------|-------------------|---------------|----------|-------------|
| Character creation wizard | **PARTIAL** | `CharacterWizard.tsx`, `character_creation.py`, E2E `character-creation-wizard.spec.ts`, `character-to-adventure.spec.ts` | 9-step UI + persistence; **4-class** create→play E2E (Sprint 20); quick summary on identity step | P0 | Class features, racial depth |
| Races (MVP 4) | **PARTIAL** | `service._d20_check`, `assemble_skill_proficiencies` | ASI + speed; **Lucky** on player d20 checks; Elf Perception | P0 | 17 — Darkvision, Dwarf resilience, Nimbleness |
| Classes (MVP 4) | **PARTIAL** | `class_features.py`, `tests/test_class_identity_sprint21.py`, E2E `class-identity.spec.ts` | Lvl‑1 identity: Fighting Style, Second Wind, Expertise/Sneak/Hide, Life/Disciple, Wizard spellbook + **Arcane Recovery** (SRD budget); ostatní domény/styly deferred | P0 | Rozšířit featury mimo MVP 4 |
| Backgrounds | **PARTIAL** | `MVP_BACKGROUNDS` (6 SRD), wizard footnote | Skills + gear + gold verified in tests; features **narrative-only** (UI labeled) | P1 | 17 — model 1–2 features |
| Abilities (standard array) | **IMPLEMENTED** | `catalog.STANDARD_ARRAY`, wizard step | Validated permutation; racial ASI after assign | P0 | — |
| Skills & proficiency | **PARTIAL** | `skill_challenges.py`, `skill_check()`, Sprint 23 tests | Engine challenges @ Bandit Camp; fail-closed unknown actions; broader routing still backlog | P0 | More locations / inspect challenges |
| Equipment at creation | **IMPLEMENTED** | `apply_starting_equipment`, `EQUIPMENT_PACKAGES` | Class packages + auto body armor; instances + slots at create | P1 | — |
| Worn armor / shield AC | **IMPLEMENTED** | `equipment.compute_armor_class`, equip actions | SRD 5.1 MVP armor set; shield +2; proficiency enforced | P0 | Expand armor catalog |
| Spells at creation | **PARTIAL** | `validate_spell_picks`, wizard/cleric only | Player picks; unmodeled spells flagged in UI | P1 | 17 — expand `MODELED_SPELL_EFFECTS` |
| Player & monster saving throws | **IMPLEMENTED** | `saving_throws.py`, `spell_saves.py` | Unified resolver; spell saves use `perform_monster_saving_throw` + correct DC | P0 | Cover, concentration |
| Conditions (combat) | **PARTIAL** | `conditions.py`, Sprint 19.1 E2E | Paralyzed (end-of-turn save, melee crit), mockery disadvantage consumed; CombatUI chip after API-only sync weak | P0 | More conditions / UI refresh |
| Combat | **PARTIAL** | `service.py`, `equipment.py`, `combat_effects.py` | Attack, AC, slots, subset of spells, **3 save triggers** | P0 | Bonus action / reaction economy |
| Inventory | **PARTIAL** | `equipment.py`, `CharacterInventoryPanel` | Weapon + armor + shield equip; bows/accessories not modeled | P1 | 18 — ranged weapons |
| Exploration / checks | **PARTIAL** | `EXPLORE_SKILL_CUES`, `ability_check` | Skill mapping for some verbs | P1 | 17 |
| NPC / quests Ch.1 | **IMPLEMENTED** | `quests.py`, `chapter-one-quest.spec.ts`, Sprint 22 tests | Full main arc + boss completion; NPC hints engine-gated | P0 | Optional location arcs |
| Level-up | **PARTIAL** | `_level_up`, `spells.learn_level_up_spells` | XP threshold; auto spell picks | P2 | 18 |
| Lite / Normal / Pro | see above | `economy.py`, `settings.py` | No pay-to-win; no paid rolls | P0 | — |
| Mobile UX Ch.1 | **PARTIAL** | E2E play-layout + mobile-viewports | 16.2: bilingual helpers + ID bands; 23/23 E2E ~4 min | P0 | Staging deploy |
| E2E CI stability | **PARTIAL** | `run-tests.mjs` (3 phases, fresh DB/RNG) | Lokálně **31/31** E2E po Sprint 21.1; GHA na nepushnutém diff **neověřeno** | P0 | Commit Sprint 21 + GHA |
| Staging HTTPS | **MISSING** (runtime) | `STAGING_RUNBOOK_V1.md` | No live Telegram test | P0 | Ops |

---

## Narrator (detailed)

| Item | Status | File(s) |
|------|--------|---------|
| Lite offline narration | **IMPLEMENTED** | `app/narrator.py`, `LLM_PROVIDER=fallback` |
| Normal debit 1 ⚡ delivered only | **IMPLEMENTED** | `app/engine/economy.py`, `reconcile_narrator_billing` |
| Refund on fallback/timeout/cancel | **IMPLEMENTED** | `tests/test_stream_cancellation.py`, `test_api_systems` |
| `PAID_NARRATION_STRICT=1` | **IMPLEMENTED** | `app/ai/registry.py`, `tests/test_narration_strict.py` |
| Pro tier | **INTENTIONALLY_DEFERRED** | `effective_billing_tier` → lite |
