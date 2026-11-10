"""One-time exploration discoveries persisted in quest_flags."""

from __future__ import annotations

import re

from .locations import LOCATIONS
from .models import CharacterState, TurnResult


def location_slug(location_name: str) -> str:
    trimmed = re.sub(r"^the\s+", "", location_name.casefold()).strip()
    return re.sub(r"[^a-z0-9]+", "_", trimmed).strip("_")


def track_flag(slug: str) -> str:
    return f"disc_track_{slug}"


def clue_flag(slug: str) -> str:
    return f"disc_clue_{slug}"


def exploration_discovery_message(
    character: CharacterState,
    *,
    kind: str,
) -> tuple[str, bool]:
    """Return journal line and whether a new persistent flag was set (kind: track|clue)."""
    location = LOCATIONS.get(character.location)
    if location is None:
        return "You find nothing new here.", False
    slug = location_slug(character.location)
    flags = character.quest_flags
    key = track_flag(slug) if kind == "track" else clue_flag(slug)
    text = location.track_discovery if kind == "track" else location.clue_discovery
    if flags.get(key):
        label = "tracks" if kind == "track" else "clue"
        return f"You already logged these {label} here; nothing new stands out.", False
    flags[key] = True
    if kind == "clue" and character.location == "The Goblin Market":
        flags["bell_market_rumor"] = True
    if kind == "clue" and character.location == "The Whispering Cellar":
        flags["cellar_panel_marked"] = True
    if kind == "track" and character.location == "The Sunken Corridor":
        flags["shrine_trail_noted"] = True
    return f"New discovery: {text}", True


def try_focused_inspect(character: CharacterState, action: str) -> TurnResult | None:
    """Targeted inspect/listen that can surface clues without a fresh explore roll."""
    if character.in_combat:
        return None
    folded = re.sub(r"\s+", " ", action.casefold())
    if not any(token in folded for token in ("inspect", "listen", "examine", "prohléd", "prozkoumej", "poslouch")):
        return None

    flags = character.quest_flags
    loc = character.location

    if loc == "The Shrine of the Forgotten" and "bowl" in folded:
        slug = location_slug(loc)
        key = clue_flag(slug)
        if flags.get(key):
            return TurnResult(
                action,
                ["The offering bowl is empty now; you already took the map fragment."],
                False,
                costs_adventure_mana=False,
            )
        flags[key] = True
        return TurnResult(
            action,
            [
                "New discovery: An offering bowl hides a map fragment marked with a green hand.",
                "Caldus might know what the green hand symbol means.",
            ],
            True,
            costs_adventure_mana=False,
        )

    if loc == "The Sunken Corridor" and ("listen" in folded or "water" in folded or "mara" in folded):
        if flags.get("mara_warned"):
            return TurnResult(
                action,
                ["The waterway still murmurs; Mara has already warned you what follows it."],
                False,
                costs_adventure_mana=False,
            )
        flags["mara_warned"] = True
        flags["heard_waterway_danger"] = True
        return TurnResult(
            action,
            [
                "New discovery: Something heavy sloshes against the stones downstream.",
                "Mara's warning rings true — danger follows the waterway.",
            ],
            True,
            costs_adventure_mana=False,
        )

    if loc == "The Goblin Market" and ("stall" in folded or "nib" in folded):
        if flags.get("bell_market_rumor"):
            return TurnResult(
                action,
                ["You already heard that the stolen shrine bell passed through this market."],
                False,
                costs_adventure_mana=False,
            )
        flags["bell_market_rumor"] = True
        return TurnResult(
            action,
            [
                "New discovery: Nib's stall smells of tarnished brass — gossip says a shrine bell changed hands here.",
                "Speak with Caldus at the shrine before pressing Nib about theft.",
            ],
            True,
            costs_adventure_mana=False,
        )

    return None
