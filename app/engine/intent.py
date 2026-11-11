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
REJECTED = "rejected"
SHOP = "shop"
USE_ITEM = "use_item"
EQUIP = "equip"
QUEST = "quest"
CLASS_FEATURE = "class_feature"

SECOND_WIND_PATTERN = re.compile(r"\b(?:second wind|druh[yý]\s+dech)\b", re.IGNORECASE)
ARCANE_RECOVERY_PATTERN = re.compile(r"\b(?:arcane recovery|arcan\w*\s+obnov)\b", re.IGNORECASE)
HIDE_COMBAT_PATTERN = re.compile(r"\b(?:hide|schovej|ukry)\b", re.IGNORECASE)

CAST_PATTERN = re.compile(r"\b(cast|kouzl)\b", re.IGNORECASE)
ATTACK_PATTERN = re.compile(r"\b(attack|strike|hit|útok|zaútoč|zaútočit)\b", re.IGNORECASE)
REST_PATTERN = re.compile(
    r"\b(?:short\s+rest|brief\s+rest|take\s+a\s+breather|rest|sleep|odpočí|odpocin|kratky\s+odpocinek|kratky\s+oddech)\b",
    re.IGNORECASE,
)
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
    r"\b(?:travel(?:ing)?|go(?:ing)?|head(?:ing)?|move|cestuj|jdi|vydej se)\s+(?:to|do|k)\s+",
    re.IGNORECASE,
)
TALK_PATTERN = re.compile(r"\b(talk|speak|ask|mluv|mluvit|zeptej|promluv)\b", re.IGNORECASE)
DEFEND_PATTERN = re.compile(r"\b(dodge|defend|brace|on guard|guard up|uhni|bran)\b", re.IGNORECASE)
SHOP_PATTERN = re.compile(r"\b(buy|purchase|kup|nakup|koupit|koup)\w*\b", re.IGNORECASE)
USE_ITEM_PATTERN = re.compile(
    r"\b(?:use|drink|pouzij|vypij)\w*\s+(?:a\s+)?(?:healing\s+)?(?:potion|item|lektvar)\b",
    re.IGNORECASE,
)
EQUIP_PATTERN = re.compile(
    r"\b(?:equip|wield|draw|ready|vybav\w*|vzít do ruky)\s+(?:the\s+|a\s+|my\s+)?(.+)",
    re.IGNORECASE,
)
UNEQUIP_PATTERN = re.compile(
    r"\b(?:unequip|remove|take off|sundat|sejmout|odlož|odloz)\s+(?:the\s+|a\s+|my\s+)?(.+)",
    re.IGNORECASE,
)
QUEST_RETURN_PATTERN = re.compile(
    r"\b(?:return|give|deliver|vrat\w*|vrát\w*|odevz\w*|pred\w*|před\w*)\b.{0,48}\b(?:shrine\s+bell|bell|zvon)\b",
    re.IGNORECASE,
)
_QUEST_ADDRESS_VERB = (
    r"(?:talk|speak|ask|accept|help|mluv\w*|zeptej|promluv)"
)
QUEST_CALDUS_PATTERN = re.compile(
    rf"\b{_QUEST_ADDRESS_VERB}\s+(?:to\s+|with\s+|s\s+)?caldus\b"
    rf".+?\b(?:about\s+)?(?:the\s+)?(?:shrine\s+bell|stolen\s+bell|zvon)\b",
    re.IGNORECASE,
)
QUEST_NIB_PATTERN = re.compile(
    rf"\b{_QUEST_ADDRESS_VERB}\s+(?:to\s+|with\s+)?nib\b"
    rf".+?\b(?:about\s+)?(?:the\s+)?(?:shrine\s+bell|bell|zvon)\b",
    re.IGNORECASE,
)
QUEST_CALDUS_VAULT_PATTERN = re.compile(
    rf"\b{_QUEST_ADDRESS_VERB}\s+(?:to\s+|with\s+|s\s+)?caldus\b"
    rf".+\b(?:vault of echoes|vault|treasury|temple crypt)\b",
    re.IGNORECASE,
)

