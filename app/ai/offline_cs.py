"""Czech prose for the offline narrator (engine facts stay English)."""

from ..display_localization import display_creature, display_spell
from .base import NarrationContext
from .offline_prose import (
    breath_pause_prose,
    combat_opening_prose,
    combat_prose_from_events,
    empty_search_prose,
    rest_recovery_prose,
    shrine_bell_return_prose,
)
from .offline_variety import generic_scene_prose, variety_seed


def narrate_offline_cs(context: NarrationContext) -> str:
    facts = " ".join(context.events).lower()
    action = context.action.strip().rstrip(".!?")
    seed = variety_seed(context)

    def choose(options: tuple[str, ...]) -> str:
        return options[seed % len(options)]

    if context.spell_facts:
        raw_spell = context.spell_facts.get("spell_name", "Kouzlo")
        spell_name = display_spell(str(raw_spell), "cs")
        effect = context.spell_facts.get("effect", {})
        if effect.get("type") == "not_modeled":
            return f"{spell_name} se rozzáří, ale jeho účinek zatím není modelovaný; žádný slot se neodečte."
        if effect.get("type") == "heal":
            return choose((
                f"{spell_name} tě obklopí teplem a ztiší bolest.",
                f"Síla {spell_name} splývá s tvým dechem a uzdravuje zranění.",
                f"{spell_name} vzplane v dlaních a vrací tělu sílu.",
            ))
        if effect.get("type") in {"spell_attack", "auto_damage", "save_damage"}:
            return choose((
                f"{spell_name} vystřelí z tvých rukou a praští do protivníka.",
                f"Vrháš {spell_name}; vzduch praská a zásah dozní.",
                f"{spell_name} se rozlomí — nepřítel září bolestí.",
            ))
        if effect.get("type") == "unavailable":
            return choose((
                f"{spell_name} v této situaci nevyjde; slot zůstává nedotčený.",
                f"Zatím nemůžeš seslat {spell_name}; žádný slot se neodečte.",
                f"{spell_name} se tu nerozsvítí — podmínky nejsou splněné.",
            ))
    if "spell effects are not implemented" in facts:
        return "Slova moci zatím nepůsobí; žádná kouzla se neodečítají."
    if "agree to recover the stolen shrine bell" in facts:
        return "Přijímáš Caldusovu prosbu a stezka vede k Nibovu stánku na tržišti."
    if "hands you the shrine bell" in facts:
        return "Nib přiznává krádež a vkládá ti do rukou ukradený chrámový zvon."
    if "return the shrine bell to caldus" in facts:
        return shrine_bell_return_prose(context, language="cs")
    if "an enemy appears:" in facts:
        raw_enemy = next(
            (event.split("An enemy appears:", 1)[1].split("(", 1)[0].strip()
             for event in context.events if "An enemy appears:" in event),
            "nepřítel",
        )
        enemy = display_creature(raw_enemy, "cs")
        return choose((
            f"Ticho praská — {enemy} vstoupí do tvé cesty. Ještě neútočil. Co uděláš?",
            f"Náhle se vynoří {enemy}. Stvoření čeká na tvůj první tah.",
            f"Hledání odhalí nebezpečí: {enemy} stojí v cestě, ale zatím neútočí.",
        ))
    if "no loose coin left to find" in facts or "pick over stones and debris" in facts:
        return choose((
            "Prohledáš sutiny, ale volné mince tu už nejsou.",
            "Kamení i prach jsi už důkladně pročesal — další zlato tu neleží.",
            "Tahle místa už nic nedají; mince sis sebral dřív.",
        ))
    if "gold pieces tucked beneath loose stones" in facts:
        amount = next(
            (event.split("find ", 1)[1].split(" gold", 1)[0]
             for event in context.events if "gold pieces tucked beneath loose stones" in event),
            "pár",
        )
        return choose((
            f"Mezi kameny zazáří mince. Schováváš si {amount} zlatých.",
            f"Pod volným kamenem leží {amount} zlatých — patří do tvého měšce.",
            f"V podlaze sklepa najdeš malou schránku: {amount} zlatých.",
        ))
    if "fresh tracks leading deeper" in facts or "fresh tracks cross" in facts:
        return choose((
            "Čerstvé stopy vedou dál do temnoty sklepa.",
            "Někdo tu byl nedávno — stopy mizí hlouběji pod zemí.",
            "Prach vypráví příběh: nové otisky pokračují do tmy.",
        ))
    if "scratches around a stone panel" in facts:
        return choose((
            "Poškrábaný kamenný panel upoutá pozornost; nedávno se s ním někdo zabýval.",
            "Kolem panelu jsou stopy — možná skrývá průchod.",
            "Kamenná deska nese čerstvé rýhy. Něco za ní ještě nedávno někdo hledal.",
        ))
    if "no immediate threat" in facts or "find no immediate threat" in facts:
        return empty_search_prose(context, language="cs")
    if "catch your breath" in facts:
        return breath_pause_prose(context, language="cs")
    opening = combat_opening_prose(context, language="cs")
    if opening:
        return opening
    combat = combat_prose_from_events(context, language="cs")
    if combat:
        return combat
    if "you rest and recover" in facts:
        return rest_recovery_prose(context, language="cs")
    if "break away and escape" in facts:
        return "Najdeš skulinku a utečeš dřív, než tě nepřítel zastaví."
    if "fail to break away" in facts:
        return "Nepřítel drží pozici a ty se nemůžeš vyprostit."
    if "check:" in facts:
        succeeded = any("— success" in event.lower() for event in context.events)
        if succeeded:
            return choose((
                f"Tvůj pokus ({action.lower()}) vyjde dobře.",
                f"Pozorně {action.lower()} — okamžik ti přeje.",
                f"Podaří se ti {action.lower()} bez komplikací.",
            ))
        return choose((
            f"Zkoušíš {action.lower()}, ale nic z toho nemáš.",
            f"Pokus o {action.lower()} se nepovede podle plánu.",
            f"Snažíš se {action.lower()}, ale bez výhody.",
        ))
    return generic_scene_prose(context, language="cs")
