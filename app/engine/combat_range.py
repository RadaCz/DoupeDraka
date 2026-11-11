"""SRD 5.1 weapon ranges and attack eligibility (Sprint 27)."""

from __future__ import annotations

import re
from dataclasses import dataclass

from .equipment import WeaponDefinition

_THROW_PATTERN = re.compile(r"\b(?:throw|h(?:o|ů)d(?:it)?|hodit)\b", re.IGNORECASE)


def attack_is_thrown(action: str, weapon: WeaponDefinition) -> bool:
    if weapon.thrown_normal_ft <= 0:
        return False
    return bool(_THROW_PATTERN.search(action))
from .models import CharacterState

MELEE_REACH_FT = 5


@dataclass(frozen=True)
class AttackRangeContext:
    allowed: bool
    disadvantage: bool
    reason: str = ""
    denial: str = ""
    attack_mode: str = "melee"
    distance_ft: int = 0
    normal_ft: int = 0
    long_ft: int = 0


def _distance_ft(character: CharacterState) -> int:
    dist = int(getattr(character, "combat_distance_ft", 0) or 0)
    return max(0, dist)


def effective_attack_ranges(weapon: WeaponDefinition, *, thrown: bool = False) -> tuple[int, int, str]:
    if thrown and weapon.thrown_normal_ft > 0:
        return weapon.thrown_normal_ft, weapon.thrown_long_ft, "thrown"
    if weapon.weapon_type == "ranged":
        return weapon.range_normal_ft, weapon.range_long_ft, "ranged"
    return MELEE_REACH_FT, MELEE_REACH_FT, "melee"


def evaluate_player_attack_range(
    character: CharacterState,
    weapon: WeaponDefinition,
    *,
    thrown: bool = False,
) -> AttackRangeContext:
    distance = _distance_ft(character)
    normal, long_max, mode = effective_attack_ranges(weapon, thrown=thrown)

    if mode == "melee" and distance > MELEE_REACH_FT:
        return AttackRangeContext(
            allowed=False,
            disadvantage=False,
            denial=f"{weapon.name.title()} cannot reach — {distance} ft away (melee reach {MELEE_REACH_FT} ft). Move closer first.",
            attack_mode=mode,
            distance_ft=distance,
            normal_ft=normal,
            long_ft=long_max,
        )

    if mode in {"ranged", "thrown"} and distance > long_max:
        return AttackRangeContext(
            allowed=False,
            disadvantage=False,
            denial=(
                f"Target is {distance} ft away — beyond {weapon.name} maximum range "
                f"({long_max} ft)."
            ),
            attack_mode=mode,
            distance_ft=distance,
            normal_ft=normal,
            long_ft=long_max,
        )

    disadvantage = False
    reason = ""
    if mode == "ranged" and distance <= MELEE_REACH_FT:
        disadvantage = True
        reason = "ranged in melee"
    elif mode in {"ranged", "thrown"} and distance > normal:
        disadvantage = True
        reason = "long range"

    return AttackRangeContext(
        allowed=True,
        disadvantage=disadvantage,
        reason=reason,
        attack_mode=mode,
        distance_ft=distance,
        normal_ft=normal,
        long_ft=long_max,
    )


def ammunition_label(weapon: WeaponDefinition) -> str:
    return (weapon.ammunition or "").strip().casefold()


def has_ammunition(character: CharacterState, weapon: WeaponDefinition) -> bool:
    label = ammunition_label(weapon)
    if not label:
        return True
    for item in character.inventory:
        lowered = item.casefold()
        if label in lowered:
            return True
        if label == "arrow" and "arrow" in lowered:
            return True
        if label == "bolt" and "bolt" in lowered:
            return True
    return False


def consume_ammunition(character: CharacterState, weapon: WeaponDefinition) -> tuple[bool, str]:
    label = ammunition_label(weapon)
    if not label:
        return True, ""
    for index, item in enumerate(character.inventory):
        lowered = item.casefold()
        if label not in lowered and not (label == "arrow" and "arrow" in lowered):
            continue
        if lowered.startswith("20 ") and "arrow" in lowered:
            character.inventory[index] = "19 arrows"
            return True, " (1 arrow spent)"
        import re

        match = re.search(r"(\d+)\s*arrow", lowered)
        if match:
            count = int(match.group(1))
            if count <= 1:
                character.inventory.pop(index)
                return True, " (last arrow spent)"
            character.inventory[index] = f"{count - 1} arrows"
            return True, " (1 arrow spent)"
        character.inventory.pop(index)
        return True, f" ({item} spent)"
    return False, ""


def weapon_range_display(weapon: WeaponDefinition) -> dict:
    normal, long_max, mode = effective_attack_ranges(weapon)
    return {
        "weapon_key": weapon.key,
        "weapon_type": weapon.weapon_type,
        "attack_mode": mode,
        "normal_ft": normal,
        "long_ft": long_max if long_max != normal else None,
        "properties": list(weapon.properties),
        "ammunition": weapon.ammunition or None,
        "damage_type": weapon.damage_type,
    }


def combat_range_facts(character: CharacterState, weapon: WeaponDefinition | None = None) -> dict:
    from .equipment import equipped_weapon

    w = weapon or equipped_weapon(character)
    distance = _distance_ft(character)
    ctx = evaluate_player_attack_range(character, w)
    payload = {
        "distance_ft": distance,
        "can_attack": ctx.allowed,
        "disadvantage_reason": ctx.reason or None,
        **weapon_range_display(w),
    }
    if not ctx.allowed:
        payload["denial"] = ctx.denial
    return payload
