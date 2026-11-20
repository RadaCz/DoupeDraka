"""Závazné české šablony Narrator V2 (Úkol 17, sekce B–D). Texty ze specifikace Designera."""

from __future__ import annotations

from typing import Final

# --- B. Bojový rytmus (≥4 varianty na kategorii) ---

BATTLE_B1: Final[tuple[str, ...]] = (
    "Ticho se roztrhne. {foe} ti vstoupí do cesty a čeká, kdo udělá první krok.",
    "Ze stínu se vynoří {foe}. Zatím neútočí, jen tě měří pohledem.",
    "Něco se pohne na kraji světla — {foe} stojí v cestě a ustupovat nehodlá.",
    "Vzduch zhoustne. {foe} se napřímí do bojového postoje.",
)

BATTLE_B2: Final[tuple[str, ...]] = (
    "{lead}Rána sedí. {foe} zavrávorá, ale drží se na nohou.",
    "{lead}Zbraň najde cíl a {foe} sykne bolestí.",
    "{lead}Zasáhneš. {foe} couvne o krok a znovu zvedá zbraň.",
    "{lead}Tvůj výpad projde krytem — {foe} je zraněný, ale boj nekončí.",
)

BATTLE_B3: Final[tuple[str, ...]] = (
    "{lead}{foe} se na poslední chvíli uhne a tvůj úder proletí vzduchem.",
    "{lead}Zbraň sklouzne po krytu. {foe} se ušklíbne.",
    "{lead}Výpad je o vlas vedle — {foe} stále blokuje cestu.",
    "{lead}Zaútočíš, ale {foe} tvůj pohyb přečte a vyhne se.",
)

BATTLE_B4: Final[tuple[str, ...]] = (
    "{lead}Najdeš přesně tu mezeru, kterou jsi hledal. Úder dopadne plnou silou.",
    "{lead}Čistý, tvrdý zásah — {foe} se zapotácí, jako by ho zasáhl blesk.",
    "{lead}Na okamžik se všechno zpomalí a tvá rána dopadne tam, kde bolí nejvíc.",
    "{lead}Tohle byl dokonalý úder. {foe} zalapá po dechu.",
)

BATTLE_B5: Final[tuple[str, ...]] = (
    "Zaujmeš pevný postoj a zvedneš kryt.",
    "Stáhneš se za zbraň a čekáš, co {foe} zkusí.",
    "Přeneseš váhu, kryješ se a hlídáš každý jeho pohyb.",
    "Necháš útok na později — teď jde o to přežít další ránu.",
)

BATTLE_B6: Final[tuple[str, ...]] = (
    "{foe} se dostane přes tvůj kryt a zasáhne tě.",
    "Rána přijde rychleji, než čekáš. Bolest ti projede tělem.",
    "{foe} udeří a ty cítíš, jak ti z paží mizí síla.",
    "Nestihneš uhnout — {foe} tě zasáhne.",
)

BATTLE_B7: Final[tuple[str, ...]] = (
    "{foe} se rozmáchne, ale ty uhneš.",
    "Úder ti jen prosviští kolem ucha.",
    "Tvůj kryt vydrží — {foe} narazí do prázdna.",
    "{foe} zaútočí příliš zbrkle a mine.",
)

BATTLE_B8: Final[tuple[str, ...]] = (
    "Svět se ti na okamžik zhoupne. Ještě jedna taková rána a bude po tobě.",
    "Krev ti buší ve spáncích. Dlouho takhle nevydržíš.",
    "Kolena se ti podlamují, ale zbraň nepouštíš.",
    "Každý nádech bolí. Teď je čas myslet na záchranu.",
)

BATTLE_B9: Final[tuple[str, ...]] = (
    "{lead}Poslední úder dopadne. {foe} se zhroutí a zůstane ležet.",
    "{lead}{foe} klesne k zemi. Kolem se rozhostí ticho.",
    "{lead}Boj je u konce — {foe} už nevstane.",
    "{lead}Zbraň dopadne naposledy a {foe} padne.",
)

BATTLE_B10: Final[tuple[str, ...]] = (
    "Tma se zavře nad tebou rychleji, než stačíš zvednout ruce.",
    "Poslední, co vidíš, je {foe} nad tebou. Pak přijde ticho.",
    "Nohy povolí a země se ti přiblíží. Svět zhasne.",
    "Síla tě opustí. Padáš a zvuky boje se vzdalují.",
)

