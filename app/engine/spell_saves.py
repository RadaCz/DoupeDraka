"""Spell saving throws — unified monster saves and damage outcomes."""

from __future__ import annotations

from typing import TYPE_CHECKING

from .conditions import apply_mockery_disadvantage
from .models import CharacterState, MonsterState
from .saving_throws import SavingThrowRequest, SavingThrowResult, format_saving_throw_lines, perform_monster_saving_throw, spell_save_dc

if TYPE_CHECKING:
    from .service import GameEngine


def resolve_spell_save_damage(
    engine: "GameEngine",
    character: CharacterState,
    monster: MonsterState,
    spell_name: str,
    *,
    damage_dice: str,
    save_ability: str,
    save_on_success: str,
    damage_count: int,
    damage_die: str,
) -> tuple[int, SavingThrowResult, list[str], dict]:
    """Returns damage dealt, save result, journal lines, effect extras."""
    dc = spell_save_dc(character)
    request = SavingThrowRequest(
        ability=save_ability,
        dc=dc,
        source="spell",
        source_id=spell_name.casefold().replace(" ", "_"),
    )
    context = f"You cast {spell_name}."
    save_result = perform_monster_saving_throw(engine, monster, request)
    lines = format_saving_throw_lines(save_result, context=context)
    extras: dict = {}

    rolled_total = 0
    if save_on_success == "none" and save_result.success:
        damage = 0
    else:
        if save_on_success == "none":
            rolled = engine.roll(f"{damage_count}d{damage_die}")
            rolled_total = rolled.total
            damage = rolled.total if not save_result.success else 0
        else:
            rolled = engine.roll(f"{damage_count}d{damage_die}")
            rolled_total = rolled.total
            if save_result.success and save_on_success == "half":
                damage = rolled.total // 2
            elif save_result.success:
                damage = 0
            else:
                damage = rolled.total

    if spell_name == "Vicious Mockery" and not save_result.success:
        lines.extend(apply_mockery_disadvantage(monster, request.source_id, character.combat_round))
        extras["disadvantage_next_attack"] = True
    elif spell_name == "Vicious Mockery" and save_result.success:
        extras["disadvantage_next_attack"] = False

    outcome = "succeeds" if save_result.success else "fails"
    if damage > 0:
        lines.append(
            f"{monster.name} {outcome} the save; takes {damage} damage"
            + (f" (rolled {rolled_total})." if rolled_total and damage != rolled_total else ".")
        )
    else:
        lines.append(f"{monster.name} {outcome} the save; takes no damage.")

    return max(0, damage), save_result, lines, extras
