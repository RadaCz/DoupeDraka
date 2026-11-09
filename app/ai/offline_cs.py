"""Czech prose for the offline narrator (engine facts stay English)."""

from .base import NarrationContext
from .offline_variety import generic_scene_prose, variety_seed


def narrate_offline_cs(context: NarrationContext) -> str:
    facts = " ".join(context.events).lower()
    action = context.action.strip().rstrip(".!?")
    seed = variety_seed(context)

    def choose(options: tuple[str, ...]) -> str:
        return options[seed % len(options)]

    if context.spell_facts:
        spell_name = context.spell_facts.get("spell_name", "Kouzlo")
        effect = context.spell_facts.get("effect", {})
        if effect.get("type") == "not_modeled":
            return f"{spell_name} se rozzáří, ale jeho účinek zatím není modelovaný; žádný slot se neodečte."
        if effect.get("type") == "heal":
            return f"{spell_name} ti přináší úlevu; přesné uzdravení je v zápisu tahu."
        if effect.get("type") in {"spell_attack", "auto_damage", "save_damage"}:
            return f"{spell_name} zasáhne; hod a zbývající HP nepřítele najdeš v zápisu tahu."
        if effect.get("type") == "unavailable":
            return next(
                (event for event in context.events if "no spell slot was spent" in event.lower()),
                f"{spell_name} v této situaci nevyjde; slot zůstává nedotčený.",
            )
    if "spell effects are not implemented" in facts:
        return "Slova moci zatím nepůsobí; žádná kouzla se neodečítají."
    if "agree to recover the stolen shrine bell" in facts:
        return "Přijímáš Caldusovu prosbu a stezka vede k Nibovu stánku na tržišti."
    if "hands you the shrine bell" in facts:
        return "Nib přiznává krádež a vkládá ti do rukou ukradený chrámový zvon."
    if "return the shrine bell to caldus" in facts:
        return "Caldus vítá návrat zvonu a odměna zůstává zapsaná v deníku."
    if "an enemy appears:" in facts:
        enemy = next(
            (event.split("An enemy appears:", 1)[1].split("(", 1)[0].strip()
             for event in context.events if "An enemy appears:" in event),
            "nepřítel",
        )
        return choose((
            f"Ticho praská — {enemy} vstoupí do tvé cesty. Ještě neútočil. Co uděláš?",
            f"Náhle se vynoří {enemy}. Stvoření čeká na tvůj první tah.",
            f"Hledání odhalí nebezpečí: {enemy} stojí v cestě, ale zatím neútočí.",
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
    if "no immediate threat" in facts:
        return choose((
            "Nic se nehýbe. Pro teď je tady klid.",
            "V okolí nečíhá žádné nebezpečí — jen ticho.",
            "Pečlivě skenuješ stíny, ale nic bezprostředně nehrozí.",
        ))
    if "catch your breath" in facts:
        return "Na chvíli se zastavíš a dech se ti uklidní. Sklep zůstává tichý."
    if "attack roll" in facts:
        if "critical miss" in facts:
            return "Tvůj úder se pokaždě — protivník zůstává nezraněný."
        if "attack roll" in facts and "damage " in facts:
            if "is defeated" in facts:
                return choose((
                    "Tvůj zásah najde cíl a nepřítel padá.",
                    "Boj končí tvým úderem. Hrozba je poražena.",
                    "Rozhodující ránou přemůžeš soupeře.",
                ))
            return choose((
                "Úder sedí; nepřítel zakolísá, ale stále bojuje.",
                "Ocel zasáhne a protivníka žene do defenzivy.",
                "Zatlačíš na soupeře — rány jsou vidět.",
            ))
        if "hits you for" in facts:
            return "Tvůj útok nezastaví protivníkův protiúder."
        return choose((
            "Útok mine — nepřítel stále stojí v cestě.",
            "Čepel prosviští prázdnem.",
            "Soupeř se vykroutí; boj pokračuje.",
        ))
    if "you rest and recover" in facts:
        return choose((
            "Krátký odpočinek zmírní bolest zranění.",
            "Na chvíli vydechneš a cítíš se jistější.",
            "Sbalíš síly a tělo ti odpoví úlevou.",
        ))
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
