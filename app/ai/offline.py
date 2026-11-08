from collections.abc import AsyncIterator

from ..narration_language import normalize_narration_language
from .base import NarrationContext, NarrationRequest


class OfflineProvider:
    async def complete(self, request: NarrationRequest) -> str:
        return narrate_offline(request.context)

    async def stream(self, request: NarrationRequest) -> AsyncIterator[str]:
        yield narrate_offline(request.context)


def narrate_offline(context: NarrationContext) -> str:
    """Turn resolved engine facts into varied prose without changing them."""
    if context.defeat_facts or any(event.startswith("Defeated in combat.") for event in context.events):
        location = (context.defeat_facts or {}).get("respawn_location", "The Whispering Cellar")
        if normalize_narration_language(context.language) == "cs":
            return (
                f"Tma tě pohltí. Probudíš se v {location} s jedním životem — boj skončil dřív, než přišel konec."
            )
        return (
            f"Darkness swallows you. You wake in {location} with a single breath left — "
            "the fight ended before you could fall for good."
        )
    if normalize_narration_language(context.language) == "cs":
        from .offline_cs import narrate_offline_cs
        return narrate_offline_cs(context)
    facts = " ".join(context.events).lower()
    action = context.action.strip().rstrip(".!?")
    seed = sum(ord(char) for char in "|".join(context.events))

    def choose(options: tuple[str, ...]) -> str:
        return options[seed % len(options)]

    if context.spell_facts:
        spell_name = context.spell_facts.get("spell_name", "The spell")
        effect = context.spell_facts.get("effect", {})
        if effect.get("type") == "not_modeled":
            return f"{spell_name} resolves, but its effect is not modeled yet; no spell slot is spent."
        if effect.get("type") == "heal":
            return f"{spell_name} closes some of your wounds; the engine's healing result is recorded below."
        if effect.get("type") in {"spell_attack", "auto_damage", "save_damage"}:
            damage = effect.get("damage", 0)
            return f"{spell_name} takes effect for {damage} damage; the engine's rolls and target's remaining HP are recorded below."
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
        return "Caldus welcomes the shrine bell back and honors the reward recorded in the journal."
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
    if "no immediate threat" in facts:
        return choose((
            "Nothing moves in the cellar. For now, the way ahead is quiet.",
            "Your search turns up no danger nearby; only the stillness answers.",
            "You scan the shadows carefully, but find no immediate threat.",
        ))
    if "catch your breath" in facts:
        return "You take a moment to steady yourself. The cellar remains quiet."
    if "attack roll" in facts:
        if "critical miss" in facts:
            return "Your strike goes badly awry, leaving your opponent unharmed."
        if "attack roll" in facts and "damage " in facts:
            if "is defeated" in facts:
                return choose((
                    "Your blow finds its mark, and the enemy finally falls.",
                    "The fight ends with your strike. The threat is defeated.",
                    "You land the decisive hit; the enemy can fight no longer.",
                ))
            return choose((
                "Your attack connects. The enemy staggers but keeps fighting.",
                "Steel meets its target, forcing your foe onto the defensive.",
                "You press the attack and leave your opponent visibly wounded.",
            ))
        if "hits you for" in facts:
            return "Your attack fails to stop the counterblow, and the enemy hits back."
        return choose((
            "Your attack misses, and the enemy remains in your way.",
            "The strike cuts through empty air; your foe is still standing.",
            "Your opponent slips clear of the blow. The fight continues.",
        ))
    if "you rest and recover" in facts:
        return choose((
            "You pause to recover, and the ache in your wounds begins to ease.",
            "A brief rest gives you time to tend your injuries.",
            "You catch your breath and feel steadier than before.",
        ))
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
    return choose((
        f"You take action: {action}. The scene shifts around your choice.",
        f"Your decision sets events in motion: {action}.",
        f"You commit to your approach: {action}.",
    ))
