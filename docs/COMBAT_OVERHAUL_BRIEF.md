# DoupěDraka — COMPLETE COMBAT OVERHAUL (zadání od Rady, 27. 11. 2026)
Projekt: RadaCz/DoupeDraka. Priorita P0. Režim: Audit → specifikace → implementace → testování → nezávislý audit → finální report.

## 1. Cíl
Ne jen vizuální redesign Combat V2. Prověřit a dotáhnout celý boj jako jeden konzistentní systém: engine, pravidla a ekonomika akcí, pohyb a vzdálenost, útoky na blízko/dálku, zbraně/zbroje/štíty/vybavení, kouzla a dosah, bonusové akce, reakce, schopnosti tříd, chování nepřátel, inventář a použitelné předměty, smrt/vítězství/útěk/konec souboje, Combat API a ukládání stavu, frontend a mobilní UX, Telegram Mini App ovládání, lokalizace CZ/EN, testy a regresní ochrana. Combat má působit jako skutečné fantasy RPG, ne chatbot s tlačítky.

## 2. Nepřekročitelné invarianty
Před změnou zjisti aktuální stav GitHubu, branch, HEAD, working tree a CI; nespoléhej na staré reporty.
1. Zachovej architekturu, pokud není prokázán důvod ke změně. 2. Nepřepisuj funkční engine kvůli UI. 3. Zachovej API kontrakty, pokud změna není nutná. 4. Zachovej D20/D6 pravidla a férovost hodů. 5. Placený účet nesmí dávat výhodu v hodu, DC, poškození, lootu ani bojové síle. 6. Adventure Mana a kredity vypravěče jsou dvě odlišné věci. 7. Žádné falešné akce, tlačítka, schopnosti. 8. Žádné automatické utrácení akce/bonusové akce/reakce bez pravidla. 9. Žádné duplicitní provedení akce při retry. 10. Žádná ztráta stavu po refreshi, přihlášení, znovunačtení Mini App. 11. Žádné skryté změny výsledků hodů kvůli vypravěči nebo obtížnosti. 12. Žádné neověřené tvrzení „hotovo“.
Kompatibilita se současným konceptem a datovými modely. Nová mechanika: nejdřív specifikovat (dopad na pravidla a testy), oddělit od existujících, neimplementovat neodsouhlasená pravidla jako hotovou věc.

## 3. Fáze A — kompletní audit → docs/COMBAT_COMPLETE_AUDIT.md
Backend: app/engine/, combat service a intent routing, movement/positioning, range, action economy, class features, monster templates a enemy AI, spell resolution, equipment a item instances, reactions, character state a persistence, API endpointy a payloady, idempotency a retry.
Frontend: frontend/src/combat/, CombatScreen, CombatUI, CombatActionDeck, CombatBattlefieldTrack, CombatHeroStrip, TurnDeltaStrip, CombatMoment, CombatChronicleFold, combatActions, combatRange, styly, Telegram MainButton, klávesnice, safe areas.
Testy a docs: pytest unit/integration, Vitest, Playwright E2E, screenshot testy, combat acceptance docs, gameplay contracts, sprint reporty a odložené mechaniky.
Pro každou oblast: co existuje; co funguje end-to-end; co je jen UI prezentace; co je jen návrh; nedokončené; chybné; překryvy/duplicity; co chybí pro kompletní zážitek; jaké testy existují a co skutečně ověřují.

