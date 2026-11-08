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
            connections=(
                "The Shrine of the Forgotten",
                "The Whispering Cellar",
                "The Vault of Echoes",
            ),
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
        Location(
            name="The Vault of Echoes",
            connections=("The Sunken Corridor", "The Bell Warden's Pit"),
            encounter_pool=("ghoul", "bandit", "wolf"),
            track_discovery="Bell scratches mark a spiral path deeper into the vault.",
            clue_discovery="A rusted key ring holds a shrine tag that reads 'return what was stolen'.",
            arrival_beat="Damp stone amplifies every footstep; broken bells hang from rusted chains.",
        ),
        Location(
            name="The Bell Warden's Pit",
            connections=("The Vault of Echoes",),
            encounter_pool=("bell_warden", "ghoul"),
            track_discovery="The pit floor is scorched in a ring around a shattered brazier.",
            clue_discovery="Carved into the wall: 'The Warden keeps tolls even in death.'",
            arrival_beat="A hulking Bell Warden stirs, shackled bells rattling on its rusted armor.",
        ),
    )
}

def travel_allowed(destination: str, quest_flags: dict) -> bool:
    """Campaign gates for chapter one routes."""
    if destination in ("The Vault of Echoes", "The Bell Warden's Pit"):
        return bool(quest_flags.get("vault_unlocked") or quest_flags.get("vault_hint_given"))
    return True


def visible_connections(current_location: str, quest_flags: dict) -> tuple[str, ...]:
    location = LOCATIONS.get(current_location)
    if location is None:
        return ()
    return tuple(route for route in location.connections if travel_allowed(route, quest_flags))


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
