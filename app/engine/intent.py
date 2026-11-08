"""Validated player intent — engine authority, not the LLM."""

from dataclasses import dataclass, field
import re

ATTACK = "attack"
CAST = "cast_spell"
REST = "rest"
EXPLORE = "explore"
TRAVEL = "travel"
TALK = "talk"
FLEE = "flee"
DEFEND = "defend"
CHECK = "ability_check"
UNKNOWN = "unknown"

CAST_PATTERN = re.compile(r"\b(cast|kouzl)\b", re.IGNORECASE)
ATTACK_PATTERN = re.compile(r"\b(attack|strike|hit|útok|zaútoč)\b", re.IGNORECASE)
REST_PATTERN = re.compile(r"\b(rest|sleep|odpočí|odpocin)\b", re.IGNORECASE)
FLEE_PATTERN = re.compile(r"\b(flee|retreat|run away|utek|útěk)\b", re.IGNORECASE)
EXPLORE_PATTERN = re.compile(
    r"\b(look around|explore|search|investigate|prozkoumej|prohledej|rozhléd)\b",
    re.IGNORECASE,
)
TRAVEL_PATTERN = re.compile(
    r"\b(?:travel|go|head|move|cestuj|jdi|vydej se)\s+(?:to|do|k)\s+",
    re.IGNORECASE,
)
TALK_PATTERN = re.compile(r"\b(talk|speak|ask|mluv|zeptej)\b", re.IGNORECASE)
DEFEND_PATTERN = re.compile(r"\b(dodge|defend|brace|on guard|guard up|uhni|bran)\b", re.IGNORECASE)


@dataclass(frozen=True)
class ActionIntent:
    kind: str
    raw_text: str
    confidence: float = 1.0
    needs_clarification: bool = False
    skill_hint: str = ""
    target_hint: str = ""


def _negated(text: str, window: str) -> bool:
    return bool(re.search(rf"\b(no|not|never|don't|dont|ne)\b.{{0,24}}{re.escape(window)}", text, re.IGNORECASE))


def parse_action_intent(action: str) -> ActionIntent:
    text = action.strip()
    folded = re.sub(r"\s+", " ", text.casefold())
    if not text:
        return ActionIntent(UNKNOWN, text, confidence=0.0, needs_clarification=True)

    checks: list[tuple[str, re.Pattern[str], float]] = [
        (CAST, CAST_PATTERN, 0.9),
        (ATTACK, ATTACK_PATTERN, 0.85),
        (FLEE, FLEE_PATTERN, 0.85),
        (REST, REST_PATTERN, 0.8),
        (DEFEND, DEFEND_PATTERN, 0.8),
        (TRAVEL, TRAVEL_PATTERN, 0.85),
        (EXPLORE, EXPLORE_PATTERN, 0.75),
        (TALK, TALK_PATTERN, 0.7),
    ]
    for kind, pattern, confidence in checks:
        if pattern.search(text):
            if kind == ATTACK and _negated(folded, "attack"):
                return ActionIntent(CHECK, text, confidence=0.4, needs_clarification=True)
            return ActionIntent(kind, text, confidence=confidence)
    return ActionIntent(CHECK, text, confidence=0.5)
