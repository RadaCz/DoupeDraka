"""Czech prose for the offline narrator (engine facts stay English)."""

from .base import NarrationContext


def narrate_offline_cs(context: NarrationContext) -> str:
    facts = " ".join(context.events).lower()
    action = context.action.strip().rstrip(".!?")
    seed = sum(ord(char) for char in "|".join(context.events))

    def choose(options: tuple[str, ...]) -> str:
        return options[seed % len(options)]

    if "an enemy appears:" in facts:
        return choose((
            "Ticho praská — nepřítel vstoupí do tvé cesty. Ještě neútočil. Co uděláš?",
            "Náhle se vynoří hrozba. Stvoření čeká na tvůj první tah.",
        ))
    if "gold pieces tucked beneath loose stones" in facts:
        return "Mezi kameny zazáří mince. Schováváš je do měšce."
    if "fresh tracks leading deeper" in facts or "fresh tracks cross" in facts:
        return "Čerstvé stopy vedou dál do temnoty sklepa."
    if "no immediate threat" in facts:
        return "Nic se nehýbe. Pro teď je tady klid."
    if "check:" in facts:
        succeeded = any("— success" in event.lower() for event in context.events)
        if succeeded:
            return choose((
                f"Tvůj pokus ({action.lower()}) vyjde dobře.",
                f"Pozorně {action.lower()} — okamžik ti přeje.",
            ))
        return choose((
            f"Zkoušíš {action.lower()}, ale nic z toho nemáš.",
            f"Pokus o {action.lower()} se nepovede podle plánu.",
        ))
    if "attack roll" in facts:
        return "Ocel se střetne s nepřítelem — výsledek je v zápisu tahu."
    return choose((
        f"Rozhodneš se: {action}. Scéna se posune dál.",
        f"Zavážeš se k tahu: {action}.",
    ))
