from collections.abc import AsyncIterator

from ..display_localization import display_location
from ..narration_language import normalize_narration_language
from .base import NarrationContext, NarrationRequest
from .offline_prose import (
    breath_pause_prose,
    combat_opening_prose,
    combat_prose_from_events,
    empty_search_prose,
    rest_recovery_prose,
    shrine_bell_return_prose,
)
from .offline_variety import generic_scene_prose, variety_seed


class OfflineProvider:
    async def complete(self, request: NarrationRequest) -> str:
        return narrate_offline(request.context)

    async def stream(self, request: NarrationRequest) -> AsyncIterator[str]:
        yield narrate_offline(request.context)


def narrate_offline(context: NarrationContext) -> str:
    """Turn resolved engine facts into varied prose without changing them."""
    language = normalize_narration_language(context.language)
    if context.defeat_facts or any(event.startswith("Defeated in combat.") for event in context.events):
        raw_location = (context.defeat_facts or {}).get("respawn_location", "The Whispering Cellar")
        if language == "cs":
            location = display_location(str(raw_location), "cs")
            return (
                f"Tma tě pohltí. Probudíš se v {location} s jedním životem — boj skončil dřív, než přišel konec."
            )
        location = raw_location
        return (
            f"Darkness swallows you. You wake in {location} with a single breath left — "
            "the fight ended before you could fall for good."
        )
    if language == "cs":
        from .offline_cs import narrate_offline_cs

        return narrate_offline_cs(context)
    facts = " ".join(context.events).lower()
    action = context.action.strip().rstrip(".!?")
    seed = variety_seed(context)

    def choose(options: tuple[str, ...]) -> str:
        return options[seed % len(options)]

    if context.spell_facts:
        spell_name = context.spell_facts.get("spell_name", "The spell")
        effect = context.spell_facts.get("effect", {})
        if effect.get("type") == "not_modeled":
            return f"{spell_name} resolves, but its effect is not modeled yet; no spell slot is spent."
        if effect.get("type") == "heal":
            return choose((
                f"{spell_name} washes over you; warmth seeps into aching flesh.",
                f"The weave of {spell_name} knits skin and breath back together.",
                f"{spell_name} blooms in your hands and mends what the fight tore open.",
            ))
        if effect.get("type") in {"spell_attack", "auto_damage", "save_damage"}:
            return choose((
                f"{spell_name} leaps from your grasp and slams into your foe.",
                f"You shape {spell_name}; power crackles and strikes home.",
                f"{spell_name} erupts — the air shivers as it hits.",
            ))
        if effect.get("type") == "unavailable":
            return next(
                (event for event in context.events if "no spell slot was spent" in event.lower()),
                f"{spell_name} cannot be cast in the current situation; no spell slot is spent.",
            )
    if "spell effects are not implemented" in facts:
        return "The words of power have no force here yet; you lose no spell mana."
    if "agree to recover the stolen shrine bell" in facts:
        return "You accept Caldus's request, and the trail now leads toward Nib's market stall."
    if "hands you the shrine bell" in facts:
        return "Nib admits the theft and places the recovered shrine bell in your hands."
    if "return the shrine bell to caldus" in facts:
        return shrine_bell_return_prose(context, language="en")
    if "an enemy appears:" in facts:
        enemy = next(
            (event.split("An enemy appears:", 1)[1].split("(", 1)[0].strip()
             for event in context.events if "An enemy appears:" in event),
            "A foe",
        )
        return choose((
            f"The silence breaks: {enemy} steps into your path. It has not struck yet. What do you do?",
            f"A sudden movement reveals {enemy}. The creature waits, giving you the first move.",
            f"Your search uncovers danger—{enemy} blocks the way, but has not attacked.",
        ))
    if "gold pieces tucked beneath loose stones" in facts:
        amount = next(
            (event.split("find ", 1)[1].split(" gold", 1)[0]
             for event in context.events if "gold pieces tucked beneath loose stones" in event),
            "some",
        )
        return choose((
            f"Something glints between the stones. You pocket {amount} gold pieces.",
            f"Your search pays off: {amount} gold pieces were hidden under the loose stone.",
            f"You uncover a small cache of {amount} gold pieces in the cellar floor.",
        ))
    if "fresh tracks leading deeper" in facts:
        return choose((
            "Fresh tracks cross the dust and disappear deeper into the cellar.",
            "Someone passed this way recently. Their tracks lead farther underground.",
            "The dust tells a story: fresh footprints continue into the darkness ahead.",
        ))
    if "scratches around a stone panel" in facts:
        return choose((
            "A scratched stone panel catches your eye; someone has used it recently.",
            "You find marks around a stone panel, evidence that it may conceal a passage.",
            "Scratches mar the stonework. Whatever lies behind that panel has not stayed untouched.",
        ))
    if "no immediate threat" in facts or "find no immediate threat" in facts:
        return empty_search_prose(context, language="en")
    if "catch your breath" in facts:
        return breath_pause_prose(context, language="en")
    opening = combat_opening_prose(context, language="en")
    if opening:
        return opening
    combat = combat_prose_from_events(context, language="en")
    if combat:
        return combat
    if "you rest and recover" in facts:
        return rest_recovery_prose(context, language="en")
    if "break away and escape" in facts:
        return "You find an opening and escape the fight before the enemy can stop you."
    if "fail to break away" in facts:
        return "The enemy holds its ground, and you cannot get clear."
    if "check:" in facts:
        succeeded = any("— success" in event.lower() for event in context.events)
        if succeeded:
            return choose((
                f"Your attempt to {action.lower()} goes well; you make progress.",
                f"Careful and quick, you {action.lower()} without mishap.",
                f"You manage to {action.lower()}, and the moment goes your way.",
                f"Your effort pays off: {action.lower()} succeeds.",
            ))
        return choose((
            f"You try to {action.lower()}, but the moment slips away from you.",
            f"Your attempt to {action.lower()} does not go as planned.",
            f"You make the effort to {action.lower()}, but gain no advantage.",
        ))
    return generic_scene_prose(context, language="en")
