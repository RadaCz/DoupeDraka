"""SRD 5.1 combat action economy — Action, Bonus Action, Reaction (Sprint 25)."""

from __future__ import annotations

from typing import Literal

from .models import CharacterState
from .spells import MODELED_SPELL_EFFECTS, spell_level

ActionCost = Literal["action", "bonus", "reaction", "free"]

FLAG_ACTION_USED = "action_used"
FLAG_BONUS_USED = "bonus_action_used"
FLAG_REACTION_USED = "reaction_used"

BONUS_ACTION_SPELLS = frozenset({"Healing Word", "Shield of Faith"})
REACTION_SPELLS = frozenset({"Shield"})

FLAG_CAST_BONUS_SPELL = "cast_bonus_spell_turn"
FLAG_CAST_LEVELED_ACTION_SPELL = "cast_leveled_action_spell_turn"
BONUS_ACTION_CLASS = frozenset({"second_wind", "hide"})


def _flag(character: CharacterState, key: str, default: bool = False) -> bool:
    return bool(character.combat_flags.get(key, default))


def _set(character: CharacterState, key: str, value: bool) -> None:
    character.combat_flags[key] = value


def reset_player_turn_economy(character: CharacterState) -> None:
    """Called at the start of each player combat turn."""
    from .combat_reactions import FLAG_DISENGAGED
    from .reactive_spells import clear_shield_buff

    clear_shield_buff(character)
    hidden = bool(character.combat_flags.get("hidden"))
    character.combat_flags = {
        **character.combat_flags,
        FLAG_ACTION_USED: False,
        FLAG_BONUS_USED: False,
        FLAG_REACTION_USED: False,
        FLAG_DISENGAGED: False,
        "hidden": hidden,
        "sneak_attack_used": False,
        "attack_advantage": hidden,
        "attack_disadvantage": False,
        FLAG_CAST_BONUS_SPELL: False,
        FLAG_CAST_LEVELED_ACTION_SPELL: False,
    }


def economy_snapshot(character: CharacterState) -> dict[str, bool | int]:
    player_turn = character.in_combat and character.combat_turn == "player"
    in_combat = character.in_combat
    return {
        "round": character.combat_round,
        "player_turn": player_turn,
        "action_available": player_turn and not _flag(character, FLAG_ACTION_USED),
        "bonus_available": player_turn and not _flag(character, FLAG_BONUS_USED),
        "reaction_available": in_combat and not _flag(character, FLAG_REACTION_USED),
        "action_used": _flag(character, FLAG_ACTION_USED),
        "bonus_used": _flag(character, FLAG_BONUS_USED),
        "reaction_used": _flag(character, FLAG_REACTION_USED),
    }


def clear_economy_on_combat_end(character: CharacterState) -> None:
    for key in (FLAG_ACTION_USED, FLAG_BONUS_USED, FLAG_REACTION_USED):
        character.combat_flags.pop(key, None)


def spend_action(character: CharacterState) -> tuple[bool, str]:
    if not character.in_combat:
        return True, ""
    if _flag(character, FLAG_ACTION_USED):
        return False, "You already used your action this turn."
    _set(character, FLAG_ACTION_USED, True)
    return True, ""


def spend_bonus_action(character: CharacterState) -> tuple[bool, str]:
    if not character.in_combat:
        return True, ""
    if _flag(character, FLAG_BONUS_USED):
        return False, "You already used your bonus action this turn."
    _set(character, FLAG_BONUS_USED, True)
    return True, ""


def spend_reaction(character: CharacterState) -> tuple[bool, str]:
    if not character.in_combat:
        return True, ""
    if _flag(character, FLAG_REACTION_USED):
        return False, "You already used your reaction this round."
    _set(character, FLAG_REACTION_USED, True)
    return True, ""


def has_legitimate_bonus_action(character: CharacterState) -> bool:
    """Whether the player still has a modeled bonus action they can take this turn."""
    if not character.in_combat or character.combat_turn != "player":
        return False
    if _flag(character, FLAG_BONUS_USED):
        return False
    if character.character_class == "fighter" and character.second_wind_available:
        return True
    if character.character_class == "rogue":
        return True
    if character.hp < character.max_hp:
        spells = {s.casefold() for s in character.prepared_spells + character.known_spells}
        if "healing word" in spells:
            slots = character.spell_slots
            for key in (1, "1"):
                if int(slots.get(key, 0)) > 0:
                    return True
    return False


def should_advance_enemy_after_player_activity(character: CharacterState) -> bool:
    """Enemy turn when the player's combat activity is complete for this round."""
    if not character.in_combat:
        return False
    action_used = _flag(character, FLAG_ACTION_USED)
    bonus_used = _flag(character, FLAG_BONUS_USED)
    if action_used and bonus_used:
        return True
    if action_used and not has_legitimate_bonus_action(character):
        return True
    return False


def spell_combat_cost(spell_name: str) -> ActionCost:
    if spell_name in REACTION_SPELLS:
        return "reaction"
    if spell_name in BONUS_ACTION_SPELLS:
        return "bonus"
    if spell_name in MODELED_SPELL_EFFECTS:
        return "action"
    level = spell_level(spell_name)
    if level is not None and level >= 0:
        return "action"
    return "free"


def reserve_combat_cost(
    character: CharacterState,
    cost: ActionCost,
) -> tuple[bool, str]:
    if not character.in_combat or cost == "free":
        return True, ""
    if cost == "action":
        return spend_action(character)
    if cost == "bonus":
        return spend_bonus_action(character)
    if cost == "reaction":
        return spend_reaction(character)
    return True, ""
