# Sprint 14 — Gameplay Fun Audit & Experience Design V1

**Datum:** 2026-11-10  
**Baseline:** `dc08808` · větev `clean-main` · sync s `origin/clean-main`  
**Typ sprintu:** audit + design pouze — **žádné změny kódu, commit, push, deploy**  
**Metoda:** čtení engine/frontendu, existující testy/docs, deterministická simulace `tools/progression_scenarios.py`  
**Human playtest:** **NOT TESTED** (žádná session 45–90 min na zařízení v tomto sprintu)

---

## 1. Shrnutí skutečné kvality hry

### Co funguje (důkaz v kódu)

| Oblast | Hodnocení | Důkaz |
|--------|-----------|--------|
| **Hlavní quest „The Stolen Bell“** | Funkční, deterministický | `quests.resolve_main_quest_step` + intent regexy (`intent.py`); E2E `chapter-one-quest.spec.ts` projde UI cestu až po `vault_unlocked` |
| **Engine autorita** | Silná | Všechny flagy/HP/XP/loot v `GameEngine.resolve_action` |
| **Orientace v UI (Sprint 11–13)** | Lepší než dřív | Quest strip, travel/NPC/boss chipy (`gameActions.ts`), mapové zámky (`chapterOneMap.ts`) |
| **Lite hratelnost** | Plná | Offline narration; quest nevyžaduje placený LLM |
| **Boss jako milestone** | Technicky uzavírá kapitolu | `chapter_one_complete` + 180 XP + 25 gp (`service._chapter_one_boss_rewards`) |

### Co brání „zábavnému RPG“ (ne počet funkcí)

1. **Rozdělený pacing:** příběh zvonu jde rychle (~15–25 engine tahů), ale **boss vyžaduje zásadní XP mimo příběh** — simulace 13–90× `search` po vrácení zvonu (`progression_scenarios.py`). E2E to maskuje `ensureLevelAtLeast(..., 5, 120)`.
2. **Jádro smyčky = opakovaný `search`** — d6: jen 1/6 boj, 1/6 zlato, 2× jednorázové stopy/clue, zbytek flavor; `exploration_cooldown` po boji/dechu prodlužuje tahy.
3. **Talk ≠ quest:** `resolve_npc_talk` dává jen flavor; postup vyžaduje **regex QUEST** (chipy pomáhají, volný text snadno mine).
4. **Lokace mimo hlavní osu** (Bandit Camp, Underground River) mají pool a discovery, ale **žádný quest beat** — návštěva je volitelný grind bez příběhového payoffe.
5. **Třídy nejsou stejně „zábavné“ na L1:** Ranger nemá připravená kouzla (half-caster, 0 slotů L1); Fighter je implicitní default E2E; Wizard křehký bez grindu HP.
6. **Boj:** initiative + útok + nepřítel vždy útočí (`_enemy_turn`); defend = 1× disadvantage na další hit; **žádné schopnosti monsterů**, rozdíl jen staty v `encounters.py`.
7. **Ekonomika odměn vs. shop:** vrácení zvonu 10 gp, crypt 15 gp — léčivý lektvar 45 gp (`shop.py`); bez grindu explore gold **nekoupíš potion** před bossem.
8. **Crypt +10 XP nevolá `level_up`** (`quests.try_side_quest_explore`) — drobná nekonzistence oproti quest XP.

**Celkový verdikt:** Kapitola 1 je **dokončitelný technický MVP** s jasnou quest linkou, ale **zážitek „chci ještě jeden tah“** padá na **povinném explore grindu** mezi vault unlock a přežitelným bossem a na **slabé unikátní obsahy** po jednorázových discovery.

---

## 2. Mapa prvních 20 minut hráče

*Odhad: 30–90 s/tah (UI + Lite narration). **Ne playtest** — odvozeno z počtu tahů a design doc `CHAPTER_ONE_PLAYTEST_V1.md` (první session 45–90 min).*

