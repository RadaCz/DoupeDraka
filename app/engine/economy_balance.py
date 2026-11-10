"""Chapter 1 gold pacing, shop prices, and rest location rules (engine authority)."""

from __future__ import annotations

from .discoveries import location_slug
from .models import CharacterState

# --- One-time quest gold (Chapter 1) ---
QUEST_BELL_RETURN_GOLD_GP = 10
CRYPT_RELIC_GOLD_GP = 15
CHAPTER_BOSS_GOLD_GP = 25

# --- Shop (Nib's stall) ---
HEALING_POTION_PRICE_GP = 45
SHORTSWORD_PLUS_ONE_PRICE_GP = 95

# --- Exploration scavenging: one 1d4 haul per location, not a farm loop ---
def gold_scavenge_flag(location_name: str) -> str:
    return f"gold_scavenge_{location_slug(location_name)}"


def roll_exploration_gold(character: CharacterState, amount: int) -> tuple[str, bool]:
    """Grant scavenged gold once per location; repeats are flavor only."""
    key = gold_scavenge_flag(character.location)
    if character.quest_flags.get(key):
        return (
            "You pick over stones and debris, but this area has no loose coin left to find.",
            False,
        )
    character.quest_flags[key] = True
    character.gold += amount
    return (
        f"You find {amount} gold pieces tucked beneath loose stones (a one-time find here).",
        True,
    )


# --- Rest ---
SAFE_LONG_REST_LOCATIONS = frozenset({
    "The Whispering Cellar",
    "The Shrine of the Forgotten",
    "The Goblin Market",
})

SHORT_REST_FLAG = "short_rest_since_shelter"


def long_rest_allowed(character: CharacterState) -> bool:
    return character.location in SAFE_LONG_REST_LOCATIONS


def short_rest_allowed(character: CharacterState) -> bool:
    return not character.quest_flags.get(SHORT_REST_FLAG)


def mark_short_rest(character: CharacterState) -> None:
    character.quest_flags[SHORT_REST_FLAG] = True


def clear_short_rest_gate(character: CharacterState) -> None:
    character.quest_flags.pop(SHORT_REST_FLAG, None)
