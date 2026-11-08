"""Player-facing tools: an encounter difficulty calculator.

Uses the 5e encounter building maths: sum each monster's base XP, apply the
group multiplier for action economy, then compare against the party's daily
thresholds. Pure functions so the API and CLI share one implementation.
"""
from .encounters import MONSTERS, resolve_template
from .reference import SPELLS
from .spells import MODELED_SPELL_EFFECTS

XP_THRESHOLDS = {
    1: (25, 50, 75, 100),
    2: (50, 100, 150, 200),
    3: (75, 150, 225, 400),
    4: (125, 250, 375, 500),
    5: (250, 500, 750, 1100),
}

# Encounter multipliers for the number of monsters in a group.
GROUP_MULTIPLIERS = ((1, 1.0), (2, 1.5), (3, 2.0), (6, 2.5), (10, 3.0), (14, 4.0))
BANDS = ("trivial", "easy", "medium", "hard", "deadly")


def monster_xp(key: str) -> int:
    try:
        return MONSTERS[key].reward_xp
    except KeyError as error:
        raise ValueError(f"Unknown monster: {key}") from error


def group_multiplier(count: int) -> float:
    for limit, multiplier in GROUP_MULTIPLIERS:
        if count <= limit:
            return multiplier
    return GROUP_MULTIPLIERS[-1][1]


def party_thresholds(party_levels: list[int]) -> tuple[int, int, int, int]:
    """Sum the easy/medium/hard/deadly thresholds for the whole party."""
    totals = [0, 0, 0, 0]
    for level in party_levels:
        if not 1 <= level <= 20:
            raise ValueError(f"Party level out of range: {level}")
        row = XP_THRESHOLDS.get(level)
        if row is None:
            # Levels above the table scale off the level 5 row: the exact
            # numbers do not matter for a relative difficulty band.
            row = tuple(value * (level - 4) for value in XP_THRESHOLDS[5])
        for index, value in enumerate(row):
            totals[index] += value
    return tuple(totals)  # type: ignore[return-value]


def combat_calculator(party_levels: list[int], monsters: list[str]) -> dict:
    """Rate an encounter for a party, returning the adjusted XP and a band."""
    if not party_levels:
        raise ValueError("At least one party member is required")
    if not monsters:
        raise ValueError("At least one monster is required")
    base_xp = sum(monster_xp(resolve_template(key).key) for key in monsters)
    adjusted = round(base_xp * group_multiplier(len(monsters)))
    easy, medium, hard, deadly = party_thresholds(party_levels)

    # Ascending thresholds: each band is the highest one the encounter reaches.
    # (A duplicated "deadly" branch here previously made "hard" unreachable.)
    if adjusted >= deadly:
        band = "deadly"
    elif adjusted >= hard:
        band = "hard"
    elif adjusted >= medium:
        band = "medium"
    elif adjusted >= easy:
        band = "easy"
    else:
        band = "trivial"
    return {
        "base_xp": base_xp,
        "adjusted_xp": adjusted,
        "multiplier": group_multiplier(len(monsters)),
        "band": band,
        "thresholds": {
            "easy": easy, "medium": medium, "hard": hard, "deadly": deadly,
        },
    }


def spell_library() -> list[dict]:
    return [
        {**spell, "effect_modeled": spell["name"] in MODELED_SPELL_EFFECTS}
        for spell in SPELLS
    ]