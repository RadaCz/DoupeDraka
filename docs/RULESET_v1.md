# Ruleset v1 (engine authority)

Canonical rules live in [`../design/RULESET_v1.md`](../design/RULESET_v1.md). This file exists so sprint docs can reference `docs/RULESET_v1.md` without duplicating content.

**Chapter 1 closed beta level cap:** `MAX_MVP_LEVEL = 3` in `app/engine/ruleset_v1.py`. Backend refuses level-ups above 3; the character sheet hides further XP progress and explains the lock; catalog `/reference` exposes `ruleset.max_level` and the lock rationale in `notes`.

**Sprint 20 character creation (2026-11-11):**

- MVP playable: **Human, Elf, Dwarf, Halfling** × **Fighter, Rogue, Cleric, Wizard**; six SRD backgrounds; **standard array** validated on create; racial ASI and speed from engine; class saving throw proficiencies persisted.
- **Class identity (Sprint 21):** Fighter Defense (+1 AC worn), Dueling (+2 one-handed no offhand), Second Wind; Rogue Expertise, Sneak Attack (advantage/hidden), Hide combat action; Cleric Life domain prepared spells, Disciple of Life on lvl‑1 heals; Wizard spellbook vs prepared, **Arcane Recovery** after short rest (manual class feature action; slot levels budget `ceil(wizard_level/2)`, capped by `max_spell_slots`, once per long-rest cycle).
- **Short rest** player phrases include `short rest`, `take a breather`, `brief rest` (engine intent `REST`, see `app/engine/intent.py` + `SHORT_REST_VERBS` in `service.py`).
- Background **features** remain narrative-only (labeled in wizard).
- Character sheet shows engine fields including `speed` and `saving_throw_proficiencies`; proficiency bonus on sheet is display-only (`equipment.proficiency_bonus` mirror).

**Sprint 19.1 combat notes (2026-11-11):**

- Ghoul **Paralyzing Claws:** weapon damage, then CON save DC 10; on fail, `paralyzed` (incapacitated, auto-fail STR/DEX saves, attacks vs target have advantage). Repeat CON save at **end of each of the target's turns**; success ends paralysis.
- Melee hits vs a paralyzed creature within reach are **critical** (`enemy_attack_is_melee()` — catalog defaults to melee; `RANGED_ATTACK_MONSTERS` for exceptions).
- `disadvantage_next_attack` on monsters is consumed on the next attack roll only (Vicious Mockery).
