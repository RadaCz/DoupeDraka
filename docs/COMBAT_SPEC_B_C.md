# Specifikace boje – Fáze B (mechanika) a C (UX)
Autor: DoupěDraka Designer · 27. 11. 2026 · vychází z `docs/COMBAT_COMPLETE_AUDIT.md` (main `227811b`) a ze zadání `COMBAT_OVERHAUL_ZADANI.md`.

Značky: **[ENGINE UMÍ]** = ověřeno auditem na HEAD, jen zachovat/otestovat. **[OPRAVA]** = chyba proti existujícímu pravidlu. **[SRD CHYBÍ]** = pravidlo SRD 5.1, které engine nemá – implementace až po schválení Rady. **[ROZHODNUTÍ RADY]** = herní volba mimo SRD. **[DEFERRED]** = mimo první sólo kampaň.

Rozsah: sólo, 1 nepřítel, třídy Bojovník/Tulák/Klerik/Čaroděj, úrovně 1–5. Engine počítá ve stopách (ft); cs UI zobrazuje metry (převod jen v UI, `formatWizardSpeedFt`: 5 ft = 1,5 m, 30 ft = 9 m, 60 ft = 18 m, 120 ft = 36 m).

---

## Fáze B – mechanika

### B1. Tah a ekonomika akcí
- [ENGINE UMÍ] Akce / bonusová akce / reakce přes `combat_flags`; reset na začátku tahu hráče (`reset_player_turn_economy`). Pohyb nespotřebuje akci. Útok mimo dosah a bez munice akci nespotřebuje.
- [ENGINE UMÍ] Odmítnutí před spotřebou: útok mimo dosah, bez munice, mimo tah, paralyzovaný, pohyb nad rozpočet, kouzlo bez slotu.
- **Pravidlo, které platí pro všechny akce:** akce se spotřebuje, jen když engine akci *provede* (včetně hodu, který selže). Když ji odmítne *před* hodem (tah, dosah, munice, slot, třída), nespotřebuje se nic a `state_changed=false`.
- [OPRAVA, P1] Odmítnutá akce (`state_changed=false`) nesmí zapsat journal event ani zvýšit `turn_count` (audit N5). Hráč vidí jen důvod odmítnutí.
- [P2] API posílá `combat_tactics.economy` = `economy_snapshot()`; frontend přestane odvozovat ekonomiku sám (N7).

### B2. Pohyb a vzdálenost
- [ENGINE UMÍ] `combat_distance_ft`, `combat_movement_remaining_ft`, přiblížení/ustoupení, kumulace pohybu, min. vzdálenost 5 ft (dosah na blízko).
- UI nabízí: „Přiblížit se“ (= min(zbývající pohyb, vzdálenost − 5 ft), tj. jedním klepnutím na dosah, pokud to jde) a „Ustoupit o 4,5 m“ (15 ft, jako dnes). Žádná libovolná čísla v UI.
- [SRD CHYBÍ, P0 → schválení] **Sprint (Dash) jako akce pro všechny:** spotřebuje akci, přidá k `combat_movement_remaining_ft` hodnotu `speed`. Tulák od 2. úrovně dál může totéž bonusovou akcí (Cunning Action, [ENGINE UMÍ]). Text „dash“ u netuláka už nevede na „requires rogue level 2“, ale na Sprint jako akci.
- Testy: Bojovník (30 ft) vs kobold 60 ft: přiblížit 30 → 30 ft, Sprint +30, přiblížit 25 → 5 ft, útok už jen pokud zbyla akce (nezbyla) → tah končí na dosah. Tulák: Sprint bonusem + pohyb 60 ft + útok akcí ve stejném tahu.

### B3. Útoky a dosah
- [ENGINE UMÍ] Melee 5 ft, ranged normal/long (long = nevýhoda), munice, `combat_tactics.weapon_range.can_attack` + `denial`.
- Ověřit testem (bez změny pravidel, pokud funguje): ranged útok s nepřítelem do 5 ft = nevýhoda (SRD). Když engine neumí → [SRD CHYBÍ, P1].
- [DEFERRED] Vrhání jako samostatné tlačítko, změna zbraně v boji tlačítkem (zůstává přes text).

### B4. Obrana, zbroj, štíty
- [ENGINE UMÍ] OČ z vybavení (`equipment.py`). UI ukazuje jen OČ z enginu (`armor_class`), nic nepočítá. Žádné nové statistiky.
- [ENGINE UMÍ] „Obrana“ (Defend/Dodge): spotřebuje akci, nevýhoda na **další** útok nepřítele (`service.py:2510–2535`). SRD Dodge platí na všechny útoky do dalšího tahu; v sólu s jedním útokem za kolo je rozdíl malý → ponechat, text tlačítka: „Obrana: další útok na tebe má nevýhodu.“

