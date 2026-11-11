"""Parse combat movement commands (Sprint 27.1) — advance / step back with explicit feet."""

from __future__ import annotations

import re

_ADVANCE = re.compile(
    r"\b(?:advance|move\s+closer|p(?:ř|ri)bl(?:i|í)ž(?:\s+se)?|pribliz(?:\s+se)?)"
    r"(?:\s+(\d+)\s*(?:ft|feet|stop(?:y|a)?))?\b",
    re.IGNORECASE,
)
_STEP_BACK = re.compile(
    r"\b(?:step\s+back|move\s+back|ustup(?:\s+zpět)?|ustup(?:\s+zpet)?)"
    r"(?:\s+(\d+)\s*(?:ft|feet|stop(?:y|a)?))?\b",
    re.IGNORECASE,
)
_NUMERIC_RETREAT = re.compile(
    r"\bretreat\s+(\d+)\s*(?:ft|feet|stop(?:y|a)?)\b",
    re.IGNORECASE,
)

DEFAULT_MOVE_FT = 15


def is_combat_move_command(text: str) -> bool:
    return combat_move_delta_ft(text) is not None


def combat_move_delta_ft(text: str) -> int | None:
    """Return delta for apply_player_movement: negative = advance, positive = retreat."""
    if not text.strip():
        return None
    adv = _ADVANCE.search(text)
    if adv:
        raw = adv.group(1)
        feet = int(raw) if raw else DEFAULT_MOVE_FT
        if feet <= 0:
            return 0  # caller treats 0 as invalid
        return -feet
    back = _STEP_BACK.search(text) or _NUMERIC_RETREAT.search(text)
    if back:
        raw = back.group(1)
        feet = int(raw) if raw else DEFAULT_MOVE_FT
        if feet <= 0:
            return 0
        return feet
    return None