## 4. Fáze B — mechanika
4.1 Tah a ekonomika akcí: hráč vždy ví, kdo je na tahu, co může udělat, kolik pohybu zbývá, zda má Action, Bonus Action, čekající Reaction, které schopnosti jsou použitelné a proč něco není dostupné. Pohyb nesmí spotřebovat Action. Neúspěšný útok kvůli dosahu nesmí spotřebovat Action. Ověř začátek/konec tahu, reset pohybu a akcí, bonusové akce tříd, Action Surge, čekající reakce, ukončení tahu, stav po přerušení, idempotenci.
4.2 Pohyb a vzdálenost: přiblížit se, ustoupit, využít zbývající pohyb, vidět spotřebu a výslednou vzdálenost, zda se dostane na dosah. Prověř univerzální Dash podle skutečných pravidel (nepředpokládat ho kvůli Rogue Cunning Action). Rychlost, bonusový pohyb, opakované pohyby, min/max vzdálenost, zaokrouhlování, reset. Soulad server/UI.
4.3 Útoky a dosah: melee, ranged, thrown, normální/dlouhý dostřel, disadvantage, melee na vzdálený cíl, nedostatek munice, zbraně bez munice, změna zbraně, útok po pohybu, neplatné cíle, poškození, kritické zásahy, obrana. UI vysvětlí, proč útok nejde; neplatnou akci nenabízet jako dostupnou.
4.4 Obrana, zbroj, štíty: AC a vliv vybavení; zobrazené AC = skutečný výpočet; co je propojené a co se jen zobrazuje. Žádné nové statistiky bez pravidel a persistence.
4.5 Kouzla: dosah, cíle, sloty, poškození, záchranné hody, DC, koncentrace (pokud je), reakce, smrt cíle, nedostatek slotů, nedostupné cíle, chyby. Nepředstírat dostupnost.
4.6 Schopnosti tříd (Fighter, Rogue, Cleric, Wizard) podle aktuální implementace: podmínka, cena akce, účinek, persistence, viditelná dostupnost/cooldown, test úspěchu i neúspěchu. Nedokončené označit, žádná falešná tlačítka.
4.7 Reakce: vznik okna, zobrazení, potvrzení/odmítnutí, timeout/opuštění, refresh, blokace jiných akcí během čekání, spotřeba, správné ukončení. Žádná reakce nesmí hráče trvale zablokovat.
4.8 Nepřátelé a AI: melee/ranged/hybridní, pohyb, výběr cíle a útoku, dosah, spotřeba akcí, reakce na vzdálenost, smrt, více nepřátel (pokud engine umí). Žádné nemožné útoky ani nevysvětlená nečinnost. Zvlášť kobold na počátečních 60 ft.

## 5. Fáze C — Combat UX (mobil, Telegram Mini App)
5.1 Hierarchie: 1. stav souboje a tah, 2. nepřítel a HP, 3. vzdálenost a bojiště, 4. stav postavy, 5. dostupné akce, 6. poslední událost, 7. detaily a historie rozbalitelně. Hlavní ovládání bez zbytečného scrollu; ne jen zmenšit CSS.
5.2 Kategorie: Útok, Pohyb, Schopnosti a kouzla, Předměty, Obrana/taktické akce (jen implementované). Jen dostupné akce. Každá akce: název, stručný popis, typ akce, náklady, dosah, dostupnost, důvod nedostupnosti.
5.3 Taktická nápověda normálním jazykem ze skutečného stavu enginu, např. „Kobold je 60 ft daleko. Mace má dosah 5 ft. Zbývá ti 25 ft pohybu. Můžeš se přiblížit, ale v tomto tahu se nedostaneš na dosah útoku.“ Nabídni jinou dostupnou akci; když žádná není, vysvětli proč. Nesmí si vymýšlet.
5.4 Vizuál: zachovat fantasy atmosféru; odstranit vysoké bloky, duplicity, prázdná místa, dlouhé systémové zprávy, nepřehledné prvky, velké karty, zbytečný scroll. Typografie, kontrast, rozumná tlačítka, jednoruční ovládání, safe areas, responzivita, klávesnice, přístupnost, stavy loading/error/disabled/success. Ne administrativní dashboard.
5.5 Poslední událost: kdo, jakým útokem, výsledek hodu, poškození, změna HP, nový stav tahu. Mechanika rozbalitelně, příběh přirozeně.

## 6. Fáze D — API, stav, odolnost
Ověření hráče, autorizace postavy, validace před změnou stavu, idempotency, souběžné požadavky, atomické ukládání, žádné dvojité poškození/odečtení předmětů/utracení zdrojů, žádné ztracené tahy, správné streamování, bezpečný fallback vypravěče, obnova po reconnectu. Testovat přerušení spojení, opakované odeslání, refresh, návrat do souboje. Engine rozhoduje, vypravěč jen popisuje.

