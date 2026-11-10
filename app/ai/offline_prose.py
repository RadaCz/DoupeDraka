"""Shared immersive offline prose helpers (facts-only, no fourth-wall wording)."""

from __future__ import annotations

import re
from typing import Iterable

from ..display_localization import display_creature, display_location, embed_catalog_names
from .base import NarrationContext
from .offline_variety import choose, familiarity_lead, variety_seed

# Re-export for tests
__all__ = [
    "narration_contains_meta_terms",
    "bell_return_rewards_from_events",
    "shrine_bell_return_prose",
    "breath_pause_prose",
    "empty_search_prose",
    "rest_recovery_prose",
    "combat_prose_from_events",
    "combat_opening_prose",
]

# Player-facing narration must not read like internal tooling copy.
META_TERM_PATTERN = re.compile(
    r"\b(engine|journal|mechanics?|processing|action result|game rules?|"
    r"rolls and hp live|scene answers from|scene respond|moment forward|"
    r"moves the moment|your choice|body thanks you)\b",
    re.IGNORECASE,
)


def narration_contains_meta_terms(text: str) -> bool:
    return bool(META_TERM_PATTERN.search(text))


_BELL_RETURN_RE = re.compile(
    r"return the shrine bell to caldus and receive (\d+) gold pieces(?: and (\d+) xp)?",
    re.IGNORECASE,
)


def bell_return_rewards_from_events(context: NarrationContext) -> tuple[int | None, int | None]:
    """Parse gold/XP from the engine's return-bell fact line, if present."""
    for event in context.events:
        match = _BELL_RETURN_RE.search(event)
        if match:
            gold = int(match.group(1))
            xp = int(match.group(2)) if match.group(2) else None
            return gold, xp
    return None, None


def shrine_bell_return_prose(context: NarrationContext, *, language: str) -> str:
    """Caldus accepts the shrine bell; mention only rewards confirmed in engine facts."""
    seed = variety_seed(context)
    gold, xp = bell_return_rewards_from_events(context)
    if language == "cs":
        if gold is not None:
            reward = f"{gold} zlatých"
            if xp is not None:
                reward = f"{gold} zlatých a zkušenost za {xp} bodů"
            return choose(
                (
                    f"Caldus s úlevou přijímá chrámový zvon a vkládá ti do ruky {reward}.",
                    f"Strážce chrámu kývá; zvon znovu zazní a ty dostáváš slíbených {reward}.",
                    f"Caldusův pohled změkne, když vracíš zvon — na oplátku ti předá {reward}.",
                ),
                seed,
            )
        return choose(
            (
                "Caldus s úlevou přijímá chrámový zvon a poděkuje ti za návrat.",
                "Strážce chrámu kývá; zvon znovu zazní nad svatyní.",
                "Caldusův pohled změkne, když vracíš zvon do jeho rukou.",
            ),
            seed,
        )
    if gold is not None:
        pieces = "piece" if gold == 1 else "pieces"
        reward = f"{gold} gold {pieces}"
        if xp is not None:
            reward = f"{gold} gold {pieces} and the weight of {xp} experience"
        return choose(
            (
                f"Caldus cradles the shrine bell with relief and presses {reward} into your palm.",
                f"The shrine keeper accepts the bell with a solemn nod and thanks you with {reward}.",
                f"Caldus's eyes soften as the bell returns; he honors his word with {reward}.",
            ),
            seed,
        )
    return choose(
        (
            "Caldus cradles the shrine bell with relief and thanks you for bringing it home.",
            "The shrine keeper accepts the bell with a solemn nod and bows in gratitude.",
            "Caldus's eyes soften as the bell returns; the shrine feels whole again.",
        ),
        seed,
    )


