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
    from ..display_localization import display_location

    dossier = context.scene_dossier or {}
    location = dossier.get("location") or {}
    if location.get("first_visit_here", True):
        return ""
    raw_place = context.location
    place = display_location(raw_place, language) if language == "cs" else raw_place
    seed = variety_seed(context)
    if language == "cs":
        from ..display_localization import display_location

        place_gen = display_location(raw_place, "cs", "gen")
        place_loc = display_location(raw_place, "cs", "loc")
        return choose(
            (
                f"Na tomto místě v {place_loc} už víš, kam šlápneš. ",
                f"Známé stěny {place_gen} tě vítají jinak než poprvé. ",
                f"Vraceš se do {place_gen} a prostor ti odpovídá tíhou vzpomínek. ",
            ),
            seed,
        )
    return choose(
        (
            f"You already know the footing in {place}. ",
            f"The familiar walls of {place} greet you differently now. ",
            f"Back in {place}, the air weighs on you with old memory. ",
        ),
        seed,
    )


def _place_name(context: NarrationContext) -> str:
    dossier = context.scene_dossier or {}
    loc = dossier.get("location") or {}
    return (loc.get("name") or context.location or "the room").strip()


def _action_echoes_place(context: NarrationContext) -> bool:
    """True when explore/search action text mostly repeats the current location name."""
    action = context.action.strip().lower()
    place = _place_name(context).lower()
    if not place or place == "the room":
        return False
    bare = place.removeprefix("the ").strip()
    if not any(action.startswith(word) for word in ("search", "explore", "investigate", "prohledat", "prozkoumat", "hledat")):
        return False
    return bare in action or place in action


