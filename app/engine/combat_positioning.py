"""Deterministic combat distance and movement (feet) — no grid (Sprint 27)."""

from __future__ import annotations

from dataclasses import dataclass

from .models import CharacterState, MonsterState

DEFAULT_START_DISTANCE_FT = 5
MELEE_REACH_FT = 5

# Encounter-specific opening distance (feet).
ENCOUNTER_START_DISTANCE_FT: dict[str, int] = {
    "kobold": 60,
    "goblin": 5,
    "wolf": 5,
    "skeleton": 5,
    "bandit": 15,
    "hobgoblin": 5,
    "ghoul": 5,
    "orc": 5,
    "bandit_captain": 5,
    "ogre": 5,
    "bell_warden": 5,
}


@dataclass(frozen=True)
class MonsterCombatProfile:
    template_key: str
    speed_ft: int
    preferred_melee: bool
    ranged_normal_ft: int = 0
    ranged_long_ft: int = 0


MONSTER_COMBAT_PROFILES: dict[str, MonsterCombatProfile] = {
    "kobold": MonsterCombatProfile("kobold", 30, False, 80, 320),
    "goblin": MonsterCombatProfile("goblin", 30, True),
    "wolf": MonsterCombatProfile("wolf", 40, True),
    "skeleton": MonsterCombatProfile("skeleton", 30, True),
    "bandit": MonsterCombatProfile("bandit", 30, True),
    "hobgoblin": MonsterCombatProfile("hobgoblin", 30, True),
    "ghoul": MonsterCombatProfile("ghoul", 30, True),
    "orc": MonsterCombatProfile("orc", 30, True),
    "bandit_captain": MonsterCombatProfile("bandit_captain", 30, True),
    "ogre": MonsterCombatProfile("ogre", 40, True),
    "bell_warden": MonsterCombatProfile("bell_warden", 30, True),
}


def monster_profile(key: str) -> MonsterCombatProfile:
    return MONSTER_COMBAT_PROFILES.get(
        key,
        MonsterCombatProfile(key, 30, True),
    )


def init_combat_distance(character: CharacterState, monster_key: str) -> list[str]:
    distance = ENCOUNTER_START_DISTANCE_FT.get(monster_key, DEFAULT_START_DISTANCE_FT)
    character.combat_distance_ft = max(0, distance)
    character.combat_movement_remaining_ft = max(0, int(character.speed or 30))
    return [f"Combat opens at {character.combat_distance_ft} ft."]


def reset_movement_on_player_turn(character: CharacterState) -> None:
    character.combat_movement_remaining_ft = max(0, int(character.speed or 30))


def clear_combat_positioning(character: CharacterState) -> None:
    character.combat_distance_ft = 0
    character.combat_movement_remaining_ft = 0


def movement_remaining(character: CharacterState) -> int:
    return max(0, int(getattr(character, "combat_movement_remaining_ft", 0) or 0))


def apply_player_movement(character: CharacterState, delta_ft: int) -> tuple[bool, list[str]]:
    """Positive delta = retreat; negative = advance toward enemy."""
    if not character.in_combat:
        return False, ["You are not in combat."]
    if delta_ft == 0:
        return False, ["Specify how far to move."]
    remaining = movement_remaining(character)
    steps = abs(delta_ft)
    if steps > remaining:
        return False, [f"You can move at most {remaining} ft this turn (speed {character.speed} ft)."]
    distance = max(0, int(character.combat_distance_ft or 0))
    if delta_ft < 0:
        distance = max(0, distance + delta_ft)
        verb = "advance"
    else:
        distance = distance + delta_ft
        verb = "retreat"
    character.combat_distance_ft = distance
    character.combat_movement_remaining_ft = remaining - steps
    return True, [
        f"You {verb} {steps} ft — now {distance} ft from {character.combatant.get('name', 'the enemy') if character.combatant else 'the enemy'}. "
        f"Movement remaining: {character.combat_movement_remaining_ft} ft."
    ]


def enemy_movement_toward(character: CharacterState, profile: MonsterCombatProfile) -> list[str]:
    distance = max(0, int(character.combat_distance_ft or 0))
    if distance <= MELEE_REACH_FT:
        return []
    step = min(profile.speed_ft, distance - MELEE_REACH_FT)
    if step <= 0:
        return []
    character.combat_distance_ft = distance - step
    return [f"{profile.template_key.replace('_', ' ').title()} closes {step} ft (now {character.combat_distance_ft} ft)."]


def enemy_retreat_from_melee(character: CharacterState, profile: MonsterCombatProfile, *, target_ft: int = 30) -> list[str]:
    distance = max(0, int(character.combat_distance_ft or 0))
    if distance >= target_ft:
        return []
    step = min(profile.speed_ft, target_ft - distance)
    character.combat_distance_ft = distance + step
    return [f"{profile.template_key.replace('_', ' ').title()} backs away {step} ft (now {character.combat_distance_ft} ft)."]


def enemy_can_melee_attack(character: CharacterState) -> bool:
    return max(0, int(character.combat_distance_ft or 0)) <= MELEE_REACH_FT


def enemy_can_ranged_attack(character: CharacterState, profile: MonsterCombatProfile) -> bool:
    if profile.ranged_long_ft <= 0:
        return False
    distance = max(0, int(character.combat_distance_ft or 0))
    return distance <= profile.ranged_long_ft


def positioning_facts(character: CharacterState) -> dict:
    return {
        "distance_ft": max(0, int(character.combat_distance_ft or 0)),
        "movement_remaining_ft": movement_remaining(character),
        "speed_ft": int(character.speed or 30),
    }