_KIND_ORDER = (
    QUEST,
    SHOP,
    USE_ITEM,
    EQUIP,
    CAST,
    FLEE,
    DEFEND,
    CLASS_FEATURE,
    REST,
    TRAVEL,
    EXPLORE,
    TALK,
    ATTACK,
)

_PATTERNS: dict[str, re.Pattern[str]] = {
    CAST: CAST_PATTERN,
    ATTACK: ATTACK_PATTERN,
    FLEE: FLEE_PATTERN,
    REST: REST_PATTERN,
    DEFEND: DEFEND_PATTERN,
    TRAVEL: TRAVEL_PATTERN,
    EXPLORE: EXPLORE_PATTERN,
    TALK: TALK_PATTERN,
    SHOP: SHOP_PATTERN,
    USE_ITEM: USE_ITEM_PATTERN,
    EQUIP: EQUIP_PATTERN,
}

_NEGATION_BY_KIND: dict[str, tuple[str, ...]] = {
    ATTACK: ("attack", "strike", "hit", "útok", "zaútoč", "zaútočit"),
    CAST: ("cast", "kouzl"),
    FLEE: ("flee", "retreat", "utek", "útěk"),
    REST: (
        "rest",
        "sleep",
        "odpočí",
        "odpocin",
        "odpočin",
        "breather",
        "brief rest",
        "short rest",
        "kratky odpocinek",
        "kratky oddech",
    ),
    DEFEND: ("dodge", "defend", "brace", "uhni", "bran"),
    TRAVEL: ("travel", "cestuj", "jdi", "vydej"),
    TALK: ("talk", "speak", "ask", "mluv", "mluvit", "zeptej", "promluv"),
    SHOP: ("buy", "purchase", "kup", "nakup", "koupit", "koup"),
    USE_ITEM: ("use", "drink", "pouzij", "vypij", "potion", "lektvar"),
    EQUIP: ("equip", "wield", "draw", "vybav", "vzít", "unequip", "remove", "sundat", "sejmout"),
    EXPLORE: ("explore", "search", "investigate", "prozkoumej", "prohledej"),
}

_QUEST_NEGATION: dict[str, tuple[str, ...]] = {
    "return_bell": ("return", "give", "deliver", "vratit", "vrátit", "vrat", "vrát", "odevzdat", "predat", "předat", "zvon", "bell"),
    "accept_caldus": ("talk", "speak", "ask", "mluv", "mluvit", "zeptej", "accept", "caldus"),
    "ask_nib": ("ask", "talk", "speak", "mluv", "zeptej", "nib"),
}


@dataclass(frozen=True)
class ActionIntent:
    kind: str
    raw_text: str
    confidence: float = 1.0
    needs_clarification: bool = False
    skill_hint: str = ""
    target_hint: str = ""
    quest_step: str = ""
    class_feature: str = ""


def _clause_negates(clause: str, escaped_term: str) -> bool:
    if re.search(rf"\b(?:no|not|never|don't|dont)\b.{{0,32}}{escaped_term}\b", clause):
        return True
    if re.search(rf"\b(?:nechci|nechce|nebud|nesmi|nemam|nemůžu|nemuzu)\b.{{0,32}}{escaped_term}\b", clause):
        return True
    if re.search(rf"\bne\s+\w+(?:\s+\w+){{0,4}}\s+{escaped_term}\b", clause):
        return True
    if re.search(rf"{escaped_term}\b.{{0,16}}\b(?:ne|not)\b", clause):
        return True
    return False


def _negated(folded: str, terms: tuple[str, ...]) -> bool:
    clauses = re.split(r"[,;]", folded)
    for term in terms:
        escaped = re.escape(term)
        for clause in clauses:
            if not re.search(rf"{escaped}", clause):
                continue
            if _clause_negates(clause, escaped):
                return True
    return False


