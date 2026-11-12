"""Opportunity attacks, Disengage, and reaction pacing (Sprint 29, SRD 5.1 2014 slice)."""

from __future__ import annotations

from typing import TYPE_CHECKING

from .combat_positioning import MELEE_REACH_FT

if TYPE_CHECKING:
    from .models import CharacterState, MonsterState
    from .service import GameEngine

FLAG_DISENGAGED = "disengaged"
FLAG_ENEMY_REACTION_USED = "enemy_reaction_used"


def movement_left_melee_reach(before_ft: int, after_ft: int) -> bool:
    """Voluntary movement that ends outside melee reach after being in reach."""
    return before_ft <= MELEE_REACH_FT and after_ft > MELEE_REACH_FT


def is_disengaged(character: CharacterState) -> bool:
    return bool(character.combat_flags.get(FLAG_DISENGAGED))


def set_disengaged(character: CharacterState, value: bool) -> None:
    if value:
        character.combat_flags[FLAG_DISENGAGED] = True
    else:
        character.combat_flags.pop(FLAG_DISENGAGED, None)


def clear_disengage_on_player_turn(character: CharacterState) -> None:
    set_disengaged(character, False)


def reset_enemy_reaction_for_new_enemy_turn(character: CharacterState) -> None:
    """Enemy regains reaction at the start of their turn."""
    character.combat_flags[FLAG_ENEMY_REACTION_USED] = False


def enemy_reaction_spent(character: CharacterState) -> bool:
    return bool(character.combat_flags.get(FLAG_ENEMY_REACTION_USED))


def spend_enemy_reaction(character: CharacterState) -> tuple[bool, str]:
    if enemy_reaction_spent(character):
        return False, f"{_enemy_name(character)} has already used its reaction this round."
    character.combat_flags[FLAG_ENEMY_REACTION_USED] = True
    return True, ""


def _enemy_name(character: CharacterState) -> str:
    if character.combatant and character.combatant.get("name"):
        return str(character.combatant["name"])
    return "The enemy"


def opportunity_attack_preamble(*, attacker_is_player: bool, defender_name: str) -> str:
    if attacker_is_player:
        return f"Opportunity attack — you strike as {defender_name} retreats."
    return f"Opportunity attack — {defender_name} lashes out as you withdraw."


def sync_monster_to_combatant(character: CharacterState, monster: MonsterState | None) -> None:
    if monster is None:
        character.combatant = None
    else:
        from dataclasses import asdict

        character.combatant = asdict(monster)
