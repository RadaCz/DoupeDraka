# Gameplay contracts V1 (Sprint 28 registry)

**Authority:** `GameEngine.resolve_action`, `quests.resolve_main_quest_step`, persisted `CharacterState`.  
**Purpose:** regression map — describes what must not break without an explicit rules change and matching tests.

| Sprint | Domain | Entry conditions | Authoritative behavior | Allowed state changes | Forbidden side effects | Persistence | Regression tests |
|--------|--------|------------------|------------------------|----------------------|------------------------|-------------|------------------|
| 15 | Story XP & vault arc | Quest flags for bell/vault route | Story XP on vault route + first descent once; main path → level ≥ 3 without search grind | `xp`, `level`, `quest_flags` | Double-award route/descent XP | Flags + XP survive `load_character_state` | `tests/test_sprint15_story_progression.py` |
| 17 | AC, armor, shield | Equipped armor/shield in inventory | AC from equipment ruleset; shield + armor stack per SRD slice | `armor_class`, equipment slots | Equip without proficiency | Serialized equipment on character | `tests/test_equipment_armor_v1.py` |
| 18–19 | Saving throws & conditions | Combat/exploration with save triggers | Unified save pipeline; conditions apply on failed saves | `conditions`, HP, flags | Silent ignore of save tags | Conditions in payload | `tests/test_saving_throws_v1.py`, `tests/test_sprint19_unified_combat.py` |
| 20 | Character → adventure | MVP race/class matrix | Valid level-1 hero at Whispering Cellar; creation choices persisted | Full `CharacterState` | Invalid class/race combos | API create + DB payload | `tests/test_character_creation_mvp_matrix.py`, `tests/test_character_creation_v2.py`, `tests/test_integration.py` |
| 21 | Class identity | MVP four classes at L1 | Fighting Style, Second Wind, Sneak/Hide, spellbook, etc. per class | Class feature fields, slots | Cross-class features | Reload via `load_character_state` | `tests/test_class_identity_sprint21.py` |
| 22 | Chapter One completion | Vault unlocked, boss pit, level gate | Boss rewards + `chapter_one_complete` once; bell return XP idempotent | `quest_flags`, `gold`, `xp` | Repeat boss payout | `test_chapter_one_complete_survives_character_reload` | `tests/test_sprint22_chapter_one_completion.py` |
| 23 | Skill challenges | Bandit Camp actions | Fail-closed unknown verbs; evidence flags persistent | Skill flags, journal | Generic Cha fallback | `test_evidence_persists_reload` | `tests/test_sprint23_skill_challenges.py` |
| 24 | Background features | Six MVP backgrounds | One-shot chapter gifts; idempotent flags | `quest_flags`, inventory | Re-trigger on reload | `test_resolve_action_integration_persistence` | `tests/test_sprint24_background_features.py` |
| 25 | Action economy | Player turn in combat | Action / bonus / reaction flags; potion, HW, attacks | `combat_flags` | Extra main action same turn | Combat flags in state | `tests/test_sprint25_combat_action_economy.py` |
| 26 | Racial traits | MVP four races | Lucky on player d20; tagged saves; darkvision data | Proficiencies, race meta | Rules not in `race_features` | Race features in API payload | `tests/test_sprint26_racial_traits.py` |
| 27 | Ranged combat | Distance + weapon type | Range gates; ammo on resolved ranged attack; thrown rules | Distance, ammo count | Melee at range without penalty where defined | Distance fields persist in combat | `tests/test_sprint27_ranged_combat.py` |
| 27.1 | Combat move & AI range | Encounter start + COMBAT_MOVE intent | `ensure_encounter_distance`; advance/step; kobold ranged at distance | `combat_distance_ft`, movement pool | Direct helper bypass in production | Cleared on `_exit_combat` | `tests/test_sprint27_1_combat_integration.py`, `tests/test_sprint28_gameplay_journey_smoke.py` |
| 29 | Reactions & OA | Voluntary leave melee reach | Opportunity attack via normal `attack` / enemy strike; one reaction per side per round; Disengage blocks OA from own movement; no OA vs dead combatant; idempotent action replay | `reaction_used`, `enemy_reaction_used`, `disengaged` | Duplicate reaction spend; OA on teleport/forced (not modeled); multi-enemy reaction map | Flags in `combat_flags` | `tests/test_sprint29_combat_reactions.py`, `tests/test_sprint30_combat_reactions_hardening.py`, `e2e/combat-reactions.spec.ts` |
| 31 | Spellcasting MVP | Caster `cast` intent | DC/attack formulas; slots; 11 modeled spells; non-casters rejected; UI `effect_modeled` gate | `spell_slots`, `known_spells`, `prepared_spells`, `spellcasting_ability` | Concentration; most SRD spells; bonus-action cast pairing rule | Persisted on character payload | `tests/test_spells.py`, `tests/test_sprint31_spellcasting_integrity.py`, `docs/SPELLCASTING_CONTRACT_V1.md`, `e2e/spellcasting-integrity.spec.ts` |

## E2E (Playwright) player journeys

Not pytest-marked `e2e`; owned by `frontend/e2e/` projects: `chapter-journey`, `combat-saves`, `e2e-smoke`.  
See `docs/DEVELOPMENT_WORKFLOW_V1.md` for when to run full Playwright matrix.

## Changing a contract

1. Update the sprint acceptance doc (if any) and this row — **do not** change behavior only in tests.  
2. Run `.\scripts\run_tests.ps1 regress` and targeted Playwright project from the dependency map.  
3. Note the contract change in `PRODUCT_GAP_REGISTER_V1.md` if player-visible.
