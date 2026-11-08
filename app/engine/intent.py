"""Validated player intent — engine authority, not the LLM."""

from dataclasses import dataclass
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
AMBIGUOUS = "ambiguous"
UNKNOWN = "unknown"

CAST_PATTERN = re.compile(r"\b(cast|kouzl)\b", re.IGNORECASE)
ATTACK_PATTERN = re.compile(r"\b(attack|strike|hit|útok|zaútoč|zaútočit)\b", re.IGNORECASE)
REST_PATTERN = re.compile(r"\b(rest|sleep|odpočí|odpocin)\b", re.IGNORECASE)
FLEE_PATTERN = re.compile(r"\b(flee|retreat|run away|utek|útěk)\b", re.IGNORECASE)
EXPLORE_PATTERN = re.compile(
    r"\b(look around|explore|search|investigate|prozkoumej|prohledej|rozhléd)\b",
    re.IGNORECASE,
)
TRAVEL_EXPLORE_PATTERN = re.compile(
    r"\btravel\b(?!\s+(?:to|do|k)\s)",
    re.IGNORECASE,
)
TRAVEL_PATTERN = re.compile(
    r"\b(?:travel|go|head|move|cestuj|jdi|vydej se)\s+(?:to|do|k)\s+",
    re.IGNORECASE,
)
TALK_PATTERN = re.compile(r"\b(talk|speak|ask|mluv|mluvit|zeptej|promluv)\b", re.IGNORECASE)
DEFEND_PATTERN = re.compile(r"\b(dodge|defend|brace|on guard|guard up|uhni|bran)\b", re.IGNORECASE)

_KIND_ORDER = (CAST, FLEE, DEFEND, REST, TRAVEL, EXPLORE, TALK, ATTACK)

_PATTERNS: dict[str, re.Pattern[str]] = {
    CAST: CAST_PATTERN,
    ATTACK: ATTACK_PATTERN,
    FLEE: FLEE_PATTERN,
    REST: REST_PATTERN,
    DEFEND: DEFEND_PATTERN,
    TRAVEL: TRAVEL_PATTERN,
    EXPLORE: EXPLORE_PATTERN,
    TALK: TALK_PATTERN,
}

_NEGATABLE = {ATTACK, CAST, FLEE}


@dataclass(frozen=True)
class ActionIntent:
    kind: str
    raw_text: str
    confidence: float = 1.0
    needs_clarification: bool = False
    skill_hint: str = ""
    target_hint: str = ""


def _attack_terms() -> tuple[str, ...]:
    return ("attack", "strike", "hit", "útok", "zaútoč", "zaútočit")


def _negated(folded: str, terms: tuple[str, ...]) -> bool:
    for term in terms:
        escaped = re.escape(term)
        if re.search(rf"\b(?:no|not|never|don't|dont)\b.{{0,32}}{escaped}\b", folded):
            return True
        if re.search(rf"\b(?:ne|nechci|nechce|nebud)\w*\b.{{0,24}}{escaped}\b", folded):
            return True
        if re.search(rf"{escaped}\b.{{0,16}}\b(?:ne|not)\b", folded):
            return True
    return False


def _matched_kinds(text: str) -> set[str]:
    found: set[str] = set()
    for kind, pattern in _PATTERNS.items():
        if pattern.search(text):
            found.add(kind)
    if TRAVEL_EXPLORE_PATTERN.search(text):
        found.add(EXPLORE)
    return found


def parse_action_intent(action: str) -> ActionIntent:
    text = action.strip()
    folded = re.sub(r"\s+", " ", text.casefold())
    if not text:
        return ActionIntent(UNKNOWN, text, confidence=0.0, needs_clarification=True)

    kinds = _matched_kinds(text)
    if ATTACK in kinds and _negated(folded, _attack_terms()):
        kinds.discard(ATTACK)
    if CAST in kinds and _negated(folded, ("cast", "kouzl")):
        kinds.discard(CAST)
    if FLEE in kinds and _negated(folded, ("flee", "retreat", "utek", "útěk")):
        kinds.discard(FLEE)

    if ATTACK in kinds and TALK in kinds:
        return ActionIntent(AMBIGUOUS, text, confidence=0.45, needs_clarification=True)
    if CAST in kinds and TALK in kinds:
        return ActionIntent(AMBIGUOUS, text, confidence=0.45, needs_clarification=True)

    conflict_pairs = (
        {ATTACK, CAST},
        {ATTACK, FLEE},
        {CAST, FLEE},
        {ATTACK, DEFEND},
    )
    if len(kinds) >= 2 and any(pair <= kinds for pair in conflict_pairs):
        return ActionIntent(AMBIGUOUS, text, confidence=0.4, needs_clarification=True)

    for kind in _KIND_ORDER:
        if kind in kinds:
            confidence = 0.9 if kind in (CAST, ATTACK, TRAVEL) else 0.8
            return ActionIntent(kind, text, confidence=confidence)

    return ActionIntent(CHECK, text, confidence=0.5)