### B5. Kouzla
- [ENGINE UMÍ] Sloty, třída, tah, ekonomika (bonus/reakce), koncentrace u Bless/Shield of Faith/Invisibility.
- [OPRAVA, P0] **Dosah kouzla v boji** (N2). Zdroj dosahu: `srd_spells.json.range`. Pravidla:
  | Kouzlo | Dosah | Kontrola |
  |---|---|---|
  | Ohnivá střela (Fire Bolt) | 120 ft | vzdálenost ≤ 120 |
  | Magická střela | 120 ft | ≤ 120 |
  | Žhnoucí paprsek (Scorching Ray) | 120 ft | ≤ 120 |
  | Posvátný plamen | 60 ft | ≤ 60 |
  | Hořící ruce | Self (15ft kužel) | vzdálenost ≤ 15 |
  | Léčení ran, Mágova zbroj, Neviditelnost | Touch | cíl je hráč → vždy OK |
  | Léčivé slovo, Štít víry, Požehnání | 60/60/30 ft | cíl je hráč → vždy OK |
  | Magický štít, Mlžný krok | Self | vždy OK |
  Mimo dosah: odmítnout **před** spotřebou slotu i akce, důvod „{kouzlo} má dosah {m}. Nepřítel je {m} daleko.“
- API: `combat_tactics.spells[]` = `{name, range_ft|null, can_cast: bool, denial: string|null}` pro připravená kouzla s modelem. UI z toho bere dostupnost; nic nepočítá samo.
- Ranged spell attack do 5 ft = nevýhoda (jako B3) – ověřit.

### B6. Schopnosti tříd (L1–5, jen implementované)
| Třída | Schopnost | Cena | Stav |
|---|---|---|---|
| Bojovník | Druhý dech | bonus, 1× za odpočinek | [ENGINE UMÍ] |
| Bojovník | Action Surge (L2) | volná, 1× za odpočinek, +1 akce | [ENGINE UMÍ] (`use_action_surge`) |
| Bojovník | Extra útok (L5) | součást akce Útok | [DEFERRED] – v enginu jsem ho nenašel; 1. kapitola má strop 3. úrovně |
| Tulák | Zákeřný útok | 1× za tah, s výhodou | [ENGINE UMÍ] (výhoda ze skrytí) |
| Tulák | Cunning Action (L2): Sprint, Odpoutat se, Schovat se | bonus | [ENGINE UMÍ] |
| Klerik | Channel Divinity: Turn Undead / Preserve Life | akce | [ENGINE UMÍ]; Preserve Life v decku jen když je hráč zraněný (N6) |
| Čaroděj | Arcane Recovery | mimo boj | [ENGINE UMÍ], v boji se nenabízí |
Každá schopnost v decku: název, cena, zbývající použití, důvod nedostupnosti. Bez implementace = žádné tlačítko.

### B7. Reakce
- [ENGINE UMÍ] Okno Magického štítu, „Odmítnout reakci“ bez spotřeby, příležitostný útok.
- Pravidla UI: během čekající reakce jsou ostatní akce neaktivní s důvodem „Nejdřív rozhodni o reakci.“ Po refreshi se okno obnoví z `combat_reaction_pending`. Opuštění obrazovky ≠ automatické odmítnutí; žádný timeout v sólu.
- Ověřit všechny větve selhání Shield (audit: NOT VERIFIED).

### B8. Útěk
- [ENGINE UMÍ] Útěk = akce, Obratnost DC 10; úspěch ukončí boj.
- **[ROZHODNUTÍ RADY]** Audit to vede jako P0 (N3), ale podle pravidel neúspěšný pokus akci spotřebuje (stejně jako jiný hod). Navrhuji **ponechat**: neúspěšný útěk akci spotřebuje; odmítnutí před hodem (mimo tah, akce už použita) ne. P0 z toho zůstane jen jako test, že odmítnutí před hodem nic nespotřebuje, a jako jasný text v UI („Útěk: akce, hod Obratnosti proti 10“).

### B9. Nepřátelé
- [ENGINE UMÍ] Kobold 60 ft s ranged útokem, melee nepřátelé se přibližují, jeden nepřítel.
- Požadavek: nepřítel nikdy „nic nedělá“ bez vysvětlení – každý jeho tah má beat (pohyb / útok / „nemá dosah, přibližuje se“).
- [DEFERRED] Více nepřátel.

---

## Fáze C – Combat UX (mobil, Telegram Mini App)

### C1. Informační hierarchie (shora dolů, bez scrollu na 320×568 pro body 1–5)
1. **Lišta tahu:** „Tvůj tah · kolo 2“ / „Tah: Kobold“ + ikonky Akce · Bonus · Reakce (plná = k dispozici, prázdná = použitá).
2. **Nepřítel:** jméno (max 2 řádky, pak výpustka), pruh ŽP s čísly, OČ.
3. **Bojiště:** vzdálenost v m, zbývající pohyb v m, značka dosahu zbraně.
4. **Hrdina:** ŽP, OČ, sloty (jen pokud je sesílatel).
5. **Taktická nápověda** (C3) – 1–2 věty.
6. **Akce** (C2) – dolní pevný panel, dosažitelný palcem.
7. **Poslední událost** (C4) – jeden řádek; rozbalit = mechanika. Historie sbalená.

