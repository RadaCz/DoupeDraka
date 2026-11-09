"""Infer narration scene type from player action and resolved engine facts."""

from __future__ import annotations

import re

_TRAVEL = re.compile(
    r"\b(travel|go|head|move|cestuj|jdi|vydej se)\b",
    re.IGNORECASE,
)
_TALK = re.compile(
    r"\b(talk|speak|ask|tell|greet|persuade|mluv|mluvit|zeptej|promluv|rikaj)\b",
    re.IGNORECASE,
)
_REST = re.compile(r"\b(rest|sleep|odpocin|odpocinej|spat)\b", re.IGNORECASE)


def infer_scene_kind(
    action: str,
    events: tuple[str, ...],
    *,
    in_combat: bool,
) -> str:
    joined = " ".join(events).casefold()
    if in_combat or "attack roll" in joined or "defeated in combat" in joined:
        return "combat"
    if any("level" in event.casefold() and "up" in event.casefold() for event in events):
        return "story_moment"
    if any("quest" in event.casefold() or "bell" in event.casefold() for event in events):
        if _TALK.search(action):
            return "talk"
        return "story_moment"
    if _REST.search(action) or "rest" in joined or "catch your breath" in joined:
        return "rest"
    if _TRAVEL.search(action) or "you arrive" in joined or "you travel" in joined:
        return "travel"
    if _TALK.search(action):
        return "talk"
    if "exploration roll" in joined or "look around" in action.casefold():
        return "explore"
    return "general"
