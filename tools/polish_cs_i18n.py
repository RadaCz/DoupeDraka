"""One-shot: apply csDiacritics-style fixes to Czech values in frontend/src/i18n.tsx."""

from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
I18N = ROOT / "frontend" / "src" / "i18n.tsx"

# Phrase and word fixes (longest first). Mirrors csDiacritics + catalog gaps.
FIXES: list[tuple[str, str]] = [
    ("Oteviram tvoje dobrodruzstvi", "Otevírám tvé dobrodružství"),
    ("SEPTAJICI SKLEP", "ŠEPTAJÍCÍ SKLEP"),
    ("Tvuj pribeh zacina v Telegramu", "Tvůj příběh začíná v Telegramu"),
    ("Pro prihlaseni otevri tuto aplikaci v Telegramu.", "Pro přihlášení otevři tuto aplikaci v Telegramu."),
    ("Otevri tuto Mini App ze sveho bota, prihlas se a pokracuj v dobrodruzstvi.", "Otevři tuto Mini App ze svého bota, přihlas se a pokračuj v dobrodružství."),
    ("Knihovnu pravidel se nepodarilo nacist.", "Knihovnu pravidel se nepodařilo načíst."),
    ("Nepodarilo se nacist ulozeny denik", "Nepodařilo se načíst uložený deník"),
    ("Nepodarilo se prihlasit nebo nacist dobrodruzstvi.", "Nepodařilo se přihlásit nebo načíst dobrodružství."),
    ("Postavu se nepodarilo vytvorit.", "Postavu se nepodařilo vytvořit."),
    ("Predpripravenou postavu se nepodarilo vytvorit.", "Předpřipravenou postavu se nepodařilo vytvořit."),
    ("Tah se nepodarilo dokoncit.", "Tah se nepodařilo dokončit."),
    ("Nastaveni kampane se nepodarilo aktualizovat.", "Nastavení kampaně se nepodařilo aktualizovat."),
    ("Nepodarilo se zmenit uroven vypravece.", "Nepodařilo se změnit úroveň vypravěče."),
    ("Stret se nepodarilo vyhodnotit.", "Střet se nepodařilo vyhodnotit."),
    ("Prejit na uvod", "Přejít na úvod"),
    ("PRUVODCE DOBRODRUZSTVIM", "PRŮVODCE DOBRODRUŽSTVÍM"),
    ("Nez zacnes pribeh, vyber nebo vytvor dobrodruha.", "Než začneš příběh, vyber nebo vytvoř dobrodruha."),
    ("Zpet na uvod", "Zpět na úvod"),
    ("Hlavni navigace", "Hlavní navigace"),
    ("DOPORUCENO", "DOPORUČENO"),
    ("Doporucene akce", "Doporučené akce"),
    ("ROZSIR DROUPU", "ROZŠIŘ DRUŽINU"),
    ("Pozvi pratele", "Pozvi přátele"),
    ("Sdilej Doupe Draka s prateli", "Sdílej Doupě Draka s přáteli"),
    ("pozvanky nam pomahaji s playtestem", "pozvánky nám pomáhají s playtestem"),
    ("Sdilet pozvanku", "Sdílet pozvánku"),
    ("Kopirovat odkaz", "Kopírovat odkaz"),
    ("Odkaz pozvanky zkopirovan.", "Odkaz pozvánky zkopírován."),
    ("Sdileni otevreno.", "Sdílení otevřeno."),
    ("Vytvorit dalsiho dobrodruha", "Vytvořit dalšího dobrodruha"),
    ("Dalsi hrdiny, pozvanky a reference najdes v zalozce Vice.", "Další hrdiny, pozvánky a referenci najdeš v záložce Více."),
    ("Vyber hotoveho hrdinu nebo si postav vlastniho — hra zacina na zalozce Hra.", "Vyber hotového hrdinu nebo si postav vlastního — hra začíná na záložce Hra."),
    ("POSLEDNI PRIBEH", "POSLEDNÍ PŘÍBĚH"),
    ("Denik ukolu", "Deník úkolů"),
    ("Pribeh", "Příběh"),
    ("Hrdina zatim nema pripravena kouzla.", "Hrdina zatím nemá připravená kouzla."),
    ("Nahodna rasa a trida — uprav jmeno a hrej.", "Náhodná rasa a třída — uprav jméno a hrej."),
    ("Pruvodce krok za krokem", "Průvodce krok za krokem"),
    ("Novy dobrodruh", "Nový dobrodruh"),
    ("Nalada kampane", "Nálada kampaně"),
    ("Obtiznost, ton a humor", "Obtížnost, tón a humor"),
    ("Co chces udelat?", "Co chceš udělat?"),
    ("Otevrit pravidla kouziel", "Otevřít pravidla kouzel"),
    ("Ukradeny chramovy zvon", "Ukradený chrámový zvon"),
    ("Kratky mec", "Krátký meč"),
    ("Ztraceny chramovy zvon", "Ztracený chrámový zvon"),
    ("chramovy", "chrámový"),
    ("chramoveho", "chrámového"),
    ("dobrodruzstvi", "dobrodružství"),
    ("dobrodruzstvi", "dobrodružství"),
    ("pribeh", "příběh"),
    ("Pribeh", "Příběh"),
    ("tvuj", "tvůj"),
    ("Tvuj", "Tvůj"),
    ("nema", "nemá"),
    ("zatim", "zatím"),
    ("nepodarilo", "nepodařilo"),
    ("podarilo", "podařilo"),
    ("zacina", "začíná"),
    ("zacnes", "začneš"),
    ("otevri", "otevři"),
    ("Otevri", "Otevři"),
    ("prihlaseni", "přihlášení"),
    ("prihlas", "přihlas"),
    ("pokracuj", "pokračuj"),
    ("nacist", "načíst"),
    ("ulozeny", "uložený"),
    ("denik", "deník"),
    ("Denik", "Deník"),
    ("vytvorit", "vytvořit"),
    ("vytvor", "vytvoř"),
    ("dokoncit", "dokončit"),
    ("nastaveni", "nastavení"),
    ("kampane", "kampaně"),
    ("zmenit", "změnit"),
    ("uroven", "úroveň"),
    ("vypravece", "vypravěče"),
    ("stret", "střet"),
    ("uvod", "úvod"),
    ("zalozce", "záložce"),
    ("pratel", "přátel"),
    ("pratele", "přátelé"),
    ("sdilej", "sdílej"),
    ("Sdilej", "Sdílej"),
    ("pozvanky", "pozvánky"),
    ("dalsiho", "dalšího"),
    ("hotoveho", "hotového"),
    ("vlastniho", "vlastního"),
    ("nahodna", "náhodná"),
    ("trida", "třída"),
    ("jmeno", "jméno"),
    ("nalada", "nálada"),
    ("obtiznost", "obtížnost"),
    ("chces", "chceš"),
    ("udelas", "uděláš"),
    ("Kratky mec +1", "Krátký meč +1"),
    ("Kouzlene sloty pohani sesilani", "Kouzelné sloty pohánějí sesílání"),
    ("Jsou oddelene od kreditu vypravce", "Jsou oddělené od kreditů vypravěče"),
    ("ktera plati pouze za herni tahy", "které platí pouze za herní tahy"),
    ("Bezprostredni nebezpeci pominulo. Naber dech, nebo pokracuj.", "Bezprostřední nebezpečí pominulo. Naber dech, nebo pokračuj."),
    ("TVUJ TAH", "TVŮJ TAH"),
    ("TVUJ DOBRODRUH", "TVŮJ DOBRODRUH"),
    ("TRIDA ZBROJE", "TŘÍDA ZBROJE"),
    ("Uroven druziny", "Úroveň družiny"),
    ("HRDINA PRO TVUJ PRIBEH", "HRDINA PRO TVŮJ PŘÍBĚH"),
    ("TVUJ VYCVIK", "TVŮJ VÝCVIK"),
    ("vypnuto, dokud neni k dispozici", "vypnuto, dokud není k dispozici"),
    ("Tahle cesta jeste neni otevrena.", "Tahle cesta ještě není otevřená."),
    ("PRIbeh", "PŘÍBĚH"),
    ("Tvuj", "Tvůj"),
    ("druhiny", "družiny"),
    ("dispozici", "dispozici"),
    ("jeste", "ještě"),
    ("neni", "není"),
    ("otevrena", "otevřená"),
    ("VYCVIK", "VÝCVIK"),
]


def polish_value(value: str) -> str:
    out = value
    fixes = sorted(FIXES, key=lambda x: len(x[0]), reverse=True)
    for old, new in fixes:
        out = out.replace(old, new)
    return out


def main() -> None:
    text = I18N.read_text(encoding="utf-8")
    start = text.index("const cs: Record<string, string> = {")
    end = text.index("\n};", start)
    head, block, tail = text[:start], text[start:end], text[end:]
    line_re = re.compile(r"^(\s*'(?:[^'\\]|\\.)*':\s*)'((?:[^'\\]|\\.)*)'(,?\s*)$", re.M)

    def repl(match: re.Match[str]) -> str:
        prefix, value, suffix = match.group(1), match.group(2), match.group(3)
        polished = polish_value(value.replace("\\'", "'"))
        safe = polished.replace("'", "\\'")
        return f"{prefix}'{safe}'{suffix}"

    new_block = line_re.sub(repl, block)
    I18N.write_text(head + new_block + tail, encoding="utf-8")
    print("Polished cs catalog values in", I18N)


if __name__ == "__main__":
    main()
