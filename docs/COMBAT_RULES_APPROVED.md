# Schválená bojová pravidla — Rada, 27. 11. 2026 12:45 (závazná specifikace)

## 1. Sprint / Dash — APPROVED
- Univerzální Action pro všechny třídy.
- Přidá pohyb odpovídající rychlosti postavy.
- Rogue si zachovává Cunning Action: Dash za Bonus Action.
- Správně počítat již využitý pohyb. Žádné dvojité přičítání.

## 2. Dosah kouzel — APPROVED
- Sacred Flame: 60 ft. Fire Bolt: 120 ft.
- Burning Hands: Self (15-foot cone), nikoliv obyčejný dosah cíle.
- Správný dosah musí mít všechna bojová kouzla.
- Neplatný dosah nesmí spotřebovat Action ani spell slot.
- Validace serverově před změnou herního stavu.
- Interně ft., lokalizace může zobrazovat metry.

## 3. Útěk — APPROVED
- Action. d20 + Dexterity modifier proti DC 10.
- Úspěch: opuštění souboje. Neúspěch: Action je spotřebována.
- Zrušení před hodem: žádný hod ani spotřeba Action.
- Neúspěšný pokus automaticky neukončuje celý tah.
- Zajistit idempotenci.

## 4. Ranged disadvantage — APPROVED WITH CLARIFICATION
- Nevýhoda na ranged weapon attacks a ranged spell attacks.
- Pouze pokud je do 5 ft. nepřátelská bytost, která útočníka vidí a není incapacitated.
- Nevztahuje se automaticky na všechna kouzla. Sacred Flame a Burning Hands ji nemají (nepoužívají ranged spell attack roll).
- Nevýhoda se nevrství při více sousedních nepřátelích.

## Implementation rules
- Schválená specifikace. Před implementací zkontrolovat soulad se současným enginem; neduplikovat existující funkčnost.
- Zachovat API kontrakty a idempotenci.
- Cílené unit, integrační a E2E testy.
- Nezávislé opravy mohou běžet paralelně.
- Žádné další neodsouhlasené bojové mechaniky.
- Po dokončení důkazy z testů a seznam změněných souborů.