| # | Krok | Co hráč vidí | Skutečné akce (engine) | Následky | XP / gold | Riziko nudy/frustrace |
|---|------|----------------|------------------------|----------|-----------|------------------------|
| 1 | Vstup / postava | Home, Cellar, quest strip „stolen bell“ (bez pinu) | — | — | 0 | Neví kam jít bez nápovědy → chip „Travel“ do chodby (Sprint 11.1) |
| 2 | Cesta ke Caldusovi | Mapa, travel chip | `travel to` × 2 (Cellar→Corridor→Shrine) | Lokace, arrival beat | 0 | Dva travel tahy bez události |
| 3 | Přijetí úkolu | NPC chip Caldus | QUEST `accept_caldus` | `bell_quest_accepted` | 0 | **Talk bez patternu quest neposune** |
| 4 | Goblin Market | Travel chip | travel × 1–2 | Market, Nib arrival | 0 | — |
| 5 | Nib | Chip ask Nib | QUEST `ask_nib` | bell do inventáře, flags | 0 | Bez accept = odmítnutí |
| 6 | Návrat + vrácení | Return chip | travel + QUEST `return_bell` | complete, **30 XP**, 10 gp | 30 XP | Level-up možný (100 threshold) |
| 7 | Vault reveal | Caldus chip (vault/bell) | QUEST `accept_caldus` (2. fáze) | `vault_unlocked` | 0 | Hráč musí **znovu mluvit**, ne jen „thanks“ |
| 8 | Příprava na bosse | Vault/Pit na mapě; boss chip až v jámě | — | — | 0 | **Typicky zde končí 20. minuta** |
| 9+ | Grind + boss | Block message pokud L&lt;3 | 13–90× `search` + boje (sim) | Level 3–5 | bojové XP | **Hlavní frustrace / nuda** |

**Real choice vs. tlačítko:** Travel/Return/Ask/Accept jsou **skutečné engine QUEST/TRAVEL** tahy měnící stav. Chip „Explore“ = `search` s RNG — **volba taktiky minimální** (stejná akce). Shop vyžaduje psát `buy healing potion` — **málo discoverable**.

---

## 3. Místa nudy a opakování

| Místo | Mechanismus | Proč to nudí |
|-------|-------------|--------------|
| Post-vault grind | `search` smyčka + cooldown | Jediný spolehlivý XP zdroj; příběh neříká „ještě 40× prohledej sklep“ |
| Prázdný explore | d6 &gt; 4 | ~⅔ tahů bez mechanické změny (jen flavor) |
| Opakovaná návštěva lokace | track/clue/gold jednorázové | Po vyčerpání flagů jen boj nebo „nic nového“ |
| Combat loop | attack → enemy attack | Žádné monster schopnosti, málo důvodů pro defend/flee/spells u tier-1 |
| NPC small talk | `npc_interactions` | Stejné věty po flagu; Nib/Caldus neprodávají nový obsah kromě quest resolveru |
| Long rest gate | jen 3 „safe“ lokace | Správné, ale hráč bez heal potion spoléhá na short rest 1d6 nebo grind level HP |

---

## 4. XP / progression simulace

**Pravidla (engine):** 100 XP / level, max L5 (`XP_THRESHOLD`, `MAX_MVP_LEVEL`).  

**Zdroje XP (kapitola 1):**

| Zdroj | XP | Poznámka |
|-------|-----|----------|
| Vrácení zvonu | 30 | + `level_up` |
| Crypt (1×) | 10 | **bez** auto level-up |
| Kill (tier 1) | 35–60 | škálované difficulty |
| Bell Warden | 180 | + chapter flag |

**Simulace** (`python tools/progression_scenarios.py`, HEAD `dc08808`, fighter, Cellar grind):

| Scénář | Cíl | Explores | Wins | Poznámka |
|--------|-----|----------|------|----------|
| Seed 0 + crypt | L3 po bell 30 | 12 | 3 | Příznivý |
| Seed 42 | L3 | 13 | 4 | Typický |
| Seed 99 | L3 | 45 | 5 | Nepříznivý |
| Post-bell → L5 seed 99 | L5 | **90** | 11 | Harsh grind |

**Povinný vs. dobrovolný:** Povinný příběh dá **max ~40 XP** (30+10 crypt) před bossem — **nedostačuje na L3** (potřeba 200 kumulativně od 0, tj. ~170 z bojů). Boss **tier gate L3** je nutný; **L4–5 komfort** je dobrovolný, ale prakticky očekávaný (viz E2E L5).

**Varianty řešení (design only — bez implementace):**

