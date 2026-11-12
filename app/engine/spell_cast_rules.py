"""SRD bonus-action spell pairing rule (Sprint 32)."""

from __future__ import annotations

from .combat_action_economy import (
    BONUS_ACTION_SPELLS,
    FLAG_CAST_BONUS_SPELL,
    FLAG_CAST_LEVELED_ACTION_SPELL,
    _flag,
    _set,
)
from .models import CharacterState
from .spells import spell_level


def validate_spell_turn_pairing(character: CharacterState, spell_name: str) -> tuple[bool, str]:
    if not character.in_combat:
        return True, ""
    level = spell_level(spell_name) or 0
    is_bonus = spell_name in BONUS_ACTION_SPELLS
    if is_bonus and _flag(character, FLAG_CAST_LEVELED_ACTION_SPELL):
        return (
            False,
            "You already cast a leveled spell with your action; you cannot cast another leveled spell as a bonus action.",
        )
    if not is_bonus and level > 0 and _flag(character, FLAG_CAST_BONUS_SPELL):
        return (
            False,
            "After a bonus-action spell, you may only cast a cantrip with your action this turn.",
        )
    return True, ""


def record_spell_cast_turn_flags(character: CharacterState, spell_name: str) -> None:
    if not character.in_combat or spell_name == "Shield":
        return
    level = spell_level(spell_name) or 0
    if spell_name in BONUS_ACTION_SPELLS:
        _set(character, FLAG_CAST_BONUS_SPELL, True)
    elif level > 0:
        _set(character, FLAG_CAST_LEVELED_ACTION_SPELL, True)
