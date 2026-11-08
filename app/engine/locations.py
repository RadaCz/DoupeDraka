"""Data for the first four connected campaign locations."""

from dataclasses import dataclass
import re


@dataclass(frozen=True)
class Location:
    name: str
    connections: tuple[str, ...]
    encounter_pool: tuple[str, ...]
    track_discovery: str
    clue_discovery: str
    arrival_beat: str


LOCATIONS = {
    location.name: location
    for location in (
        Location(
            name="The Whispering Cellar",
            connections=("The Sunken Corridor",),
            encounter_pool=("kobold", "goblin", "wolf", "bandit"),
            track_discovery="Fresh tracks cross the dust and lead toward the sunken corridor.",
            clue_discovery="Scratches around a stone panel mark the cellar's hidden passage.",
            arrival_beat="A cold draft curls around the old stone stairs.",
        ),
        Location(
            name="The Sunken Corridor",
            connections=("The Shrine of the Forgotten", "The Whispering Cellar"),
            encounter_pool=("kobold", "goblin", "wolf", "ghoul"),
            track_discovery="Wet footprints lead toward a pale light beneath the shrine doors.",
            clue_discovery="A brass token stamped with a broken moon lies in the silt.",
            arrival_beat="Mara, a lantern-bearing scavenger, warns that something follows the waterway.",
        ),
        Location(
            name="The Shrine of the Forgotten",
            connections=("The Goblin Market", "The Sunken Corridor"),
            encounter_pool=("bandit", "ghoul", "wolf"),
            track_discovery="Boot prints cross the shrine dust and continue toward a crowded bazaar.",
            clue_discovery="An offering bowl hides a map fragment marked with a green hand.",
            arrival_beat="A quiet caretaker named Caldus asks you to return a stolen shrine bell.",
        ),
        Location(
            name="The Goblin Market",
            connections=("The Shrine of the Forgotten",),
            encounter_pool=("kobold", "goblin", "bandit"),
            track_discovery="A trail of copper scales vanishes behind the market's shuttered stalls.",
            clue_discovery="Nib, a goblin trader, claims the stolen shrine bell changed hands at this market.",
            arrival_beat="Goblin trader Nib watches from a stall of mismatched charms and stolen bells.",
        ),
    )
}

def travel_destination(current_location: str, action: str) -> str | None:
    """Return a connected destination for explicit 'travel/go/head to' actions."""
    match = re.match(
        r"^\s*(?:travel|go|head|move|cestuj|jdi|vydej se)\s+(?:to|do|k)\s+(.+?)\s*[.!?]*\s*$",
        action,
        re.IGNORECASE,
    )
    if not match:
        return None

    current = LOCATIONS.get(current_location)
    if current is None:
        return None
    requested = re.sub(r"\s+", " ", match.group(1)).casefold()
    for destination in current.connections:
        if requested == destination.casefold():
            return destination
    return None


def is_travel_action(action: str) -> bool:
    return re.match(
        r"^\s*(?:travel|go|head|move|cestuj|jdi|vydej se)\s+(?:to|do|k)\s+.+",
        action,
        re.IGNORECASE,
    ) is not None
