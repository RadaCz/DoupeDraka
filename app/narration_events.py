"""Map committed engine event lines to narrator/UI hints."""

from .engine.models import SAFE_RESPAWN_LOCATION

DEFEAT_EVENT_PREFIX = "Defeated in combat."


def defeat_facts_from_events(events: tuple[str, ...]) -> dict | None:
    if not any(event.startswith(DEFEAT_EVENT_PREFIX) for event in events):
        return None
    return {
        "kind": "combat_respawn",
        "respawn_location": SAFE_RESPAWN_LOCATION,
        "current_hp": 1,
    }
