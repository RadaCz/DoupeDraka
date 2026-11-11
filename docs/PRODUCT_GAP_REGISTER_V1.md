# Product Gap Register V1

**Repo baseline (audit):** `50a88900756792d72284b40fb162f5639a5c29e9` (`clean-main`)  
**Last acceptance pass:** Sprint 16.1 — [`SPRINT_16_1_CHARACTER_CREATION_ACCEPTANCE.md`](SPRINT_16_1_CHARACTER_CREATION_ACCEPTANCE.md)  
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
| Character creation wizard | **PARTIAL** | `CharacterWizard.tsx`, `character_creation.py`, E2E `character-creation-wizard.spec.ts` | 9-step UI + persistence; E2E covers manual/quick/caster | P0 | 17 — CS pills, trait badges |
| Races (MVP 4) | **PARTIAL** | `service._d20_check`, `assemble_skill_proficiencies` | ASI + speed; **Lucky** on player d20 checks; Elf Perception | P0 | 17 — Darkvision, Dwarf resilience, Nimbleness |
| Classes (MVP 4) | **PARTIAL** | `catalog.py`, `equipment.py`, `spells.py`, `saving_throw()` | HD, AC, save prof stored; player save API exists, little combat use | P0 | 17 — class features, save DC events |
| Backgrounds | **PARTIAL** | `MVP_BACKGROUNDS` (6 SRD), wizard footnote | Skills + gear + gold verified in tests; features **narrative-only** (UI labeled) | P1 | 17 — model 1–2 features |
| Abilities (standard array) | **IMPLEMENTED** | `catalog.STANDARD_ARRAY`, wizard step | Validated permutation; racial ASI after assign | P0 | — |
| Skills & proficiency | **PARTIAL** | `skill_proficiencies`, `skill_check()` | Proficiency on skill rolls (explore cues); not all actions | P0 | 17 — broader skill routing |
| Equipment at creation | **PARTIAL** | `EQUIPMENT_PACKAGES` | Class packages + background items; some labels non-wieldable | P1 | 17 — armor AC from worn armor |
| Spells at creation | **PARTIAL** | `validate_spell_picks`, wizard/cleric only | Player picks; unmodeled spells flagged in UI | P1 | 17 — expand `MODELED_SPELL_EFFECTS` |
| Combat | **PARTIAL** | `service.py`, `equipment.py` | Attack, AC, slots, subset of spells | P0 | Ongoing |
| Inventory | **PARTIAL** | `equipment.py`, `CharacterInventoryPanel` | Weapons/consumables; limited gear types | P1 | 17 |
| Exploration / checks | **PARTIAL** | `EXPLORE_SKILL_CUES`, `ability_check` | Skill mapping for some verbs | P1 | 17 |
| NPC / quests Ch.1 | **IMPLEMENTED** | `chapter_one_progression.py`, quests | Playable chapter 1 | P0 | — |
| Level-up | **PARTIAL** | `_level_up`, `spells.learn_level_up_spells` | XP threshold; auto spell picks | P2 | 18 |
| Lite / Normal / Pro | see above | `economy.py`, `settings.py` | No pay-to-win; no paid rolls | P0 | — |
| Mobile UX Ch.1 | **PARTIAL** | E2E + mobile specs | Wizard 375px overflow smoke in 16.1; full viewport matrix not re-run | P0 | Staging deploy + CI E2E |
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