def generic_scene_prose(context: NarrationContext, *, language: str) -> str:
    """Fallback when no fact-specific offline branch matched — sensory, no meta-game voice."""
    from ..display_localization import display_location

    seed = variety_seed(context)
    lead = familiarity_lead(context, language=language)
    kind = context.scene_kind or "general"
    raw_place = _place_name(context)
    place = display_location(raw_place, language) if language == "cs" else raw_place
    place_loc = display_location(raw_place, "cs", "loc") if language == "cs" else raw_place
    place_gen = display_location(raw_place, "cs", "gen") if language == "cs" else raw_place
    place_nom = place
    echo_place = _action_echoes_place(context)

    if language == "cs":
        explore_cs = (
            (
                f"{lead}Přejdeš místem v {place_loc}; kameny, stíny a vzduch vyprávějí vlastní příběh.",
                f"{lead}V {place_loc} pozoruješ detaily — vlhkost, šelest a stopy minulých kroků.",
                f"{lead}Okolí {place_gen} zkoumáš očima i sluchem; nic nespěchá do očí.",
                f"{lead}Každý krok v {place_loc} odhalí jen další vrstvu prachu a stínů.",
            )
            if echo_place
            else (
                f"{lead}Přejdeš blíž ke stěnám v {place_loc} a hledáš, co by prozradily stopy na zemi.",
                f"{lead}Pozornost klouže po chladném kameni a vlhkém vzduchu {place_gen}.",
                f"{lead}Uši a zrak nasávají zvuky a stíny v {place_loc}.",
                f"{lead}Okraj světla střídavě odhaluje a skrývá rohy {place_gen}.",
            )
        )
        by_kind: dict[str, tuple[str, ...]] = {
            "talk": (
                f"{lead}Slova se rozplete mezi vámi v {place_loc}; tón hlasů nese váhu okamžiku.",
                f"{lead}Rozhovor v {place_loc} je křehký — každé přerušení zní hlasitěji v tichu.",
                f"{lead}Hlas se nese kamsi dál; {place_nom} ti vrací jen ozvěnu a pohled druhých.",
            ),
            "combat": (
                f"{lead}Ocel zazvoní v {place_loc} a ruch boje utlučí vše ostatní.",
                f"{lead}Úder nebo krok přehluší ticho — dech soupeře je vidět v záblesku světla.",
                f"{lead}Boj v {place_loc} je krátký a ostrý; tělo pamatuje každý nádech.",
            ),
            "explore": explore_cs,
            "travel": (
                f"{lead}Kroky odnesou dál od {place_gen}; cesta voní prachem a chladným vzduchem.",
                f"{lead}Batoh šustí a ulice podzemí mizí za zády.",
                f"{lead}Překročíš práh — {place_nom} zůstává v paměti, dokud se nevrátíš.",
            ),
            "rest": (
                f"{lead}Sedneš si; chlad kamene a vzdálené kapání ti dovolí vydechnout v {place_loc}.",
                f"{lead}Ramenům dovolíš klesnout — únava jako olovo, zatímco {place_nom} dřímá.",
                f"{lead}Oči se na chvíli zavřou; vzduch v {place_loc} je těžký, ale klidný.",
            ),
            "story_moment": (
                f"{lead}Okamžik v {place_loc} se zastaví — i kapky vody znějí hlasitěji.",
                f"{lead}Něco ve zdejším tichu se posune; {place_nom} to ponese v sobě.",
                f"{lead}Srdce tlukou do vzduchu v {place_loc}; rozhodnutí visí mezi údery.",
            ),
            "general": (
                f"{lead}Uděláš, co je třeba, a {place_nom} to přijme bez zbytečných slov.",
                f"{lead}Ruce i pohled patří okamžiku v {place_loc} — bez zbytečného hluku.",
                f"{lead}Čin dozní v {place_loc}; kameny a vzduch ho nesou dál.",
            ),
        }
        return choose(by_kind.get(kind, by_kind["general"]), seed)

    explore_en = (
        (
            f"{lead}You move through {place}, reading stone, shadow, and the pull of the air.",
            f"{lead}In {place}, small details catch your eye — moisture, scent, and old scratches.",
            f"{lead}You study the space around you in {place}; nothing announces itself loudly.",
        )
        if echo_place
        else (
            f"{lead}You draw nearer to the walls of {place}, hunting for marks on stone and floor.",
            f"{lead}Your attention slides over cold rock and damp air in {place}.",
            f"{lead}Ear and eye drink in the sounds and shadows of {place}.",
        )
    )
    by_kind = {
        "talk": (
            f"{lead}Words unfold between you in {place}; voices carry more weight in the hush.",
            f"{lead}Conversation in {place} feels brittle — every pause rings louder.",
            f"{lead}Your voice carries; {place} answers with echo and another's gaze.",
        ),
        "combat": (
            f"{lead}Steel rings in {place}; the fight drowns everything else.",
            f"{lead}A blow or step shatters the quiet — breath shows in a shard of light.",
            f"{lead}Combat in {place} is short and sharp; muscles remember every inhale.",
        ),
        "explore": explore_en,
        "travel": (
            f"{lead}Footsteps lead away from {place}; the path smells of dust and cold air.",
            f"{lead}Your pack whispers as the underways fall behind.",
            f"{lead}You cross the threshold — {place} lingers in memory until you return.",
        ),
        "rest": (
            f"{lead}You sit; cold stone and distant dripping let you breathe in {place}.",
            f"{lead}Shoulders drop — weariness like lead while {place} dozes.",
            f"{lead}Eyes close briefly; the air in {place} is heavy but still.",
        ),
        "story_moment": (
            f"{lead}A beat hangs in {place} — even dripping water sounds louder.",
            f"{lead}Something in the hush shifts; {place} will hold it a while.",
            f"{lead}Heartbeats meet the air of {place}; the weight of choice stays between breaths.",
        ),
        "general": (
            f"{lead}You do what must be done, and {place} takes it without wasted words.",
            f"{lead}Hands and gaze belong to the moment in {place} — no extra noise.",
            f"{lead}The deed settles in {place}; stone and air carry it onward.",
        ),
    }
    return choose(by_kind.get(kind, by_kind["general"]), seed)
