"""Offline narrator variety: scene_kind fallbacks and return-visit leads (facts-only)."""

from __future__ import annotations

from .base import NarrationContext


def variety_seed(context: NarrationContext) -> int:
    """Stable but distinct per facts, memories, and scene kind."""
    base = sum(ord(char) for char in "|".join(context.events))
    memory = sum(ord(char) for char in "|".join(context.memories[:5]))
    kind = sum(ord(char) for char in (context.scene_kind or "general"))
    return base + memory * 17 + kind * 31 + len(context.action) * 3


def choose(options: tuple[str, ...], seed: int) -> str:
    return options[seed % len(options)]


def familiarity_lead(context: NarrationContext, *, language: str) -> str:
    dossier = context.scene_dossier or {}
    location = dossier.get("location") or {}
    if location.get("first_visit_here", True):
        return ""
    place = context.location
    seed = variety_seed(context)
    if language == "cs":
        return choose(
            (
                f"V {place} už znáš cestu — nic nepůsobí jako první návštěva. ",
                f"Opět stojíš v {place}; prostor ti je povědomý. ",
                f"Návrat do {place} přináší jinou náladu než poprvé. ",
            ),
            seed,
        )
    return choose(
        (
            f"You know {place} now — it no longer feels like a first visit. ",
            f"Back in {place}, the layout is familiar under your feet. ",
            f"Returning to {place} carries a different weight than your arrival. ",
        ),
        seed,
    )


def generic_scene_prose(context: NarrationContext, *, language: str) -> str:
    """Fallback when no fact-specific offline branch matched."""
    action = context.action.strip().rstrip(".!?")
    seed = variety_seed(context)
    lead = familiarity_lead(context, language=language)
    kind = context.scene_kind or "general"

    if language == "cs":
        by_kind: dict[str, tuple[str, ...]] = {
            "talk": (
                f"{lead}Slova k {action.lower()} visí ve vzduchu — odpověď přijde z toho, co engine potvrdil.",
                f"{lead}Zkoušíš {action.lower()}; rozhovor se odvíjí jen z potvrzených faktů.",
                f"{lead}Tvůj pokus ({action.lower()}) patří do dialogu, který shrnují zápis tahu.",
            ),
            "combat": (
                f"{lead}Bojová výměna kolem „{action}“ je krátká a věcná.",
                f"{lead}V souboji rozhoduje „{action}“ — detaily hodů jsou v zápisu.",
                f"{lead}Úder nebo obrana: {action}. Mechanika je v deníku.",
            ),
            "explore": (
                f"{lead}Prozkoumáváš okolí — {action.lower()} odhalí jen to, co engine zaznamenal.",
                f"{lead}Pozornost k {action.lower()} přináší odpověď ze sklepa, ne z fantazie.",
                f"{lead}Hledání ({action.lower()}) zůstává v mezích potvrzených stop.",
            ),
            "travel": (
                f"{lead}Putuješ dál: {action.lower()} mění místo jen podle enginu.",
                f"{lead}Cesta ({action.lower()}) končí tam, kam tě engine dovedl.",
                f"{lead}Krok za krokem — {action.lower()} bez vymyšlených zastávek.",
            ),
            "rest": (
                f"{lead}Na chvíli zpomaluješ — {action.lower()} je tichý moment.",
                f"{lead}Odpočinek ({action.lower()}) nechá tělo i deník mluvit číselně.",
                f"{lead}V klidu zkusíš {action.lower()}; úleva je v zápisu tahu.",
            ),
            "story_moment": (
                f"{lead}Zásadní okamžik: {action}. Následky už jsou v faktech.",
                f"{lead}{action} — příběh se zlomí jen tam, kde engine povolil.",
                f"{lead}Váha rozhodnutí ({action.lower()}) bez nových odměn navíc.",
            ),
            "general": (
                f"{lead}Rozhodneš se pro {action.lower()} — scéna reaguje podle zápisu.",
                f"{lead}Tvá volba „{action}“ posune okamžik dál.",
                f"{lead}Zavážeš se k {action.lower()}; zbytek patří deníku.",
            ),
        }
        return choose(by_kind.get(kind, by_kind["general"]), seed)

    by_kind = {
        "talk": (
            f"{lead}You steer the conversation toward {action.lower()}; only confirmed facts shape the reply.",
            f"{lead}Your attempt to {action.lower()} hinges on what the engine recorded.",
            f"{lead}Words hang in the air as you {action.lower()} — outcomes stay in the journal.",
        ),
        "combat": (
            f"{lead}Combat stays terse around “{action}”; rolls and HP live in the log.",
            f"{lead}The fight turns on {action.lower()} — mechanics below, not invented blows.",
            f"{lead}Steel and reflex: {action}. The engine already resolved the exchange.",
        ),
        "explore": (
            f"{lead}You probe the area with “{action}”; discoveries match the recorded facts only.",
            f"{lead}Searching ({action.lower()}) reveals what the cellar already committed.",
            f"{lead}Your exploration—“{action}”—stays within the engine’s findings.",
        ),
        "travel": (
            f"{lead}You move on: {action.lower()} ends where the engine placed you.",
            f"{lead}Travel via {action.lower()} without invented stops along the way.",
            f"{lead}The route for “{action}” is already decided in the log.",
        ),
        "rest": (
            f"{lead}A quiet beat: you {action.lower()} and let recovery show in the numbers.",
            f"{lead}You try to {action.lower()}; breath and HP changes stay factual.",
            f"{lead}Rest ({action.lower()}) slows the scene without new rewards.",
        ),
        "story_moment": (
            f"{lead}A pivotal beat—{action}—lands with weight already fixed in the facts.",
            f"{lead}{action} shifts the moment; nothing extra appears beyond the log.",
            f"{lead}The story turns on {action.lower()} without invented treasure.",
        ),
        "general": (
            f"{lead}You choose to {action.lower()}; the scene answers from the journal.",
            f"{lead}Your decision—“{action}”—moves the beat forward.",
            f"{lead}You commit to {action.lower()}; details remain in the engine lines.",
        ),
    }
    return choose(by_kind.get(kind, by_kind["general"]), seed)
