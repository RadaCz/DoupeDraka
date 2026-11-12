"""Concentration and typed spell buffs (Sprint 32, SRD 5.1 MVP solo)."""

from __future__ import annotations

from typing import TYPE_CHECKING

from .models import CharacterState
from .saving_throws import SavingThrowRequest, perform_saving_throw

if TYPE_CHECKING:
    from .service import GameEngine

EFFECT_BLESS = "bless"
EFFECT_SHIELD_OF_FAITH = "shield_of_faith"

CONCENTRATION_SPELLS = frozenset({"Bless", "Shield of Faith", "Invisibility"})


def concentration_active(character: CharacterState) -> bool:
    return bool((character.concentration_spell or "").strip())


def bless_attack_bonus(character: CharacterState) -> int:
    if character.concentration_effect != EFFECT_BLESS:
        return 0
    return max(0, int(character.concentration_bonus or 0))


def bless_save_bonus(character: CharacterState) -> int:
    return bless_attack_bonus(character)


def shield_of_faith_ac_bonus(character: CharacterState) -> int:
    if character.concentration_effect != EFFECT_SHIELD_OF_FAITH:
        return 0
    return 2


def mage_armor_applies(character: CharacterState) -> bool:
    if not character.mage_armor_active:
        return False
    from .equipment import equipped_armor_instance

    return equipped_armor_instance(character) is None


def mage_armor_base_ac(character: CharacterState) -> int:
    dex_mod = (character.abilities.get("dexterity", 10) - 10) // 2
    return 13 + dex_mod


def clear_concentration(character: CharacterState, *, reason: str = "") -> list[str]:
    spell = character.concentration_spell
    if not spell:
        return []
    effect = character.concentration_effect
    character.concentration_spell = ""
    character.concentration_effect = ""
    character.concentration_bonus = 0
    if effect == EFFECT_BLESS:
        msg = "Bless ends — the attack and save bonus fades."
    elif effect == EFFECT_SHIELD_OF_FAITH:
        msg = "Shield of Faith ends — the +2 AC bonus fades."
        from .equipment import refresh_armor_class

        refresh_armor_class(character)
    elif spell == "Invisibility" or effect == "invisible":
        character.invisible = False
        msg = "Invisibility ends."
    else:
        msg = f"Concentration on {spell} ends."
    if reason:
        msg = f"{msg} ({reason})"
    return [msg]


def start_concentration(
    character: CharacterState,
    *,
    spell_name: str,
    effect: str,
    bless_roll: int = 0,
) -> list[str]:
    events: list[str] = []
    if concentration_active(character):
        events.extend(clear_concentration(character, reason=f"replaced by {spell_name}"))
    character.concentration_spell = spell_name
    character.concentration_effect = effect
    character.concentration_bonus = bless_roll if effect == EFFECT_BLESS else 0
    if effect == EFFECT_BLESS:
        events.append(f"Bless: +{bless_roll} to attacks and saving throws while you concentrate (self).")
    elif effect == EFFECT_SHIELD_OF_FAITH:
        from .equipment import refresh_armor_class

        refresh_armor_class(character)
        events.append(
            f"Shield of Faith: +2 AC while you concentrate (AC {character.armor_class})."
        )
    return events


def apply_mage_armor(character: CharacterState) -> tuple[list[str], bool]:
    """Returns journal lines and whether AC changed."""
    from .equipment import equipped_armor_instance, refresh_armor_class

    if equipped_armor_instance(character):
        return ["Mage Armor has no effect while you wear armor."], False
    character.mage_armor_active = True
    refresh_armor_class(character)
    return [
        f"Mage Armor: your AC becomes {character.armor_class} (13 + DEX) until you wear armor or finish a long rest."
    ], True


def clear_mage_armor(character: CharacterState, *, reason: str = "") -> list[str]:
    if not character.mage_armor_active:
        return []
    character.mage_armor_active = False
    from .equipment import refresh_armor_class

    refresh_armor_class(character)
    note = f" ({reason})" if reason else ""
    return [f"Mage Armor ends{note}. AC is now {character.armor_class}."]


def end_concentration_if_incapacitated(character: CharacterState) -> list[str]:
    from .conditions import player_paralyzed

    if not concentration_active(character):
        return []
    if player_paralyzed(character) or character.death_state in {"fallen", "defeated"} or character.hp <= 0:
        return clear_concentration(character, reason="incapacitated")
    return []


def concentration_save_after_damage(
    engine: "GameEngine",
    character: CharacterState,
    damage: int,
) -> list[str]:
    if damage <= 0 or not concentration_active(character):
        return []
    dc = max(10, damage // 2)
    result = perform_saving_throw(
        engine,
        character,
        SavingThrowRequest("constitution", dc, "damage", "concentration"),
    )
    lines: list[str] = []
    outcome = "holds" if result.success else "fails"
    lines.append(
        f"Concentration check: Constitution DC {dc} — {outcome} "
        f"(rolled {result.d20_roll}{' + prof' if result.proficient else ''}"
        f" + {result.ability_modifier} = {result.total})."
    )
    if not result.success:
        lines.extend(clear_concentration(character, reason="concentration broken"))
    return lines


def on_long_rest_spell_state(character: CharacterState) -> list[str]:
    events: list[str] = []
    events.extend(clear_concentration(character, reason="long rest"))
    events.extend(clear_mage_armor(character, reason="long rest"))
    return [e for e in events if e]