| ID | Varianta | Přínos | Riziko |
|----|----------|--------|--------|
| V-A | Story XP milestones (vault unlock +50, first vault entry +25) | Méně search grindu | Mění pacing, nutná regrese sim |
| V-B | „Training“ encounter po vault (scripted tier-1 v Vault, guaranteed 60 XP) | Kvalitní jednorázový beat | Nový quest flag, stále determinismus |
| V-C | Snížit Warden tier na 2 pro L3 attempt | Rychlejší konec | **Sprint invariant: ne měnit boss bez schválení** |
| V-D | Progression hint UI: „~N bojů do další úrovně“ z průměru poolu | Méně frustrace bez balance | FE + copy only |

---

## 5. Exploration audit po lokacích

| Lokace | Příběhový účel | Unikátní interakce | Trvalý následek | Po vyčerpání | Alternativní postup |
|--------|----------------|--------------------|----------------|--------------|---------------------|
| **Whispering Cellar** | Start, safe-ish long rest | panel clue, tracks | quest flags disc_* | Grind pool tier1–2 | Jediná „home“ po defeat |
| **Sunken Corridor** | Hub, Mara | listen/water → Mara warning | `mara_warned` | Stejný pool | Vault route až po quest |
| **Shrine** | Caldus, bell arc | bowl clue, quest steps | bell/vault flags | Talk flavor only | — |
| **Goblin Market** | Nib, shop | stall clue, `buy` | bell, gold spend | Shop stále; quest closed flavor | Bandit Camp side |
| **Vault of Echoes** | Pre-boss tension | bells ambiance | — | Grind tier2–3 | Crypt branch |
| **Bell Warden's Pit** | Finale | boss chip, warden | `chapter_one_complete` | Empty pit explore | Named attack only for boss (low L random won't spawn tier3) |
| **Forgotten Crypt** | Side relic | `try_side_quest_explore` | shard, 15 gp, 10 XP | „dust remains“ | Optional |
| **Bandit Camp** | None in main quest | bounty clue, captain pool | disc + gold once | Repeat fights | **Weak narrative hook** |
| **Underground River** | Atmosphere / danger hint | ferry clue | disc + gold once | Repeat fights | Propojení crypt–corridor |

---

## 6. Combat audit po třídách

*MVP používá **Fighter** místo labelu Warrior; audit mapuje Fighter → Warrior.*

### Společné combat pravda

- Initiative d20 + DEX (`service` combat start).
- Player: `attack`, `cast`, `defend` (disadvantage na 1 hit enemy), `flee` (DEX DC 10), potion.
- Enemy: jeden útok/kolo, ploché damage z tabulky — **`encounters.py`**.
- Defeat → revive Cellar 1 HP (`_recover_from_combat_defeat`).

### L1 staty (shell, HEAD `dc08808`)

| Class | HP | AC | Sloty L1 | Smysluplné L1 akce |
|-------|-----|-----|----------|-------------------|
| **Fighter** | 12 | 16 | — | `attack` shortsword, equip, defend; nejstabilnější |
| **Wizard** | 8 | 12 | 2× L1 | Fire Bolt, Magic Missile (modeled), Mage Armor; **vysoká mortalita** v explore bojích |
| **Cleric** | 10 | 16 | 2× L1 | Sacred Flame (save DEX), Cure Wounds (heal), mace attack; nejlepší „solo sustain“ |
| **Ranger** | 12 | 16 | **0** | **Jen martial** do L2; Cure Wounds v STARTING_SPELLS ale **nepřipraveno** (`spell_slot_progression` half-caster) |

### Taktická hloubka

| Očekávání hráče | Realita |
|-----------------|---------|
| Třída mění boj | Jen HP/AC/spell dostupnost; stejný attack loop |
| Kouzla mění situaci | Malá sada `MODELED_SPELL_EFFECTS`; ostatní flavor |
| Různí nepřátelé | Jiné HP/AC/dmg/XP; **stejné AI** |
| Boss encounter | Vysoké HP 38, 1d10+4; L3 hráč ~+4 atk — **dlouhý exchange**, bez fází |

**Test coverage:** převážně `fighter` v `test_gameplay_integrity.py`, `test_chapter_one_boss.py`; **per-class boss path NOT systematically tested**.

---

## 7. NPC a příběhový audit