BATTLE_B11: Final[tuple[str, ...]] = (
    "Najdeš skulinku a zmizíš dřív, než tě {foe} zastaví.",
    "Otočíš se a utíkáš. Kroky za tebou slábnou.",
    "Využiješ chvilku nepozornosti a vyklouzneš z boje.",
    "Prchneš do tmy a {foe} tě nechá jít.",
)

BATTLE_B12: Final[tuple[str, ...]] = (
    "{foe} ti zastoupí cestu. Odsud se nedostaneš.",
    "Zkusíš couvnout, ale {foe} je rychlejší.",
    "Cesta zpátky je zavřená — musíš bojovat.",
    "{foe} se drží těsně u tebe a nepustí tě.",
)

BATTLE_B13_ADVANCE: Final[tuple[str, ...]] = (
    "Zkrátíš vzdálenost.",
    "Uděláš pár rychlých kroků vpřed.",
    "Přiblížíš se na dosah.",
    "Vyrazíš kupředu a {foe} je blíž.",
)

BATTLE_B13_RETREAT: Final[tuple[str, ...]] = (
    "Couvneš a získáš trochu prostoru.",
    "Ustoupíš o pár kroků.",
    "Stáhneš se dozadu a nespouštíš z protivníka oči.",
    "Odstoupíš z jeho dosahu.",
)

BATTLE_CATEGORIES: Final[dict[str, tuple[str, ...]]] = {
    "B1": BATTLE_B1,
    "B2": BATTLE_B2,
    "B3": BATTLE_B3,
    "B4": BATTLE_B4,
    "B5": BATTLE_B5,
    "B6": BATTLE_B6,
    "B7": BATTLE_B7,
    "B8": BATTLE_B8,
    "B9": BATTLE_B9,
    "B10": BATTLE_B10,
    "B11": BATTLE_B11,
    "B12": BATTLE_B12,
    "B13": BATTLE_B13_ADVANCE + BATTLE_B13_RETREAT,
}

CHAPTER_ONE_LOCATIONS: Final[frozenset[str]] = frozenset({
    "The Whispering Cellar",
    "The Sunken Corridor",
    "The Shrine of the Forgotten",
    "The Goblin Market",
    "The Vault of Echoes",
    "The Bell Warden's Pit",
})

SECONDARY_LOCATIONS: Final[frozenset[str]] = frozenset({
    "The Forgotten Crypt",
    "The Underground River",
    "The Bandit Camp",
})

# --- C. Lokace (průzkum / návrat / nádech × 4) ---

def _loc(
    explore: tuple[str, ...],
    revisit: tuple[str, ...],
    breath: tuple[str, ...],
) -> dict[str, tuple[str, ...]]:
    return {"explore": explore, "revisit": revisit, "breath": breath}


