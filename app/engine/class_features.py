"""SRD 5.1 level-1 class identity — engine-authoritative (Sprint 21)."""

from __future__ import annotations

from typing import TYPE_CHECKING

from .equipment import (
    WEAPONS,
    armor_for_label,
    equipped_armor_instance,
    equipped_shield_instance,
    equipped_weapon,
    proficiency_bonus,
)
from .spells import spell_level

if TYPE_CHECKING:
    from .models import CharacterState
    from .service import GameEngine

FIGHTING_STYLES = frozenset({"defense", "dueling"})
ROGUE_EXPERTISE_PICKS = 2
MVP_CLERIC_DOMAINS = frozenset({"life"})
LIFE_DOMAIN_SPELLS = ("Bless", "Cure Wounds")
DOMAIN_LABEL = "life"

SECOND_WIND_DICE = "1d10"
SNEAK_ATTACK_BASE_DICE = "1d6"
UNDEAD_MONSTER_KEYS = frozenset({"skeleton", "ghoul", "zombie"})


def ensure_class_identity_defaults(character: CharacterState) -> None:
    """Hydrate missing Sprint 21 fields on legacy saves."""
    if character.character_class == "fighter" and not character.fighting_style:
        character.fighting_style = "defense"
    if character.character_class == "cleric" and not character.divine_domain:
        character.divine_domain = DOMAIN_LABEL
    if character.character_class == "cleric":
        apply_life_domain_prepared_spells(character)
    if character.character_class == "rogue" and not character.expertise_skills:
        pool = [
            skill
            for skill in character.skill_proficiencies
            if skill not in {"Perception"}
        ][:ROGUE_EXPERTISE_PICKS]
        character.expertise_skills = pool
    if not character.quest_flags.get("s21_class_identity_v1"):
        if character.character_class == "fighter":
            character.fighting_style = character.fighting_style or "defense"
            character.second_wind_available = True
        if character.character_class == "wizard":
            character.arcane_recovery_available = True
        if character.character_class == "cleric":
            character.divine_domain = character.divine_domain or DOMAIN_LABEL
        character.quest_flags["s21_class_identity_v1"] = True
    reconcile_level_gated_features(character)


def validate_fighting_style(style: str) -> str:
    key = (style or "defense").casefold().strip()
    if key not in FIGHTING_STYLES:
        raise ValueError(f"Fighting style must be one of: {', '.join(sorted(FIGHTING_STYLES))}")
    return key


def validate_divine_domain(domain: str) -> str:
    key = (domain or DOMAIN_LABEL).casefold().strip()
    if key not in MVP_CLERIC_DOMAINS:
        raise ValueError(f"MVP supports only Life domain ({', '.join(sorted(MVP_CLERIC_DOMAINS))})")
    return key


def validate_expertise_skills(
    character_class: str,
    proficiencies: list[str],
    picks: list[str],
) -> list[str]:
    if character_class != "rogue":
        if picks:
            raise ValueError("Only rogues choose Expertise at level 1")
        return []
    if len(picks) != ROGUE_EXPERTISE_PICKS:
        raise ValueError(f"Rogue must choose exactly {ROGUE_EXPERTISE_PICKS} skills for Expertise")
    proficiencies_set = set(proficiencies)
    invalid = [skill for skill in picks if skill not in proficiencies_set]
    if invalid:
        raise ValueError("Expertise skills must be among your skill proficiencies: " + ", ".join(invalid))
    if len(set(picks)) != len(picks):
        raise ValueError("Expertise skills must be distinct")
    return list(picks)


def skill_proficiency_multiplier(character: CharacterState, skill: str) -> int:
    if skill not in character.skill_proficiencies:
        return 0
    base = proficiency_bonus(character.level)
    if skill in character.expertise_skills:
        return base * 2
    return base


def defense_style_ac_bonus(character: CharacterState) -> int:
    if character.character_class != "fighter" or character.fighting_style != "defense":
        return 0
    entry = equipped_armor_instance(character)
    if not entry:
        return 0
    armor = armor_for_label(entry.get("name", ""))
    if armor and armor.category in {"light", "medium", "heavy"}:
        return 1
    return 0


def dueling_style_damage_bonus(character: CharacterState, weapon) -> int:
    if character.character_class != "fighter" or character.fighting_style != "dueling":
        return 0
    if weapon.key == "unarmed":
        return 0
    if weapon.key in {"longsword", "shortsword", "rapier", "mace", "dagger"}:
        return 2
    return 0