_LOCATION_CS = {
    "The Whispering Cellar": "šeptajícím sklepu",
    "The Sunken Corridor": "potopené chodbě",
    "The Shrine of the Forgotten": "svatyni zapomenutých",
    "The Goblin Market": "gobliním trhu",
    "The Vault of Echoes": "komnatě ozvěn",
    "The Bell Warden's Pit": "jámě strážce zvonu",
    "The Forgotten Crypt": "zapomenuté kryptě",
    "The Underground River": "podzemní řece",
}


def _place_name(context: NarrationContext) -> str:
    dossier = context.scene_dossier or {}
    loc = dossier.get("location") or {}
    return (loc.get("name") or context.location or "the shadows").strip()


def _place_phrase_cs(context: NarrationContext) -> str:
    name = _place_name(context)
    return _LOCATION_CS.get(name, name)


def _atmosphere_line(context: NarrationContext, *, language: str) -> str:
    dossier = context.scene_dossier or {}
    loc = dossier.get("location") or {}
    atmosphere = (loc.get("atmosphere") or "").strip()
    if atmosphere:
        snippet = atmosphere.split(".", 1)[0].strip()
        if snippet:
            return snippet + ("." if not snippet.endswith(".") else "")
    place = _place_name(context)
    if language == "cs":
        phrase = _place_phrase_cs(context)
        return f"V {phrase} visí tíha vlhkého kamene a tichá ozvěna."
    return f"The air in {place} settles around you."


def breath_pause_prose(context: NarrationContext, *, language: str) -> str:
    """Cooldown / catch breath — sensory pause, not a single fixed sentence."""
    seed = variety_seed(context)
    lead = familiarity_lead(context, language=language)
    place = _place_name(context)
    place_cs = _place_phrase_cs(context)
    atm = _atmosphere_line(context, language=language)
    if language == "cs":
        return choose(
            (
                f"{lead}Zastavíš se na okamžik a necháš tep utichnout. V {place_cs} se nic nového neblíží.",
                f"{lead}Na chvíli vydechneš a dáváš pozor na zvuky kolem. {atm}",
                f"{lead}Odpočineš oko i dech — {atm} Žádné nebezpečí se zatím nehlásí.",
            ),
            seed,
        )
    return choose(
        (
            f"{lead}You pause to steady your breathing and listen. Nothing new stirs in {place}.",
            f"{lead}You take a short breath and scan the room. The moment stays still.",
            f"{lead}You slow your breathing. {atm} No fresh danger surfaces.",
        ),
        seed,
    )


def rest_recovery_prose(context: NarrationContext, *, language: str) -> str:
    """Rest / sleep beats — sensation and place, not command-echo."""
    seed = variety_seed(context)
    lead = familiarity_lead(context, language=language)
    place = _place_name(context)
    place_cs = _place_phrase_cs(context)
    atm = _atmosphere_line(context, language=language)
    if language == "cs":
        return choose(
            (
                f"{lead}Opřeš se o vlhkou zeď. Kamenný chlad ti proniká přes zbroj, ale vzdálené kapání vody a ticho ti konečně dovolí na chvíli zavřít oči a nabrat síly.",
                f"{lead}Kamenná podlaha je chladná, ale únava tě přemůže. {atm} Když otevřeš oči, ticho v {place_cs} je stejně tíživé jako dřív.",
                f"{lead}Sedneš si a necháš ramena klesnout. Dech se srovná, zatímco {place_cs} dřímá kolem tebe.",
            ),
            seed,
        )
    return choose(
        (
            f"{lead}The stone floor is cold, but weariness wins. {atm} When you open your eyes again, {place} feels unchanged.",
            f"{lead}You sit back and let your shoulders drop. Breath steadies while {place} dozes around you.",
            f"{lead}You close your eyes briefly; the air in {place} smells of dust and damp. Strength creeps back.",
        ),
        seed,
    )