def _detect_quest_step(text: str, folded: str) -> tuple[str | None, bool]:
    """Return (quest_step, was_negated)."""
    if QUEST_RETURN_PATTERN.search(text):
        if _negated(folded, _QUEST_NEGATION["return_bell"]):
            return None, True
        return "return_bell", False
    if QUEST_CALDUS_VAULT_PATTERN.search(text):
        if _negated(folded, _QUEST_NEGATION["accept_caldus"]):
            return None, True
        return "accept_caldus", False
    if QUEST_NIB_PATTERN.search(text):
        if _negated(folded, _QUEST_NEGATION["ask_nib"]):
            return None, True
        return "ask_nib", False
    if QUEST_CALDUS_PATTERN.search(text):
        if _negated(folded, _QUEST_NEGATION["accept_caldus"]):
            return None, True
        return "accept_caldus", False
    return None, False


def _matched_kinds(text: str) -> set[str]:
    found: set[str] = set()
    for kind, pattern in _PATTERNS.items():
        if pattern.search(text):
            found.add(kind)
    if UNEQUIP_PATTERN.search(text):
        found.add(EQUIP)
    if TRAVEL_EXPLORE_PATTERN.search(text):
        found.add(EXPLORE)
    if SECOND_WIND_PATTERN.search(text) or ARCANE_RECOVERY_PATTERN.search(text) or HIDE_COMBAT_PATTERN.search(text):
        found.add(CLASS_FEATURE)
    return found


def _apply_negation(kinds: set[str], folded: str) -> set[str]:
    filtered = set(kinds)
    for kind in list(filtered):
        terms = _NEGATION_BY_KIND.get(kind)
        if terms and _negated(folded, terms):
            filtered.discard(kind)
    return filtered


def parse_action_intent(action: str) -> ActionIntent:
    text = action.strip()
    folded = re.sub(r"\s+", " ", text.casefold())
    if not text:
        return ActionIntent(UNKNOWN, text, confidence=0.0, needs_clarification=True)

    raw_kinds = _matched_kinds(text)
    quest_step, quest_negated = _detect_quest_step(text, folded)
    if quest_step:
        raw_kinds.add(QUEST)

    kinds = _apply_negation(raw_kinds, folded)
    if quest_step:
        kinds.add(QUEST)

    if quest_negated and not kinds:
        return ActionIntent(REJECTED, text, confidence=0.9, needs_clarification=True)

    if raw_kinds - kinds and not kinds:
        return ActionIntent(REJECTED, text, confidence=0.85, needs_clarification=True)

    if ATTACK in kinds and TALK in kinds:
        return ActionIntent(AMBIGUOUS, text, confidence=0.45, needs_clarification=True)
    if CAST in kinds and TALK in kinds:
        return ActionIntent(AMBIGUOUS, text, confidence=0.45, needs_clarification=True)

    conflict_pairs = (
        {ATTACK, CAST},
        {ATTACK, FLEE},
        {CAST, FLEE},
        {ATTACK, DEFEND},
        {REST, ATTACK},
        {TRAVEL, CAST},
        {REST, CAST},
        {SHOP, USE_ITEM},
    )
    if len(kinds) >= 2 and any(pair <= kinds for pair in conflict_pairs):
        return ActionIntent(AMBIGUOUS, text, confidence=0.4, needs_clarification=True)

    for kind in _KIND_ORDER:
        if kind in kinds:
            confidence = 0.9 if kind in (CAST, ATTACK, TRAVEL, QUEST) else 0.8
            step = quest_step if kind == QUEST else ""
            feature = ""
            if kind == CLASS_FEATURE:
                if SECOND_WIND_PATTERN.search(text):
                    feature = "second_wind"
                elif ARCANE_RECOVERY_PATTERN.search(text):
                    feature = "arcane_recovery"
                else:
                    feature = "hide"
            return ActionIntent(kind, text, confidence=confidence, quest_step=step, class_feature=feature)

    if quest_negated:
        return ActionIntent(REJECTED, text, confidence=0.85, needs_clarification=True)

    return ActionIntent(CHECK, text, confidence=0.5)