### C2. Kategorie akcí
Záložky / skupiny: **Útok · Pohyb · Kouzla a schopnosti · Předměty · Taktika** (Obrana, Odpoutat se, Útěk, Konec tahu).
Každé tlačítko: název, typ ceny (Akce / Bonus / Reakce / Pohyb), dosah v m (kde dává smysl), stav. Nedostupná akce se **nezobrazí**, pokud ji hráč v tomto souboji nikdy nemůže použít (třída, nemá kouzlo); zobrazí se **neaktivní s jedním řádkem důvodu**, když jde jen o aktuální stav (dosah, použitá akce, žádný slot). Důvod vždy z enginu (`denial`), ne z frontendu.

### C3. Taktická nápověda (deterministická, ne LLM)
Generuje frontend z `combat_tactics` + `economy`; žádná čísla mimo payload. Pořadí pravidel (první, které platí):
1. Nepřítel na tahu → „Na tahu je {nepřítel}.“
2. Čeká reakce → „{Nepřítel} útočí. Můžeš použít {reakce}, nebo ji nechat být.“
3. `can_attack` a akce volná → „{Zbraň} dosáhne. Můžeš zaútočit.“
4. Melee mimo dosah, pohyb stačí → „{Nepřítel} je {d} m daleko. Přibliž se o {d−1,5} m a pak zaútoč.“
5. Melee mimo dosah, pohyb nestačí, akce volná → „{Nepřítel} je {d} m daleko, zbývá ti {p} m pohybu. Na dosah se dostaneš jen se Sprintem (akce).“ + pokud existuje kouzlo s `can_cast` → „Nebo použij {kouzlo} (dosah {r} m).“
6. Mimo dosah, akce použitá → „Na dosah se v tomto tahu nedostaneš. Přibliž se a ukonči tah.“
7. Ranged na dlouhý dostřel → „Útok na tuto vzdálenost má nevýhodu.“ (doplněk k 3)
8. Nic nezbývá → „V tomto tahu už nic dalšího neuděláš. Ukonči tah.“
Testy: Vitest tabulkou payload → přesný text (cs i en), min. pro pravidla 1–8.

### C4. Poslední událost
Řádek: „{Kdo} {čím}: {hod} proti OČ {x} – zásah, {n} zranění (ŽP {a} → {b}).“ Rozbalení = hody a modifikátory z `resolution.beats`. Narace vypravěče zvlášť pod tím, nikdy nemění čísla.

### C5. Vizuál a ergonomie
- Dolní panel akcí max. 2 řady tlačítek ≥ 44 px, safe-area bottom. Žádné vysoké karty; nápověda a událost max. 2 řádky.
- Stavy: loading (tlačítka zamčená, spinner na odeslaném), error (důvod + Zkusit znovu, stejný Idempotency-Key), disabled (důvod), success (krátký záblesk změny ŽP).
- cs boj v metrech (N8): `CombatUI`, `CombatBattlefieldTrack`, texty pohybu. Příkaz do enginu zůstává ve ft.
- Opravit text N4 („Dash … nejsou v enginu“).
- Screenshoty: 320, 360, 375, 390, 430 px; stav kobold 60 ft na začátku, po přiblížení, čekající reakce, poslední událost rozbalená, dlouhé jméno nepřítele.

---

## Souhrn pro Radu (ke schválení před implementací)
1. **Sprint (Dash) jako akce pro všechny** – pravidlo SRD 5.1, engine ho má jen pro tuláka bonusovou akcí. Dopad: Bojovník/Klerik/Čaroděj se v jednom tahu dostanou z 18 m na dosah.
2. **Dosah kouzel v boji** – SRD 5.1, dnes se nekontroluje. Dopad: Posvátný plamen na 18 m neprojde z 36 m; Hořící ruce jen do 4,5 m.
3. **Útěk** – herní pravidlo (ne SRD): akce, Obratnost DC 10. Navrhuji ponechat, že neúspěšný pokus akci spotřebuje.
4. Ověřit a případně doplnit SRD: ranged útok/kouzlo do 1,5 m má nevýhodu.
Vše ostatní je oprava podle existujících pravidel nebo UX.

## Pořadí PR (návrh)
P0: (a) dosah kouzel + `combat_tactics.spells[]`; (b) Sprint jako akce (po schválení); (c) test „odmítnutí před hodem nic nespotřebuje“ pro všechny akce v D2.
P1: (d) N5 journal/turn_count při odmítnutí; (e) taktická nápověda C3 + N4 text; (f) kategorie akcí C2 + Preserve Life N6; (g) ranged do 5 ft nevýhoda (pokud chybí).
P2: (h) metry v boji; (i) `economy` v API + TS `combat_round`; (j) vizuál C1/C4/C5 se screenshoty.