def empty_search_prose(context: NarrationContext, *, language: str) -> str:
    seed = variety_seed(context)
    lead = familiarity_lead(context, language=language)
    atm = _atmosphere_line(context, language=language)
    place = _place_phrase_cs(context)
    if language == "cs":
        return choose(
            (
                f"{lead}Odhrneš vrstvu shnilé slámy. Pod ní jsou jen vlhké třísky a černá plíseň. V {place} se nic nepohnulo — ale pach mokré hlíny je stále silnější.",
                f"{lead}Prohledáváš okolí pečlivě, ale narazíš jen na prach a ticho.",
                f"{lead}Zrak ti nic cenného neukáže — jen obvyklé stopy po minulých návštěvách.",
                f"{lead}Hledání nic nového nepřináší. {atm}",
            ),
            seed,
        )
    return choose(
        (
            f"{lead}You search carefully, but find only dust, stone, and quiet.",
            f"{lead}Your search turns up nothing new — only the familiar stillness.",
            f"{lead}Nothing of value reveals itself. {atm}",
        ),
        seed,
    )


def _enemy_from_appears(events: Iterable[str]) -> str | None:
    for event in events:
        low = event.lower()
        if "an enemy appears:" not in low:
            continue
        rest = event.split(":", 1)[-1].strip()
        name = rest.split("(", 1)[0].strip()
        if name:
            return name
    return None


def combat_opening_prose(context: NarrationContext, *, language: str) -> str | None:
    """First beat when combat starts (enemy spawn / initiative) before any attack roll."""
    joined = " ".join(context.events).lower()
    if "attack roll" in joined:
        return None
    if not any("an enemy appears:" in event.lower() for event in context.events):
        if "initiative:" not in joined:
            return None
    seed = variety_seed(context)
    lead = familiarity_lead(context, language=language)
    raw_foe = _enemy_from_appears(context.events) or _enemy_label(context, context.events)
    raw_place = (context.location or _place_name(context)).strip()
    foe = display_creature(raw_foe, language) if language == "cs" else raw_foe
    place = display_location(raw_place, language) if language == "cs" else raw_place
    foe_low = raw_foe.lower()

    if language == "cs":
        if "goblin" in foe_low:
            where = f"V {place} " if place else ""
            return choose(
                (
                    f"{lead}{where}se z temnoty vynoří {foe}. Vychrtlé prsty svírají zbraň "
                    f"a jeho pohled tě měří — jakmile tě zaznamená, napřímí se do bojového postoje.",
                    f"{lead}{foe.capitalize()} vykoukne ze stínu a okamžitě se připraví k útoku.",
                ),
                seed,
            )
        if place:
            return choose(
                (
                    f"{lead}V prostoru {place} se před tebou rýsuje {foe}. "
                    "Střetnutí přeruší chladné ticho — protivník čeká tvůj první tah.",
                    f"{lead}{foe.capitalize()} se objeví v {place} a napřímí se proti tobě.",
                ),
                seed,
            )
        return choose(
            (
                f"{lead}Před tebou se vynoří {foe} a ustoupí do bojového postoje.",
                f"{lead}{foe.capitalize()} se rýsuje proti tobě — boj právě začíná.",
            ),
            seed,
        )

    if "goblin" in foe_low:
        where = f"In {place}, " if place else ""
        return choose(
            (
                f"{lead}{where}{foe} slips from the shadows with a wary grip on a blade. "
                "The moment you are spotted, the creature squares up to fight.",
                f"{lead}{foe} emerges with rust-stained steel and drops into a fighting stance.",
            ),
            seed,
        )
    if place:
        return choose(
            (
                f"{lead}In {place}, {foe} steps into view. The stillness breaks as your foe squares up.",
                f"{lead}{foe} appears in {place} and braces for your first move.",
            ),
            seed,
        )
    return choose(
        (
            f"{lead}{foe} emerges to face you. As you meet its gaze, the fight is ready to begin.",
            f"{lead}Steel is drawn as {foe} squares up against you.",
        ),
        seed,
    )