| NPC | Reaguje na flagy | Quest postup | Charakter / nové info | Slabina |
|-----|------------------|--------------|------------------------|---------|
| **Caldus** | Ano (5 větví textu) | Jen přes QUEST resolver, ne TALK | Klidný caretaker | Po vault jen reminder; žádná větev „jak porazit Wardena“ |
| **Nib** | Ano | ask_nib jednorázově | Obchodník, nervózní | Shop oddělený od dialogu; bez questu odmítá |
| **Mara** | Jednoráz warning | Ne | Varování před vodou | Po warn jen echo; **neovlivňuje mechaniku river** |

**Odměny:** Bell arc **40 XP + 25 gp** quest+boss gold (plus bojové XP). Echo shard + echo v inventáři — **žádný engine use** shardu zjištěn (pouze loot flavor). Shortsword +1 (95 gp) — grindově dosažitelné, **ověřitelný dopad** jen přes equip damage.

---

## 8. TOP 10 změn podle dopadu na zábavnost

| # | Změna | Dopad | Sprint |
|---|--------|-------|--------|
| 1 | **Story-paced XP** mezi vault unlock a pit (milestones, ne snížení Warden XP) | Odstraní „40× search“ pocit | S15 P0 |
| 2 | **Guided „first hunt“** po vault (1 scripted encounter + journal beat) | Učí boj, dá XP bez smyčky | S15 P0 |
| 3 | **Lokace s jednorázovým choose** (2 větve, flag, malý loot) — Vault/Crypt | Kvalita &gt; kvantita explore | S15 P1 |
| 4 | **Progression telegraph** (kolik XP chybí / doporučená úroveň pro Warden) | Snižuje frustraci bez balance | S15 P0 |
| 5 | **Ranger L1 cantrip-only** nebo 1× L1 slot — parity tříd | Fairness class pick | S16 P1 |
| 6 | **1 monster trait** (např. wolf pack flee, skeleton resist) — data-driven | Taktika bez nového systému | S16 P1 |
| 7 | **Cleric/Wizard onboarding chip** (Cast Sacred Flame / Fire Bolt v 1. boji) | Class identity | S16 P0 |
| 8 | **Bandit Camp / River quest stub** (1 flag, 20 XP, unique clue pro Warden) | Důvod navštívit mimo grind | S17 P1 |
| 9 | **Economy bridge:** quest reward enough for 1 potion OR „Caldus blessing“ 1× free heal | Boss prep feels fair | S17 P1 |
| 10 | **Inspect actions** jako alternativa k `search` (deterministic clue, no d6) — cooldown share | Méně RNG dead turns | S15 P2 |

---

## 9. Backlog Sprintů 15–17

### Sprint 15 — Exploration & Progression V1

| Priorita | Úkol | Problém | Důkaz | Soubory | Riziko | Testy | AC | Size |
|----------|------|---------|-------|---------|--------|-------|-----|------|
| P0 | Milestone XP flags | Grind gap post-vault | sim 13–90 explore | `quests.py`, `economy_balance.py`, `service.py` | Balance perception | pytest quest + sim | L3 dosažitelné &lt;25 explore (seed 42) bez snížení boss XP | M |
| P0 | Progression UI copy + quest hint | Hráč neví proč grind | E2E L5 cheat | `questProgress.ts`, `gameActions.ts`, i18n | Low | vitest chips | Aktivní krok říká „získej úroveň X“ | S |
| P0 | Vault „first descent“ beat | Vault prázdný po beat | locations arrival only | `service.py` explore branch nebo quest flag | Medium | integration | 1× vstup = journal fact + XP | M |
| P1 | Deterministic inspect clues | d6 dead turns | `service._explore` | `discoveries.py`, `service.py` | Low | test_offline_cs / explore | inspect ≠ search, 1×/lokace | M |
| P1 | Crypt XP volá `level_up` | Nekonzistence | `quests.py` L201 | `quests.py` | Low | unit | +10 XP může levelovat | S |
| P2 | Bandit camp map tooltip | Mrtvá lokace | locations graph | FE map copy | Low | — | Tooltip „side risk“ | S |

### Sprint 16 — Combat & Class Identity V1

