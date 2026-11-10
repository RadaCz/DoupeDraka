"""Story-paced XP and first vault descent (Chapter 1, Sprint 15)."""

from __future__ import annotations

from typing import Callable

from .encounters import build_monster
from .models import CharacterState, MonsterState
from .ruleset_v1 import MAX_MVP_LEVEL

XP_PER_LEVEL = 100  # Keep in sync with GameEngine.XP_THRESHOLD

LevelUpFn = Callable[[CharacterState], tuple[list[str], dict]]

VAULT_ROUTE_REVEAL_XP = 50
VAULT_FIRST_DESCENT_STORY_XP = 85
FIRST_DESCENT_MONSTER_KEY = "kobold"
VAULT_LOCATION = "The Vault of Echoes"

FLAG_VAULT_ROUTE_XP = "story_xp_vault_route_awarded"
FLAG_VAULT_DESCENT_SPAWNED = "vault_first_descent_spawned"
FLAG_VAULT_DESCENT_STORY_XP = "vault_first_descent_story_awarded"


def apply_xp_with_level_ups(
    character: CharacterState,
    amount: int,
    level_up: LevelUpFn,
    *,
    reason_line: str | None = None,
) -> tuple[list[str], dict]:
    """Add XP and run level_up until below threshold or max level."""
    events: list[str] = []
    facts: dict = {}
    if amount <= 0 or character.level >= MAX_MVP_LEVEL:
        if character.level >= MAX_MVP_LEVEL:
            character.xp = min(character.xp, 99)
        return events, facts
    character.xp += amount
    if reason_line:
        events.append(reason_line)
    while character.level < MAX_MVP_LEVEL and character.xp >= XP_PER_LEVEL:
        level_events, level_facts = level_up(character)
        events.extend(level_events)
        if level_facts:
            facts = level_facts
    return events, facts


def grant_idempotent_story_xp(
    character: CharacterState,
    amount: int,
    flag_key: str,
    level_up: LevelUpFn,
    reason_line: str,
) -> tuple[list[str], dict, bool]:
    if character.quest_flags.get(flag_key):
        return [], {}, False
    character.quest_flags[flag_key] = True
    events, facts = apply_xp_with_level_ups(
        character,
        amount,
        level_up,
        reason_line=reason_line,
    )
    return events, facts, True


def award_vault_route_reveal_xp(
    character: CharacterState,
    level_up: LevelUpFn,
) -> tuple[list[str], dict, bool]:
    return grant_idempotent_story_xp(
        character,
        VAULT_ROUTE_REVEAL_XP,
        FLAG_VAULT_ROUTE_XP,
        level_up,
        f"You gain {VAULT_ROUTE_REVEAL_XP} XP for uncovering the vault route.",
    )


def award_vault_first_descent_story_xp(
    character: CharacterState,
    level_up: LevelUpFn,
) -> tuple[list[str], dict, bool]:
    if not character.quest_flags.get(FLAG_VAULT_DESCENT_SPAWNED):
        return [], {}, False
    return grant_idempotent_story_xp(
        character,
        VAULT_FIRST_DESCENT_STORY_XP,
        FLAG_VAULT_DESCENT_STORY_XP,
        level_up,
        f"You gain {VAULT_FIRST_DESCENT_STORY_XP} XP for surviving the vault's first descent.",
    )


def begin_vault_first_descent(
    character: CharacterState,
    *,
    difficulty: str,
) -> tuple[list[str], MonsterState | None]:
    """One-time scripted encounter on first entry to the Vault (or reprise if fled)."""
    if not character.quest_flags.get("vault_unlocked"):
        return [], None
    if character.quest_flags.get(FLAG_VAULT_DESCENT_STORY_XP):
        return [], None
    if character.in_combat:
        return [], None

    reprise = character.quest_flags.get(FLAG_VAULT_DESCENT_SPAWNED)
    if reprise and character.quest_flags.get("_vault_descent_cleared_kill"):
        return [], None

    if not reprise:
        character.quest_flags[FLAG_VAULT_DESCENT_SPAWNED] = True

    monster = build_monster(difficulty, FIRST_DESCENT_MONSTER_KEY)
    character.in_combat = True
    character.combat_turn = "player"
    character.combat_round = 0
    character.exploration_cooldown = 1

    lead = (
        "The echoes still hunt anyone who fled the threshold."
        if reprise
        else "New discovery: The vault's first descent tests every pilgrim."
    )
    return (
        [
            lead,
            "A kobold scout darts from the bell-chains — the vault still defends itself.",
            f"An enemy appears: {monster.name} ({monster.hp} HP).",
            "The creature has not attacked yet. Choose your next action.",
        ],
        monster,
    )


def on_vault_descent_victory(character: CharacterState) -> None:
    """Mark kill cleared so we do not respawn after success."""
    if character.location == VAULT_LOCATION and character.quest_flags.get(FLAG_VAULT_DESCENT_SPAWNED):
        character.quest_flags["_vault_descent_cleared_kill"] = True