LOCATION_CS: Final[dict[str, dict[str, tuple[str, ...]]]] = {
    "The Whispering Cellar": _loc(
        (
            "Kamenné schody mizí v šeru a ze spár táhne studený průvan.",
            "Mezi sudy a pavučinami se ozve tichý šepot — jen vítr, nebo ne?",
            "Prsty přejedou po vlhké zdi. Kámen je tu starší než dům nad ním.",
            "Plamen tvého světla se zachvěje, jako by ho někdo sfoukl zespodu.",
        ),
        (
            "Sklep tě vítá stejným chladem jako poprvé.",
            "Znáš tu už každý schod, ale šepot neutichl.",
            "Vracíš se do sklepa. Průvan pořád tahá z hloubky.",
            "Tytéž sudy, tytéž stíny — jen ty jsi jiný.",
        ),
        (
            "Opřeš se o chladný sud a na chvíli zavřeš oči.",
            "V tichu sklepa slyšíš jen svůj dech.",
            "Sedneš si na schod a necháš srdce zpomalit.",
            "Chlad kamene ti pomůže vrátit se k sobě.",
        ),
    ),
    "The Sunken Corridor": _loc(
        (
            "Voda ti sahá po kotníky a každý krok se ozvěnou vrací.",
            "Na hladině se třpytí světlo a pod ní něco tmavého.",
            "Ze stropu kape do kaluží. V rytmu kapek jako by někdo kráčel.",
            "Chodba se stáčí do tmy a voda proudí stejným směrem.",
        ),
        (
            "Potopená chodba je pořád stejně studená a mokrá.",
            "Znáš už mělčiny, ale ten pocit, že tě něco sleduje, zůstal.",
            "Voda šplouchá jako minule. Jen stopy jsou nové.",
            "Vracíš se do chodby a ozvěna tě poznává.",
        ),
        (
            "Vylezeš na suchý kámen a vyždímáš si rukáv.",
            "Na chvíli se zastavíš a posloucháš vodu.",
            "Opřeš se o zeď nad hladinou a zhluboka dýcháš.",
            "Ve slabém světle odpočíváš a hlídáš hladinu.",
        ),
    ),
    "The Shrine of the Forgotten": _loc(
        (
            "Prázdné místo po zvonu působí jako otevřená rána.",
            "Na oltáři leží prach a pár vybledlých obětin.",
            "Svíce hoří tiše a jejich vůně je stará a sladká.",
            "Na zdech jsou vyrytá jména, která už nikdo nevyslovuje.",
        ),
        (
            "Ve svatyni je stejné ticho jako minule.",
            "Svíce hoří dál, jako by tu čas plynul pomaleji.",
            "Vracíš se mezi zapomenutá jména na zdech.",
            "Svatyně tě přijme bez otázek.",
        ),
        (
            "Klekneš si na chladnou podlahu a necháš ticho, ať tě zklidní.",
            "Chvíli jen sedíš a díváš se do plamenů svící.",
            "Klid svatyně ti vrací dech.",
            "Tady se ti dýchá lehčeji než kdekoli pod zemí.",
        ),
    ),
    "The Goblin Market": _loc(
        (
            "Mezi stánky to cinká, smrdí a šeptá.",
            "Na pultech leží amulety, střepy a věci, které určitě patřily někomu jinému.",
            "Malé oči tě sledují zpoza každého kusu látky.",
            "Někdo tu smlouvá, někdo se hádá a nikdo se nedívá přímo na tebe.",
        ),
        (
            "Trh tě poznává — šepot u stánků na chvíli ztichne.",
            "Tytéž stánky, tytéž oči. Jen ceny se zase změnily.",
            "Vracíš se mezi cinkot a smlouvání.",
            "Goblini si tě pamatují a dávají si pozor.",
        ),
        (
            "Ustoupíš stranou od davu a chvíli jen pozoruješ.",
            "Opřeš se o sloup a necháš hluk trhu plynout kolem.",
            "V koutě mezi bednami si na chvíli oddechneš.",
            "Nikdo si tě nevšímá, a to je teď dobře.",
        ),
    ),
    "The Vault of Echoes": _loc(
        (
            "Každý tvůj krok se vrací desetkrát.",
            "Z rezavých řetězů visí rozbité zvony a tiše se chvějí.",
            "Vlhký kámen zesiluje i tvůj dech.",
            "Ozvěna ti vrací slova, která jsi neřekl.",
        ),
        (
            "Komnata tě vítá stejnou ozvěnou.",
            "Rozbité zvony se pohnou, jako by si tě pamatovaly.",
            "Vracíš se a ozvěna je pořád o krok napřed.",
            "Ticho tady nikdy není úplné.",
        ),
        (
            "Zastavíš se a necháš ozvěnu utichnout.",
            "Dýcháš pomalu, aby tě komnata neslyšela.",
            "Chvíli stojíš bez hnutí a posloucháš zvony.",
            "I tady se dá na okamžik vydechnout.",
        ),
    ),
    "The Bell Warden's Pit": _loc(
        (
            "Dno jámy je poseté rzí a úlomky zvonů.",
            "Řetězy visí do tmy a občas se pohnou bez větru.",
            "Vzduch je těžký a kovový.",
            "Kdesi pod tebou se ozve dlouhý, hluboký tón.",
        ),
        (
            "Jáma je stejně hluboká a stejně tichá jako minule.",
            "Řetězy se zachvějí, když vstoupíš.",
            "Vracíš se na místo, kde zvony zní i bez zvoníka.",
            "Rez a ticho — jáma se nezměnila.",
        ),
        (
            "Opřeš se o chladnou stěnu a srovnáš dech.",
            "Na chvíli zavřeš oči, ale řetězy neutichnou.",
            "Sedneš si na kámen a hlídáš tmu.",
            "Krátký oddech, než jáma znovu promluví.",
        ),
    ),
}