| Priorita | Úkol | Problém | Důkaz | Soubory | Riziko | Testy | AC | Size |
|----------|------|---------|-------|---------|--------|-------|-----|------|
| P0 | Combat tutorial chip (1. fight) | Nováček jen attack | play chips | `gameActions.ts`, `play.css` | Low | vitest | Po 1. encounter nabídne Defend/Flee/Spell | S |
| P1 | Ranger L1 spell access | Class dead pick | python shell slots {} | `spells.py`, `service.py` | Medium | test class create | Ranger má ≥1 useful spell L1 | M |
| P1 | Monster tag `on_hit_effect` (1–2 monstra) | Same AI | `encounters.py` | `encounters.py`, `service._enemy_turn` | **Determinism** | pytest combat | Ghoul/wolf rozlišitelné v journalu | L |
| P1 | Boss telegraph ability (rattle, +0 dmg flavor turn) | Boss = sponge | 38 HP | `encounters.py`, combat | Medium | boss regression | Boss má ≥2 journal beats | M |
| P2 | Class-specific defeat tip | Wizard dies often | L1 wizard 8 HP | offline_prose / UI | Low | — | CS/EN tip po revive | S |

### Sprint 17 — Story Consequences & Rewards V1

| Priorita | Úkol | Problém | Důkaz | Soubory | Riziko | Testy | AC | Size |
|----------|------|---------|-------|---------|--------|-------|-----|------|
| P0 | Caldus post-vault counsel (engine TALK branch) | No boss guidance | npc_interactions | `npc_interactions.py` | Low | test talk flags | Nový text při vault_unlocked | S |
| P1 | Echo shard use (lore check DC → journal) | Loot bez významu | inventory item | `discoveries` nebo quest | Low | test | 1× use = clue, ne power creep | M |
| P1 | Mini side chain River/Camp (1 flag → Warden damage úolnění **ne**) | Empty nodes | exploration audit | `quests.py`, `locations.py` | Medium | pytest | Splnění = XP+clue, ne damage buff | L |
| P1 | Shop affordance po bell | 10 gp &lt; 45 potion | economy | `shop.py` / quest gold | Balance | economy tests | Hráč může koupit lektvar po bell s 1 explore gold OR quest +15 gp | S |
| P2 | `chapter_one_complete` celebration UX | Abrupt end | journal only | FE `TurnMoments` | Low | vitest | Modal/chronicle beat | M |

---

## 10. Akceptační kritéria první kapitoly (player-facing)

| ID | Kritérium | Stav (kód dnes) | Cíl po S15–17 |
|----|-----------|-----------------|---------------|
| A1 | Hráč bez guide dokončí bell arc (accept→Nib→return→vault) | **Částečně** — chipy pomáhají | A1 **ANO** s Lite + chips |
| A2 | Hráč pochopí, proč nemůže hned na bosse | **Částečně** — `attack_block_message` | A2 **ANO** + progression hint |
| A3 | Cesta na bosse &lt;30 min explore (seed typical) bez E2E cheat | **NE** — sim 13–51+ | A3 **ANO** (milestone XP) |
| A4 | Boss kill na L3 možný (skilled) / L4 doporučený | **ANO** engine | Beze změny |
| A5 | Volitelná side (crypt) odmění bez povinného grindu | **ANO** | Beze změny |
| A6 | Každá třída MVP má L1 jasnou „první bojovou akci“ | **NE** (ranger) | A6 **ANO** |
| A7 | Lite tier kompletní kapitolu | **ANO** | Beze změny |
| A8 | Žádný pay-to-win / LLM mění stav | **ANO** | Invariant |

---

## Příloha: Co bylo ověřeno vs. ne

| Aktivita | Stav |
|----------|------|
| Čtení `GameEngine`, quests, locations, encounters, NPC, spells, FE chips | **Ano** |
| `tools/progression_scenarios.py` | **Spuštěno** (výstup v §4) |
| L1 class snapshot (python one-liner) | **Ano** |
| Plný pytest/vitest běh | **Ne** (bez změn kódu; odkaz na Sprint 11.3 matrix) |
| Telegram / Android / iOS playtest | **NOT TESTED** |
| „Je to zábavné?“ | **Neověřeno** — jen strukturální audit |

---

*Konec Sprint 14 deliverable. Implementace Sprint 15+ zde nezačala.*