## 7. Fáze E — scénáře (ověřit proti skutečnému stavu hry)
1 Warrior vs melee; 2 Warrior vs ranged kobold na 60 ft; 3 Rogue Cunning Action; 4 Cleric bojové kouzlo; 5 Wizard kouzlo na dálku; 6 útok mimo dosah; 7 pohyb + útok; 8 opakovaný pohyb v tahu; 9 Dash a vyčerpání pohybu; 10 nedostatek munice; 11 nedostatek slotů; 12 lektvar; 13 čekající reakce; 14 odmítnutí reakce; 15 nepřítel na tahu; 16 smrt hráče; 17 smrt nepřítele; 18 vítězství; 19 útěk; 20 obnova po refreshi; 21 přerušení spojení při odeslání; 22 dvojité odeslání; 23 malý displej; 24 dlouhý název nepřítele a delší narace.

## 8. Fáze F — testy (risk-based)
P0: kostky a poškození, HP a smrt, akční ekonomika, pohyb a dosah, persistence, API validace, idempotency, reakce, kritické cesty. P1: 4 třídy, schopnosti, kouzla, inventář/předměty, enemy AI, vítězství a útěk. P2: vizuál, animace, přechody, polish.
Zaměřené pytest unit, nutné integrační, Vitest, málo kvalitních Playwright E2E, mobilní screenshoty. Žádné desítky duplicitních testů. Kompletní gate + GitHub Actions. Baseline před implementací; pre-existing failures označit.

## 9. Fáze G — mobilní QA
320, 360, 375, 390, 430 px; portrait, scroll, jednoruční ovládání, dolní ovládání, safe areas, klávesnice, přechody, loading, error, reconnect, delší texty CZ i EN. Skutečně prohlédnout screenshoty; hlavní akce pohodlně dosažitelné.

## 10. Fáze H — implementace
1 seznam problémů; 2 P0/P1/P2; 3 cílová architektura Combat; 4 vlastníci částí; 5 konfliktní soubory; 6 implementace po logických částech; 7 testy po každé části; 8 docs; 9 nezávislá kontrola. Žádný zbytečný rewrite, nemazat funkční mechaniky, nesnižovat pokrytí, neskrývat chyby, žádný broad exception handling místo validace. Problémy mimo Combat opravit jen v nezbytném rozsahu a zdokumentovat.

## 11. Definition of Done
Hráč rozumí tahu; akce odpovídají pravidlům; pohyb funguje a je správně prezentovaný; dosahy fungují; kouzla fungují; třídy mají správné schopnosti; reakce neblokují; nepřátelé jednají konzistentně; HP, AC a zdroje odpovídají enginu; předměty fungují; smrt, vítězství, útěk správně; stav přežije refresh a reconnect; žádné duplicity při opakování; UI srozumitelné na mobilu; žádné falešné ovládací prvky; žádné duplicitní/protichůdné informace; CZ i EN správně; testy procházejí; GitHub Actions zelené.

## 12. Závěrečný report → docs/COMBAT_COMPLETE_ACCEPTANCE.md
1 výchozí branch a HEAD; 2 změněné soubory; 3 popis implementace; 4 opravené chyby; 5 nové/upravené mechaniky; 6 testy před a po; 7 GitHub Actions; 8 mobilní screenshot QA; 9 známé problémy; 10 odložené funkce; 11 technický dluh; 12 verdikt. Štítky: FIXED (opraveno a ověřeno), VERIFIED (fungovalo, ověřeno), DEFERRED, BLOCKED, NOT VERIFIED. FIXED nikdy jen na základě buildu.

## 13. Git
Správná větev; nezahazovat cizí změny; žádný reset ani force push; žádný automatický release; žádný deploy bez výslovného schválení; na konci přesný seznam souborů a commitů; commit/push integrace až po schválení.

Cíl: boj mechanicky správný, taktický, přirozený, čitelný a příjemný na mobilu — ne jen systém, který projde testem.