LOCATION_SECONDARY_EXPLORE: Final[tuple[str, ...]] = (
    "Kamenné chodby tu dýchají jinak než na hlavní cestě — ticho je hlubší a studenější.",
    "Stopy po minulých návštěvnících mizí ve vlhkosti a prachu.",
    "Prostor je úzký, ale něco v něm přetrvává dávno po těch, kdo tudy šli.",
    "Světlo dosáhne jen na pár kroků; zbytek necháváš na paměti nohou.",
)

# --- D. NPC repliky podle vztahu ---

NPC_CALDUS: Final[dict[str, tuple[str, ...]]] = {
    "cautious": (
        "Vítejte ve svatyni, poutníku. Prosím, mluvte tiše.",
        "Málokdo sem dnes zabloudí. Co vás přivádí?",
        "Tohle místo pamatuje víc, než by mělo. Chovejte se k němu s úctou.",
        "Zvon tu chybí. Snad si toho všimnete i vy.",
    ),
    "hopeful": (
        "Byl jste u Niba? Ten zvon k nám patří.",
        "Modlím se, aby se zvon vrátil celý.",
        "Nespěchejte, ale nezapomínejte, oč jsem vás prosil.",
        "Gobliní trh je blízko. Najdete tam odpovědi.",
    ),
    "grateful": (
        "Svatyně zase dýchá. Děkuji vám.",
        "Dokud budu žít, budete tu vítán.",
        "Zvon znovu zní. To je víc, než jsem doufal.",
        "Vrátil jste nám kus naší víry.",
    ),
    "vault": (
        "Pod námi je Komnata ozvěn. A v ní Strážce zvonu. Buďte opatrný.",
        "Cesta ke Komnatě ozvěn vede skrz kryptu — buďte připraven.",
        "Strážce zvonu čeká hlouběji; cestu vám teď mohu naznačit.",
        "Komnata ozvěn skrývá nebezpečí — postupujte tiše a s rozvahou.",
    ),
}

NPC_NIB: Final[dict[str, tuple[str, ...]]] = {
    "indifferent": (
        "Hm? Kupuješ, nebo jen koukáš?",
        "Amulety, střepy, štěstí — no, všechno za férovou cenu, skoro.",
        "Neber to do ruky, pokud to nekoupíš, jo?",
        "Nib má všechno. No, skoro všechno.",
    ),
    "defensive": (
        "Zvon? Jaký zvon? Hehe… žádný zvon tu není.",
        "Kdo ti co napovídal? Nib je poctivý obchodník, no!",
        "Hm, zvony, zvony… těch je na světě hodně, však víš.",
        "Nemluv tak nahlas. Lidi poslouchají.",
    ),
    "wary": (
        "Už máš, cos chtěl. Tak co ještě?",
        "No jo, no jo. Zvon je pryč, Nib je chudší.",
        "Nekoukej tak na mě. Obchod je obchod.",
        "Chceš něco koupit? Tentokrát za peníze, jo?",
    ),
}

NPC_MARA: Final[dict[str, tuple[str, ...]]] = {
    "neutral": (
        "Drž se při zdi. Uprostřed je hluboko.",
        "Něco jde po vodě. Nevím co. Nechci to vědět.",
        "Lucerna vydrží do večera. Ty možná ne.",
        "Nestůj na místě. Voda nosí zvuky daleko.",
    ),
}

CALDUS_RELATIONSHIP_KEY: Final[dict[str, str]] = {
    "Cautious but welcoming to respectful guests.": "cautious",
    "Hopeful the hero will recover the bell.": "hopeful",
    "Grateful; trusts the hero after the bell was returned.": "grateful",
}

NIB_RELATIONSHIP_KEY: Final[dict[str, str]] = {
    "Indifferent merchant until given a reason to talk.": "indifferent",
    "Defensive; avoids the bell topic unless pressed.": "defensive",
    "Wary; knows the hero already confronted him about the bell.": "wary",
}

MARA_RELATIONSHIP_KEY: Final[dict[str, str]] = {
    "Neutral; shares warnings freely, owes no favors.": "neutral",
}

ALL_CS_LITE_PROSE_TEMPLATES: Final[tuple[str, ...]] = tuple(
    tpl
    for group in (
        *BATTLE_CATEGORIES.values(),
        *(t for loc in LOCATION_CS.values() for t in loc.values()),
        LOCATION_SECONDARY_EXPLORE,
        *(t for npc in (NPC_CALDUS, NPC_NIB, NPC_MARA) for t in npc.values()),
    )
    for tpl in group
)