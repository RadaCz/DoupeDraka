"""SRD spell range vs combat_distance_ft (Combat P0a)."""

from __future__ import annotations

import re
from dataclasses import dataclass

from .reference import SPELLS
from .spells import MODELED_SPELL_EFFECTS

SPELLS_SKIP_ENEMY_RANGE = frozenset(
    {
        "Bless",
        "Cure Wounds",
        "Mage Armor",
        "Invisibility",
        "Healing Word",
        "Shield of Faith",
        "Shield",
        "Misty Step",
    }
)

ENEMY_DAMAGE_KINDS = frozenset({"spell_attack", "multi_attack", "auto_damage", "save_damage"})

_SPELL_RANGE_RAW = {spell["name"]: spell.get("range", "") for spell in SPELLS}


@dataclass(frozen=True)
class SpellRangeContext:
    allowed: bool
    denial: str = ""
    range_ft: int | None = None
    distance_ft: int = 0


def _distance_ft(character) -> int:
    dist = int(getattr(character, "combat_distance_ft", 0) or 0)
    return max(0, dist)


def parse_srd_range_ft(range_text: str) -> int | None:
    if not range_text or not str(range_text).strip():
        return None
    lowered = str(range_text).casefold().strip()
    if lowered.startswith("self"):
        cone = re.search(r"(\d+)-foot cone", lowered)
        if cone:
            return int(cone.group(1))
        return None
    feet = re.search(r"(\d+)\s*feet", lowered)
    if feet:
        return int(feet.group(1))
    if "touch" in lowered:
        return 5
    return None


def spell_catalog_range_ft(spell_name: str) -> int | None:
    raw = _SPELL_RANGE_RAW.get(spell_name)
    if raw is None:
        return None
    return parse_srd_range_ft(raw)


def spell_targets_enemy_in_combat(spell_name: str) -> bool:
    if spell_name in SPELLS_SKIP_ENEMY_RANGE:
        return False
    modeled = MODELED_SPELL_EFFECTS.get(spell_name)
    if modeled is None:
        return False
    kind = modeled[0]
    return kind in ENEMY_DAMAGE_KINDS


def format_spell_range_denial_en(spell_name: str, range_ft: int, distance_ft: int) -> str:
    return (
        f"{spell_name} has a range of {range_ft} ft. "
        f"The enemy is {distance_ft} ft away."
    )


def evaluate_spell_enemy_range(character, spell_name: str) -> SpellRangeContext:
    distance = _distance_ft(character)
    if not spell_targets_enemy_in_combat(spell_name):
        return SpellRangeContext(allowed=True, distance_ft=distance, range_ft=None)

    range_ft = spell_catalog_range_ft(spell_name)
    if range_ft is None:
        return SpellRangeContext(allowed=True, distance_ft=distance, range_ft=None)

    if distance <= range_ft:
        return SpellRangeContext(allowed=True, distance_ft=distance, range_ft=range_ft)

    return SpellRangeContext(
        allowed=False,
        denial=format_spell_range_denial_en(spell_name, range_ft, distance),
        range_ft=range_ft,
        distance_ft=distance,
    )


def combat_spell_tactics(character) -> list[dict]:
    """Prepared + known modeled spells with in-combat range eligibility."""
    if not character.in_combat:
        return []

    seen: set[str] = set()
    names: list[str] = []
    for raw in list(character.prepared_spells) + list(character.known_spells):
        normalized = re.sub(r"\s+", " ", raw.strip())
        if not normalized or normalized in seen:
            continue
        if normalized not in MODELED_SPELL_EFFECTS:
            continue
        seen.add(normalized)
        names.append(normalized)

    rows: list[dict] = []
    for spell_name in sorted(names, key=str.casefold):
        ctx = evaluate_spell_enemy_range(character, spell_name)
        range_ft = ctx.range_ft if spell_targets_enemy_in_combat(spell_name) else None
        rows.append(
            {
                "name": spell_name,
                "range_ft": range_ft,
                "can_cast": ctx.allowed,
                "denial": ctx.denial or None,
            }
        )
    return rows