def _combat_flag(character: CharacterState, key: str, default: bool = False) -> bool:
    return bool(character.combat_flags.get(key, default))


def _set_combat_flag(character: CharacterState, key: str, value: bool) -> None:
    character.combat_flags[key] = value


def reset_player_combat_class_flags(character: CharacterState) -> None:
    from .combat_action_economy import reset_player_turn_economy

    reset_player_turn_economy(character)


def mark_player_turn_start(character: CharacterState) -> None:
    from .combat_action_economy import reset_player_turn_economy
    from .combat_positioning import reset_movement_on_player_turn

    reset_player_turn_economy(character)
    reset_movement_on_player_turn(character)


def sneak_attack_dice(level: int) -> str:
    count = 1 + max(0, (level - 1) // 2)
    return f"{count}d6"


def sneak_attack_eligible(character: CharacterState, weapon, *, hit: bool) -> tuple[bool, str]:
    if not hit or character.character_class != "rogue":
        return False, ""
    if _combat_flag(character, "sneak_attack_used"):
        return False, "already_used"
    if not weapon.finesse and weapon.ability != "dexterity":
        return False, "weapon"
    if _combat_flag(character, "attack_disadvantage"):
        return False, "disadvantage"
    if _combat_flag(character, "attack_advantage") or _combat_flag(character, "hidden"):
        return True, "advantage"
    return False, "no_advantage"


def apply_sneak_attack(
    engine: GameEngine,
    character: CharacterState,
    weapon,
    *,
    critical: bool,
) -> tuple[int, dict]:
    dice = sneak_attack_dice(character.level)
    extra = engine.roll(dice, 0, critical)
    _set_combat_flag(character, "sneak_attack_used", True)
    return extra.total, {
        "kind": "sneak_attack",
        "dice": dice,
        "damage": extra.total,
        "critical": critical,
        "roll": engine._roll_facts(extra),
    }


def use_second_wind(engine: GameEngine, character: CharacterState) -> tuple[bool, list[str], dict]:
    from .combat_action_economy import spend_bonus_action

    if character.character_class != "fighter":
        return False, ["Only a fighter can use Second Wind."], {}
    if not character.second_wind_available:
        return False, ["Second Wind is spent until you finish a short or long rest."], {}
    ok, reason = spend_bonus_action(character)
    if not ok:
        return False, [reason], {}
    healing = engine.roll(SECOND_WIND_DICE, character.level)
    before = character.hp
    character.hp = min(character.max_hp, character.hp + max(0, healing.total))
    gained = character.hp - before
    character.second_wind_available = False
    facts = {
        "kind": "second_wind",
        "healing": gained,
        "dice_roll": engine._roll_facts(healing),
        "hp_after": character.hp,
    }
    return True, [
        f"Second Wind restores {gained} HP (1d10+{character.level}). "
        f"Your HP: {character.hp}/{character.max_hp}."
    ], facts


def apply_level_up_class_features(character: CharacterState) -> tuple[list[str], list[str]]:
    """Grant level-gated MVP class features exactly once per level increase."""
    mechanical: list[str] = []
    deferred: list[str] = []
    level = character.level
    klass = character.character_class
    if level == 2:
        if klass == "fighter":
            character.action_surge_available = True
            mechanical.append("Action Surge")
        elif klass == "rogue":
            mechanical.append("Cunning Action")
        elif klass == "cleric":
            mechanical.append("Channel Divinity")
            character.channel_divinity_available = True
        elif klass == "wizard":
            deferred.append("Arcane Tradition")
    return mechanical, deferred


def reconcile_level_gated_features(character: CharacterState) -> None:
    """Backfill Sprint 35 fields on legacy saves without duplicating level-up grants."""
    if character.character_class == "fighter" and character.level >= 2:
        if not character.quest_flags.get("s35_action_surge_sync"):
            if not character.action_surge_available and not character.in_combat:
                character.action_surge_available = True
            character.quest_flags["s35_action_surge_sync"] = True
    if character.character_class == "cleric" and character.level >= 2:
        if not character.quest_flags.get("s36_channel_divinity_sync"):
            if not character.channel_divinity_available and not character.in_combat:
                character.channel_divinity_available = True
            character.quest_flags["s36_channel_divinity_sync"] = True


def use_action_surge(character: CharacterState) -> tuple[bool, list[str], dict]:
    from .combat_action_economy import FLAG_ACTION_USED, _flag

    if character.character_class != "fighter" or character.level < 2:
        return False, ["Only a level 2+ fighter can use Action Surge."], {}
    if not character.in_combat:
        return False, ["Action Surge can only be used during combat."], {}
    if not character.action_surge_available:
        return False, ["Action Surge is spent until you finish a short rest."], {}
    if not _flag(character, FLAG_ACTION_USED):
        return False, ["Take an action first, then use Action Surge for another action this turn."], {}
    character.combat_flags[FLAG_ACTION_USED] = False
    character.action_surge_available = False
    facts = {"kind": "action_surge", "extra_action": True}
    return True, ["Action Surge! You can take another action this turn."], facts


def on_short_rest_class_features(character: CharacterState) -> list[str]:
    notes: list[str] = []
    if character.character_class == "fighter" and not character.second_wind_available:
        character.second_wind_available = True
        notes.append("Second Wind is available again.")
    if character.character_class == "fighter" and character.level >= 2 and not character.action_surge_available:
        character.action_surge_available = True
        notes.append("Action Surge is available again.")
    if character.character_class == "cleric" and character.level >= 2 and not character.channel_divinity_available:
        character.channel_divinity_available = True
        notes.append("Channel Divinity is available again.")
    if character.character_class == "wizard":
        character.arcane_recovery_ready = True
        notes.append("Arcane Recovery is ready.")
    return notes


def on_long_rest_class_features(character: CharacterState) -> list[str]:
    notes = on_short_rest_class_features(character)
    if character.character_class == "wizard":
        character.arcane_recovery_available = True
        character.arcane_recovery_ready = False
        notes.append("Arcane Recovery is available again after your next short rest.")
    return notes


def arcane_recovery_slot_levels(level: int) -> int:
    return max(1, (level + 1) // 2)


def use_arcane_recovery(character: CharacterState) -> tuple[bool, list[str], dict]:
    if character.in_combat:
        return False, ["Arcane Recovery cannot be used during combat."], {}
    if character.character_class != "wizard":
        return False, ["Only a wizard can use Arcane Recovery."], {}
    if not character.arcane_recovery_available:
        return False, ["Arcane Recovery is spent until you finish a long rest."], {}
    if not character.arcane_recovery_ready:
        return (
            False,
            ["Arcane Recovery can only be used after you finish a short rest (while on a long-rest cycle)."],
            {},
        )
    budget = arcane_recovery_slot_levels(character.level)
    restored: dict[int, int] = {}
    for raw_level in sorted(character.max_spell_slots, key=lambda k: int(k)):
        slot_level = int(raw_level)
        cap = int(character.max_spell_slots.get(raw_level, character.max_spell_slots.get(slot_level, 0)))
        current = int(character.spell_slots.get(raw_level, character.spell_slots.get(slot_level, 0)))
        while current < cap and budget >= slot_level:
            current += 1
            budget -= slot_level
            restored[slot_level] = restored.get(slot_level, 0) + 1
        character.spell_slots[slot_level] = current
        if raw_level != slot_level:
            character.spell_slots.pop(raw_level, None)
    if not restored:
        return False, ["You have no spell slots to recover."], {}
    character.arcane_recovery_available = False
    character.arcane_recovery_ready = False
    total = sum(restored.values())
    facts = {"kind": "arcane_recovery", "slots_restored": restored, "slot_levels_total": total}
    return (
        True,
        [f"Arcane Recovery restores {total} spell slot level(s): {restored}."],
        facts,
    )


def disciple_of_life_bonus(character: CharacterState, spell_name: str, slot_level: int) -> int:
    if character.character_class != "cleric" or character.divine_domain != DOMAIN_LABEL:
        return 0
    if spell_level(spell_name) != 1 or spell_name not in {"Cure Wounds", "Healing Word"}:
        return 0
    return 2 + max(1, slot_level)


def apply_life_domain_prepared_spells(character: CharacterState) -> None:
    if character.divine_domain != DOMAIN_LABEL:
        return
    prepared = list(character.prepared_spells)
    for spell in LIFE_DOMAIN_SPELLS:
        if spell not in prepared:
            prepared.insert(0, spell)
    character.prepared_spells = prepared


def wizard_spellbook_limit() -> int:
    return 6


def wizard_prepared_count(character: CharacterState) -> int:
    mod = (character.abilities.get("intelligence", 10) - 10) // 2
    return max(1, mod + character.level)


def cleric_prepared_count(character: CharacterState) -> int:
    mod = (character.abilities.get("wisdom", 10) - 10) // 2
    return max(1, mod + character.level)


def rebuild_wizard_spellbook(character: CharacterState, level_one_spells: list[str]) -> None:
    cantrips = [name for name in character.known_spells if (spell_level(name) or 0) == 0]
    if not cantrips and character.prepared_spells:
        cantrips = [name for name in character.prepared_spells if (spell_level(name) or 0) == 0]
    book = list(cantrips)
    for spell in level_one_spells:
        if spell not in book:
            book.append(spell)
    character.known_spells = book
    limit = wizard_prepared_count(character)
    leveled = [s for s in book if (spell_level(s) or 0) > 0]
    character.prepared_spells = leveled[:limit]


def use_cunning_dash(character: CharacterState) -> tuple[bool, list[str], dict]:
    from .combat_action_economy import spend_bonus_action

    if character.character_class != "rogue" or character.level < 2:
        return False, ["Cunning Action (Dash) requires rogue level 2."], {}
    if not character.in_combat:
        return False, ["You can only Dash during combat."], {}
    ok, reason = spend_bonus_action(character)
    if not ok:
        return False, [reason], {}
    bonus_ft = max(0, int(character.speed or 30))
    character.combat_movement_remaining_ft = max(
        0, int(character.combat_movement_remaining_ft or 0)
    ) + bonus_ft
    facts = {"kind": "cunning_dash", "movement_granted_ft": bonus_ft}
    return (
        True,
        [
            f"Cunning Action: Dash grants {bonus_ft} ft of movement this turn "
            f"({character.combat_movement_remaining_ft} ft remaining)."
        ],
        facts,
    )


def use_cunning_disengage(character: CharacterState) -> tuple[bool, list[str], dict]:
    from .combat_action_economy import spend_bonus_action
    from .combat_reactions import set_disengaged

    if character.character_class != "rogue" or character.level < 2:
        return False, ["Cunning Action (Disengage) requires rogue level 2."], {}
    if not character.in_combat:
        return False, ["You can only Disengage during combat."], {}
    ok, reason = spend_bonus_action(character)
    if not ok:
        return False, [reason], {}
    set_disengaged(character, True)
    facts = {"kind": "cunning_disengage", "disengaged": True}
    return (
        True,
        ["Cunning Action: Disengage — movement this turn will not provoke opportunity attacks."],
        facts,
    )


def _channel_divinity_dc(character: CharacterState) -> int:
    from .equipment import proficiency_bonus

    wis_mod = (character.abilities.get("wisdom", 10) - 10) // 2
    return 8 + proficiency_bonus(character.level) + wis_mod


def use_preserve_life(engine: GameEngine, character: CharacterState) -> tuple[bool, list[str], dict]:
    if character.character_class != "cleric" or character.level < 2:
        return False, ["Preserve Life requires a level 2+ Life cleric with Channel Divinity."], {}
    if character.divine_domain != DOMAIN_LABEL:
        return False, ["Preserve Life is a Life Domain Channel Divinity option."], {}
    if not character.channel_divinity_available:
        return False, ["Channel Divinity is spent until you finish a short or long rest."], {}
    if character.hp >= character.max_hp:
        return False, ["You are already at full health — nothing to preserve."], {}
    pool = 5 * character.level
    before = character.hp
    character.hp = min(character.max_hp, character.hp + pool)
    gained = character.hp - before
    character.channel_divinity_available = False
    facts = {
        "kind": "preserve_life",
        "healing": gained,
        "pool_hp": pool,
        "hp_after": character.hp,
    }
    return (
        True,
        [
            f"Channel Divinity: Preserve Life restores {gained} HP "
            f"({pool} HP pool at cleric level {character.level}). "
            f"Your HP: {character.hp}/{character.max_hp}."
        ],
        facts,
    )


def use_turn_undead(
    engine: GameEngine,
    character: CharacterState,
    monster,
) -> tuple[bool, list[str], dict]:
    from .encounters import monster_template_key

    if character.character_class != "cleric" or character.level < 2:
        return False, ["Turn Undead requires a level 2+ cleric with Channel Divinity."], {}
    if not character.in_combat or monster is None:
        return False, ["Turn Undead requires undead foes in combat."], {}
    if not character.channel_divinity_available:
        return False, ["Channel Divinity is spent until you finish a short or long rest."], {}
    key = monster_template_key(monster)
    if key not in UNDEAD_MONSTER_KEYS:
        return False, [f"Turn Undead affects undead only — {monster.name} is unaffected."], {}
    dc = _channel_divinity_dc(character)
    wis_mod = int(monster.saving_throws.get("wisdom", 0))
    roll = engine.roll("1d20", wis_mod)
    success = roll.total >= dc
    character.channel_divinity_available = False
    facts = {
        "kind": "turn_undead",
        "dc": dc,
        "roll_total": roll.total,
        "success": success,
        "target": monster.name,
    }
    if success:
        monster.hp = 0
        lines = [
            f"Channel Divinity: Turn Undead — {monster.name} fails Wisdom save "
            f"({roll.total} vs DC {dc}) and is destroyed by radiant repulsion."
        ]
    else:
        lines = [
            f"Channel Divinity: Turn Undead — {monster.name} resists "
            f"({roll.total} vs DC {dc}) and keeps fighting."
        ]
    return True, lines, facts


def try_hide_in_combat(engine: GameEngine, character: CharacterState) -> tuple[bool, list[str], dict]:
    from .combat_action_economy import spend_bonus_action

    if character.character_class != "rogue" or character.level < 2:
        return False, ["Cunning Action (Hide) requires rogue level 2."], {}
    if not character.in_combat:
        return False, ["You can only Hide during combat."], {}
    ok, reason = spend_bonus_action(character)
    if not ok:
        return False, [reason], {}
    weapon = equipped_weapon(character)
    armor_entry = equipped_armor_instance(character)
    disadvantage = False
    if armor_entry:
        armor = armor_for_label(armor_entry.get("name", ""))
        if armor and armor.stealth_disadvantage:
            disadvantage = True
    mod = engine.skill_modifier(character, "Stealth")
    if disadvantage:
        roll_a, _ = engine._d20_check(character, mod)
        roll_b, note = engine._d20_check(character, mod)
        total = min(roll_a.total, roll_b.total)
        success = total >= 12
        note = f"{note} (disadvantage on Stealth)"
    else:
        roll, note = engine._d20_check(character, mod)
        total = roll.total
        success = total >= 12
    facts = {"kind": "hide", "stealth_total": total, "success": success}
    if success:
        character.combat_flags["hidden"] = True
        character.combat_flags["attack_advantage"] = True
        return True, [f"You melt into cover (Stealth {total}). Your next strike has advantage.{note}"], facts
    _set_combat_flag(character, "attack_disadvantage", True)
    return (
        True,
        [f"You fail to find cover (Stealth {total}). You are exposed.{note}"],
        facts,
    )


def attack_advantage_roll(
    engine: GameEngine,
    character: CharacterState,
    bonus: int,
    *,
    range_disadvantage: bool = False,
) -> tuple[object, int, str]:
    """Roll attack d20; use advantage when hidden."""
    advantage = _combat_flag(character, "attack_advantage") or _combat_flag(character, "hidden")
    disadvantage = _combat_flag(character, "attack_disadvantage") or range_disadvantage
    if advantage and disadvantage:
        advantage = False
        disadvantage = False
    if advantage:
        roll_a, _ = engine._d20_check(character, bonus)
        roll_b, note = engine._d20_check(character, bonus)
        if roll_b.total >= roll_a.total:
            return roll_b, roll_b.values[0], note
        return roll_a, roll_a.values[0], note + " (advantage)"
    if disadvantage:
        roll_a, _ = engine._d20_check(character, bonus)
        roll_b, note = engine._d20_check(character, bonus)
        chosen = roll_a if roll_a.total <= roll_b.total else roll_b
        return chosen, chosen.values[0], note + " (disadvantage)"
    roll, note = engine._d20_check(character, bonus)
    return roll, roll.values[0], note


def public_class_feature_summary(character: CharacterState) -> dict:
    """API/sheet display hints — no mechanical secrets."""
    summary: dict = {
        "fighting_style": character.fighting_style or None,
        "expertise_skills": list(character.expertise_skills),
        "divine_domain": character.divine_domain or None,
        "second_wind_available": character.second_wind_available,
        "action_surge_available": character.action_surge_available,
        "channel_divinity_available": character.channel_divinity_available,
        "arcane_recovery_available": character.arcane_recovery_available,
        "arcane_recovery_ready": character.arcane_recovery_ready,
        "sneak_attack_dice": sneak_attack_dice(character.level) if character.character_class == "rogue" else None,
    }
    if character.character_class == "wizard":
        summary["spellbook_size"] = len([s for s in character.known_spells if (spell_level(s) or 0) > 0])
        summary["prepared_limit"] = wizard_prepared_count(character)
    if character.character_class == "cleric":
        summary["prepared_limit"] = cleric_prepared_count(character)
    return summary
