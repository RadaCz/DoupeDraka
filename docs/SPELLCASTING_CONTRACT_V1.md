# Spellcasting contract V1 (SRD 5.1 2014 — MVP slice)

**Authority:** `app/engine/spells.py`, `app/engine/service.py` (`_cast_spell`), `app/engine/saving_throws.py`, `app/engine/spell_saves.py`, `app/engine/combat_action_economy.py`.  
**UI parity:** `frontend/src/spells/spellbook.ts`, `/reference` spells via `app/engine/tools.py` (`effect_modeled`).

## MVP classes

| Class | Spellcasting | Ability | List model |
|-------|--------------|---------|------------|
| **Wizard** | Full caster L1+ | Intelligence (`int`) | Known spells |
| **Cleric** | Full caster L1+ | Wisdom (`wis`) | Prepared spells |
| **Fighter** | **None** | — | Reject `cast` (no slots, no effects) |
| **Rogue** | **None** | — | Reject `cast` |

Other SRD classes exist in reference data but are out of Chapter One MVP player creation unless explicitly enabled elsewhere.

## Formulas (implemented)

- **Spell save DC:** `8 + proficiency bonus + spellcasting ability modifier` — `spell_save_dc()` in `saving_throws.py`.
- **Spell attack modifier:** `proficiency bonus + spellcasting ability modifier` — `_spell_attack_bonus()` in `service.py`.
- **Proficiency bonus:** `2 + (level - 1) // 4` (levels 1–20).

## Spell slots

- **Cantrips (level 0):** never consume a slot.
- **Leveled spells:** consume the lowest available slot with `slot_level >= spell_level`.
- **Invalid / denied cast:** no slot, no HP, no combat flag change (`state_changed` false where applicable).
- **Not modeled** (`MODELED_SPELL_EFFECTS` miss): known/prepared spell allowed in sheet but engine refuses effect and **does not** spend a slot.
- **Long rest:** restores all slots to `max_spell_slots` (only at safe locations; see `long_rest_allowed`).
- **Short rest:** does **not** restore general spell slots (Wizard **Arcane Recovery** is a separate class feature, not a universal rule).

## Action economy (combat)

- Default leveled/cantrip combat cast: **Action** (`spell_combat_cost`).
- **Healing Word:** **Bonus action** in combat (`BONUS_ACTION_SPELLS`).
- Costs use Sprint 25 flags (`action_used`, `bonus_action_used`); denied cast does not spend slots.
- **Enforced (Sprint 32):** After a bonus-action spell, only cantrips as Action; after a leveled Action spell, no bonus-action spell that turn (`spell_cast_rules.py`).

## Validation order (`_cast_spell`)

1. Combat turn / paralysis gates  
2. Parse spell name  
3. **Class must be in `CASTER_CLASSES`** (Sprint 31)  
4. Known or prepared list  
5. SRD catalog level  
6. `MODELED_SPELL_EFFECTS` present  
7. Slot availability (level ≥ 1)  
8. Target / range MVP rules (solo enemy, self heals)  
9. Combat action economy reservation  
10. Resolve effect → spend slot only after validation passes  

## Saving throws & damage

- Spell saves use `resolve_spell_save_damage` → unified `perform_monster_saving_throw` (Sprint 18–19).
- **Half on success:** `Burning Hands` (`save_on_success=half`).
- **None on success:** `Sacred Flame`, `Vicious Mockery` (`save_on_success=none`).
- **Vicious Mockery:** failed save applies mockery disadvantage (conditions module).
- No automatic crit/fail on natural 20/1 for saves unless a specific effect adds it (player saves use Lucky where modeled).

## Concentration (Sprint 32)

- One active concentration: `concentration_spell`, `concentration_effect`, `concentration_bonus` (Bless die).
- New concentration ends the previous effect and clears its bonuses.
- **Constitution save** on damage: DC `max(10, damage // 2)` via `perform_saving_throw`.
- **Bless:** self, 1d4 to attack rolls and saving throws while concentrating.
- **Shield of Faith:** bonus action, +2 AC while concentrating.
- **Invisibility:** concentration + `invisible` flag; attack ends concentration.
- **Long rest** clears concentration and Mage Armor.

## Reactive spells (Sprint 33)

- **Shield:** reaction only when `combat_reaction_pending` is set by an enemy hit line; `cast Shield` or `decline reaction`; +5 AC in `compute_armor_class` until start of your next turn; same stored attack roll is re-checked (no second roll).
- Slot and `reaction_used` spent only on successful Shield cast; decline spends neither.
- **Deferred:** Magic Missile negation vs player; auto-decline on timeout; enemy spell reactions beyond melee/ranged weapon attacks.

## Forced movement / range

- Grid range and cover are not simulated; “target active enemy” and combat distance from Sprint 27 apply to martial/ranged attacks, not full spell range enforcement.
- Documented in gameplay gap register.

## Idempotency

- Stream `/actions` idempotency replays receipts without double-applying turn state (Sprint 15 pattern). Spell casts included when routed through the same API.

## Modeled spells (engine)

| Spell | Lvl | Kind | Save / attack | Slot | Concentration (SRD) |
|-------|-----|------|---------------|------|---------------------|
| Burning Hands | 1 | save damage DEX half | yes | yes | no (SRD: no) |
| Cure Wounds | 1 | heal | — | yes | no |
| Eldritch Blast | 0 | spell attack | attack | no | no |
| Fire Bolt | 0 | spell attack | attack | no | no |
| Healing Word | 1 | heal (bonus in combat) | — | yes | no |
| Magic Missile | 1 | auto damage | — | yes | no |
| Misty Step | 2 | escape combat | — | yes | no |
| Invisibility | 2 | self invisible flag | — | yes | yes (MVP: flag only) |
| Scorching Ray | 2 | multi spell attack | attack | yes | no |
| Sacred Flame | 0 | save damage DEX none | yes | no | no |
| Vicious Mockery | 0 | save damage WIS none | yes | no | no |

All other names on class lists are **catalog / sheet** unless added to `MODELED_SPELL_EFFECTS`.

## Tests

- `tests/test_spells.py` — core mechanics  
- `tests/test_sprint31_spellcasting_integrity.py` — contract regressions  
- `tests/test_sprint25_combat_action_economy.py` — combat + Healing Word  
- `frontend/e2e/spell-save-combat.spec.ts`, `spellcasting-integrity.spec.ts`  
