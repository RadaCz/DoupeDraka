# Product Gap Register V1

**Repo baseline (audit):** `ebb4cd8ade948540bd97cfd557326b64cfc37236` (`clean-main`)  
**Last acceptance pass:** Sprint 18 — [`SPRINT_18_SAVING_THROWS_COMBAT_EFFECTS_V1.md`](SPRINT_18_SAVING_THROWS_COMBAT_EFFECTS_V1.md) (local, uncommitted)  
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
| Classes (MVP 4) | **PARTIAL** | `catalog.py`, `equipment.py`, `spells.py`, `saving_throws.py` | HD, AC, save prof stored **and used** on `perform_saving_throw`; class features still thin | P0 | 19 — class features |
| Backgrounds | **PARTIAL** | `MVP_BACKGROUNDS` (6 SRD), wizard footnote | Skills + gear + gold verified in tests; features **narrative-only** (UI labeled) | P1 | 17 — model 1–2 features |
| Abilities (standard array) | **IMPLEMENTED** | `catalog.STANDARD_ARRAY`, wizard step | Validated permutation; racial ASI after assign | P0 | — |
| Skills & proficiency | **PARTIAL** | `skill_proficiencies`, `skill_check()` | Proficiency on skill rolls (explore cues); not all actions | P0 | 17 — broader skill routing |
| Equipment at creation | **IMPLEMENTED** | `apply_starting_equipment`, `EQUIPMENT_PACKAGES` | Class packages + auto body armor; instances + slots at create | P1 | — |
| Worn armor / shield AC | **IMPLEMENTED** | `equipment.compute_armor_class`, equip actions | SRD 5.1 MVP armor set; shield +2; proficiency enforced | P0 | Expand armor catalog |
| Spells at creation | **PARTIAL** | `validate_spell_picks`, wizard/cleric only | Player picks; unmodeled spells flagged in UI | P1 | 17 — expand `MODELED_SPELL_EFFECTS` |
| Player saving throws (engine + play) | **IMPLEMENTED** | `saving_throws.py`, `combat_effects.py`, `test_saving_throws_v1.py` | Ghoul on-hit CON, kobold on-hit DEX, Vault falling stones; not full condition/adv economy | P0 | Conditions, monster saves parity |
| Combat | **PARTIAL** | `service.py`, `equipment.py`, `combat_effects.py` | Attack, AC, slots, subset of spells, **3 save triggers** | P0 | Bonus action / reaction economy |
| Inventory | **PARTIAL** | `equipment.py`, `CharacterInventoryPanel` | Weapon + armor + shield equip; bows/accessories not modeled | P1 | 18 — ranged weapons |
| Exploration / checks | **PARTIAL** | `EXPLORE_SKILL_CUES`, `ability_check` | Skill mapping for some verbs | P1 | 17 |
| NPC / quests Ch.1 | **IMPLEMENTED** | `chapter_one_progression.py`, quests | Playable chapter 1 | P0 | — |
| Level-up | **PARTIAL** | `_level_up`, `spells.learn_level_up_spells` | XP threshold; auto spell picks | P2 | 18 |
| Lite / Normal / Pro | see above | `economy.py`, `settings.py` | No pay-to-win; no paid rolls | P0 | — |
| Mobile UX Ch.1 | **PARTIAL** | E2E play-layout + mobile-viewports | 16.2: bilingual helpers + ID bands; 23/23 E2E ~4 min | P0 | Staging deploy |
| E2E CI stability | **PARTIAL** | `telegram.ts`, Sprint 17.1 composer waits | Unequip intent + post-stream idle; local 23/23 green | P0 | Confirm on GHA |
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
