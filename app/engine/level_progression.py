"""Authoritative MVP level-up helpers (Sprint 35).

XP thresholds stay aligned with GameEngine.XP_THRESHOLD / chapter_one_progression.
HP on level-up uses the rounded-up average hit die (not a random roll).
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from .catalog import CLASSES

if TYPE_CHECKING:
    from .models import CharacterState


def average_hit_die_gain(hit_die: int, constitution_modifier: int) -> int:
    """SRD average: (die / 2) rounded up, plus CON modifier; minimum 1 HP gained."""
    average = (hit_die // 2) + 1
    return max(1, average + constitution_modifier)


def hp_gain_on_level_up(character: CharacterState) -> int:
    spec = CLASSES[character.character_class]
    con_mod = (character.abilities.get("constitution", 10) - 10) // 2
    return average_hit_die_gain(spec.hit_die, con_mod)