def _enemy_label(context: NarrationContext, events: Iterable[str]) -> str:
    dossier = context.scene_dossier or {}
    combat = dossier.get("combat") or {}
    if combat.get("enemy_name"):
        return str(combat["enemy_name"])
    for event in events:
        low = event.lower()
        if "damage" in low and " has " in low:
            # "Damage 7 — the goblin has 3 HP left."
            part = event.split("—", 1)[-1].strip().lower()
            if " has " in part:
                return part.split(" has ", 1)[0].replace("the ", "").strip() or "your foe"
        if "hits you for" in low:
            return event.split(" hits you", 1)[0].strip() or "your foe"
    return "your foe" if context.language != "cs" else "nepřítel"


def combat_prose_from_events(context: NarrationContext, *, language: str) -> str | None:
    """Natural-language combat beat when attack-roll facts are present."""
    joined = " ".join(context.events)
    facts = joined.lower()
    if "attack roll" not in facts:
        return None
    seed = variety_seed(context)
    lead = familiarity_lead(context, language=language)
    raw_foe = _enemy_label(context, context.events)
    foe = display_creature(raw_foe, language) if language == "cs" else raw_foe
    action = context.action.strip().rstrip(".!?")

    if "critical miss" in facts:
        if language == "cs":
            return choose(
                (
                    f"{lead}Zamíříš a udeříš, ale {foe} uskočí v poslední chvíli — čepel seká jen vzduch.",
                    f"{lead}Tvůj výpad je nešikovný; {foe} zůstává bez zranění.",
                ),
                seed,
            )
        return choose(
            (
                f"{lead}Your strike goes wildly wide — {foe} slips clear and stays unharmed.",
                f"{lead}The blow fails badly; {foe} dances aside untouched.",
            ),
            seed,
        )

    if "— hit" in facts or "— critical hit" in facts or ("damage" in facts and "hit" in facts):
        defeated = "is defeated" in facts or "defeated" in facts
        if language == "cs":
            if defeated:
                return choose(
                    (
                        f"{lead}Vykročíš a {action.lower()} — čepel zasáhne {foe} a hrozba padá k zemi.",
                        f"{lead}Tvůj úder najde cíl; {foe} se zhroutí a boj končí.",
                    ),
                    seed,
                )
            return choose(
                (
                    f"{lead}Prudce {action.lower()} a ocel zasáhne {foe}. Stvůra zakolísá, ale ještě stojí.",
                    f"{lead}Úder sedí — {foe} ustoupí bolestivě, jenže boj pokračuje.",
                ),
                seed,
            )
        if defeated:
            return choose(
                (
                    f"{lead}You press forward and land your blow; {foe} falls at last.",
                    f"{lead}Steel finds its mark and {foe} can fight no longer.",
                ),
                seed,
            )
        return choose(
            (
                f"{lead}You lash out — your strike hits {foe}, who staggers but keeps fighting.",
                f"{lead}Your attack connects; {foe} reels, yet the clash continues.",
            ),
            seed,
        )

    if "— miss" in facts or "miss." in facts:
        if language == "cs":
            return choose(
                (
                    f"{lead}{foe.capitalize()} se vykroutí a tvůj výpad minuje.",
                    f"{lead}Čepel prosviští kolem {foe}; soupeř stále blokuje cestu.",
                ),
                seed,
            )
        return choose(
            (
                f"{lead}{foe.capitalize()} ducks aside; your attack cuts empty air.",
                f"{lead}Your blow misses, and {foe} still stands between you and safety.",
            ),
            seed,
        )

    if "hits you for" in facts:
        if language == "cs":
            return choose(
                (
                    f"{lead}Tvůj útok nezadrží protivníka — {foe} se otočí a zasáhne tebe.",
                    f"{lead}Útočíš, ale {foe} se prosměkne a oplatí ránu.",
                ),
                seed,
            )
        return choose(
            (
                f"{lead}Your strike fails to stop {foe}, who hits back hard.",
                f"{lead}You press the attack, but {foe} slips through and strikes you.",
            ),
            seed,
        )

    return None
