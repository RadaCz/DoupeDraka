"""Offline narrator variety: scene_kind fallbacks and return-visit leads (facts-only)."""

from __future__ import annotations

from .base import NarrationContext


def capitalize_cs_sentences(text: str) -> str:
    """Po tečce začíná věta velkým písmenem (cs próza po {lead})."""
    if not text:
        return text
    chars: list[str] = []
    cap_next = True
    for ch in text:
        if cap_next and ch.isalpha():
            chars.append(ch.upper())
            cap_next = False
        else:
            chars.append(ch)
            if ch == ".":
                cap_next = True
            elif ch not in " \t\n":
                cap_next = False
    return "".join(chars)


def variety_seed(context: NarrationContext) -> int:
    """Stable but distinct per facts, memories, and scene kind."""
    base = sum(ord(char) for char in "|".join(context.events))
    memory = sum(ord(char) for char in "|".join(context.memories[:5]))
    kind = sum(ord(char) for char in (context.scene_kind or "general"))
    return base + memory * 17 + kind * 31 + len(context.action) * 3


def choose(options: tuple[str, ...], seed: int) -> str:
    text, _ = choose_variety(options, seed)
    return text


def last_variant_index(context: NarrationContext, category: str) -> int | None:
    """Index poslední varianty stejné kategorie (volitelně v scene_dossier.narrator_variety)."""
    dossier = context.scene_dossier or {}
    block = dossier.get("narrator_variety") or {}
    raw = block.get(category)
    if raw is None:
        return None
    return int(raw)


def choose_variety(
    options: tuple[str, ...],
    seed: int,
    *,
    last_index: int | None = None,
) -> tuple[str, int]:
    """Deterministický výběr; stejná varianta se neopakuje za sebou (AC17-5)."""
    if not options:
        return "", 0
    index = seed % len(options)
    if last_index is not None and index == last_index and len(options) > 1:
        index = (index + 1) % len(options)
    return options[index], index


def familiarity_lead(context: NarrationContext, *, language: str) -> str:
    from ..display_localization import display_location, display_location_gen_cs, display_location_in, display_location_to

    dossier = context.scene_dossier or {}
    location = dossier.get("location") or {}
    if location.get("first_visit_here", True):
        return ""
    raw_place = context.location
    place = display_location(raw_place, language) if language == "cs" else raw_place
    seed = variety_seed(context)
    if language == "cs":
        place_in = display_location_in(raw_place, "cs")
        place_to = display_location_to(raw_place, "cs")
        place_gen = display_location_gen_cs(raw_place, "cs")
        return choose(
            (
                f"Na tomto místě {place_in} už víš, kam šlápneš. ",
                f"Známé stěny {place_gen} tě vítají jinak než poprvé. ",
                f"Vracíš se {place_to} a prostor ti odpovídá tíhou vzpomínek. ",
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
    from ..display_localization import display_location, display_location_in, display_location_to

    seed = variety_seed(context)
    lead = familiarity_lead(context, language=language)
    kind = context.scene_kind or "general"
    raw_place = _place_name(context)
    place = display_location(raw_place, language) if language == "cs" else raw_place
    place_in = display_location_in(raw_place, "cs") if language == "cs" else raw_place
    place_to = display_location_to(raw_place, "cs") if language == "cs" else raw_place
    place_nom = place
    echo_place = _action_echoes_place(context)

    if language == "cs":
        explore_cs = (
            (
                f"{lead}Přejdeš místem {place_in}; kameny, stíny a vzduch vyprávějí vlastní příběh.",
                f"{lead}Pozoruješ detaily {place_in} — vlhkost, šelest a stopy minulých kroků.",
                f"{lead}Okolí {place_nom} zkoumáš očima i sluchem; nic nespěchá do očí.",
                f"{lead}Každý krok {place_in} odhalí jen další vrstvu prachu a stínů.",
            )
            if echo_place
            else (
                f"{lead}Přejdeš blíž ke stěnám {place_in} a hledáš, co by prozradily stopy na zemi.",
                f"{lead}Pozornost klouže po chladném kameni a vlhkém vzduchu {place_nom}.",
                f"{lead}Uši a zrak nasávají zvuky a stíny {place_in}.",
                f"{lead}Okraj světla střídavě odhaluje a skrývá rohy {place_nom}.",
            )
        )
        by_kind: dict[str, tuple[str, ...]] = {
            "talk": (
                f"{lead}Slova se rozplete mezi vámi {place_in}; tón hlasů nese váhu okamžiku.",
                f"{lead}Rozhovor {place_in} je křehký — každé přerušení zní hlasitěji v tichu.",
                f"{lead}Hlas se nese kamsi dál; {place_nom} ti vrací jen ozvěnu a pohled druhých.",
            ),
            "combat": (
                f"{lead}Ocel zazvoní {place_in} a ruch boje utlučí vše ostatní.",
                f"{lead}Úder nebo krok přehluší ticho — dech soupeře je vidět v záblesku světla.",
                f"{lead}Boj {place_in} je krátký a ostrý; tělo pamatuje každý nádech.",
            ),
            "explore": explore_cs,
            "travel": (
                f"{lead}Kroky odnesou dál od {place_nom}; cesta voní prachem a chladným vzduchem.",
                f"{lead}Batoh šustí a ulice podzemí mizí za zády.",
                f"{lead}Překročíš práh — {place_nom} zůstává v paměti, dokud se nevrátíš.",
            ),
            "rest": (
                f"{lead}Sedneš si; chlad kamene a vzdálené kapání ti dovolí vydechnout {place_in}.",
                f"{lead}Ramenům dovolíš klesnout — únava jako olovo, zatímco {place_nom} dřímá.",
                f"{lead}Oči se na chvíli zavřou; vzduch {place_in} je těžký, ale klidný.",
            ),
            "story_moment": (
                f"{lead}Okamžik {place_in} se zastaví — i kapky vody znějí hlasitěji.",
                f"{lead}Něco ve zdejším tichu se posune; {place_nom} to ponese v sobě.",
                f"{lead}Srdce tlukou do vzduchu {place_in}; rozhodnutí visí mezi údery.",
            ),
            "general": (
                f"{lead}Uděláš, co je třeba, a {place_nom} to přijme bez zbytečných slov.",
                f"{lead}Ruce i pohled patří okamžiku {place_in} — bez zbytečného hluku.",
                f"{lead}Čin dozní {place_in}; kameny a vzduch ho nesou dál.",
            ),
        }
        return capitalize_cs_sentences(choose(by_kind.get(kind, by_kind["general"]), seed))

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
