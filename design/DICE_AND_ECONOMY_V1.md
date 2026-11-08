# DICE_AND_ECONOMY_V1 — Kostky, zdroje a ekonomika

**Game Design Sprint 01 (GDS01)** · Stav: návrh k schválení · Zdroj pravdy enginu: `clean-main` (bez změn kódu v tomto sprintu)

**Produktová kotva:** Doupě Draka prodává **dobrodružství a kvalitu vypravěče**, ne energii potřebnou k hraní. Kostky a pravidla RPG zůstávají férové; placený obsah **nesmí** ovlivnit hod, DC, šanci na vítězství ani sílu postavy.

---

## Odpovědi na pět otázek

| # | Otázka | Odpověď (v1) |
|---|--------|----------------|
| 1 | Jak fungují kostky a co může výsledek změnit? | Engine vlastní D20/D6; výsledek mění HP, zlato, quest flags, combat, lokace, inventář. Viz §A. |
| 2 | Jaké zdroje má hráč a k čemu slouží? | HP, spell sloty, gold (hrdina); kredity vypravěče (účet Telegram). Legacy `character.mana` není herní zdroj. Viz §B. |
| 3 | Jak hráč získává XP, zlato, předměty? | Boj, questy, průzkum, obchod, kapitola. Baseline čísla v §D a `ECONOMY_MODEL_V1.md`. |
| 4 | Co je zdarma a za co by platil? | Zdarma: celá herní smyčka na **Lite** vypravěči. Volitelně později: prémiová narace, kapitoly obsahu. Nikdy pay-to-win. Viz §C. |
| 5 | Jak ověříme zábavu a udržitelnost? | `CHAPTER_ONE_PLAYTEST_V1.md` (10–15 hráčů); telemetrie a nákladový model před monetizací. Viz `ECONOMY_MODEL_V1.md`. |

---

## As-is baseline (clean-main)

Audit kódu — implementace **nesmí** v GDS01 měnit, ale spec z něj vychází.

### Kostky a průzkum

| Kostka | Použití (as-is) | Kde |
|--------|-----------------|-----|
| D20 | Útok (`attack` vs AC), ability checks, iniciativa | `app/engine/service.py`, `encounters.py` |
| D6 | Náhodný průzkum (`search` / explore intent) | `service._explore()` |
| D4 | Náhodné zlato z průzkumu (při výsledku 3 na D6) | `service._explore()` |
| Různé | Poškození zbraní/monster šablony | `encounters.py` |

**Tabulka průzkumu D6 (as-is)** — každá strana 1/6 ≈ 17 %, kromě 5–6 dohromady 33 %:

| D6 | Výsledek |
|----|----------|
| 1 | Náhodné setkání → combat (po cooldownu 1) |
| 2 | Stopa v lokaci (`track_discovery`) |
| 3 | 1–4 gp (`1d4`) |
| 4 | Indicie (`clue_discovery`) |
| 5–6 | „No immediate threat“ (žádná změna kromě logu) |

**Cooldown:** Po setkání z D6=1 nastaví `exploration_cooldown = 1`; další průzkum jen zpráva „catch your breath“ (`service._explore`).

**Výjimka — Forgotten Crypt:** `quests.try_side_quest_explore` — jednorázově **mimo D6**: 10 XP, 15 gp, Echo shard (`crypt_relic_claimed` flag). Neopakuje se.

**Ability checks:** `ability_check` + mnoho větví s pevným **DC 12** (gap pro budoucí variabilní DC).

### Ekonomické odměny a obchod (ověřené)

| Aktivita / předmět | Hodnota | Zdroj |
|--------------------|---------|-------|
| Level-up threshold | 100 XP | `service.py` `XP_THRESHOLD` |
| Goblin | 50 XP | `encounters.py` |
| Kobold | 35 XP | `encounters.py` |
| Skeleton | 50 XP | `encounters.py` |
| Bell Warden | 180 XP | `encounters.py` |
| Vrácení zvonu Caldusovi | 30 XP + 5 gp | `quests.py` |
| Crypt side quest | 10 XP + 15 gp + Echo shard | `quests.py` |
| Dokončení kapitoly 1 | 25 gp | `service.py` (po Bell Warden) |
| Průzkum – zlato | 1–4 gp | `service._explore` |
| Healing Potion | 50 gp | `shop.py` |
| Shortsword +1 | 100 gp | `shop.py` |

**Obtížnost Hard:** násobí XP z nepřátel ×1,35 (`encounters.py`). Level-up max **1 úroveň / resolved turn** (DECISIONS D25).

### Kredity vypravěče (as-is — „Adventure Mana“ v UI)

| Položka | As-is |
|---------|-------|
| Start účtu | 100,0 kreditů (`STARTING_BALANCE_TENTHS` = 1000 tenths) |
| Lite | 0 za změněný tah |
| Normal | 1,0 za změněný tah |
| Pro (cena v kódu) | 1,4 — **tier select API vždy odmítá** `pro` |
| Default tier DB | `User.model_tier` default **`normal`** (`app/db.py`) |
| `DEFAULT_TIER` | **`normal`** (`economy.py`) |
| Bez AI providera | Tier list jen Lite; paid tier → HTTP 422 |
| **Nesrovnalost** | Účet může mít uložený Normal a při **offline fallback** platit za tah bez placené kvality narace |

Platba: `atomic_debit_energy` po **změněném stavu hře** (`state_changed`), ne dle úspěchu AI (`app/api.py`).

### UI (as-is)

- Adventure Mana / ⚡ na Home, Play HUD, Settings (`GameScreens.tsx`, `sharedPlayUI.tsx`).
- Legacy **Mana (historical)** na character sheet (`character.mana`).

---

## A. Dice Design

### A.1 Principy

1. **Engine rozhoduje** — LLM jen naracuje fakta (DECISIONS D1, D16).
2. **D20 a D6** zůstávají jádrem MVP; žádné kompletní přepsání pravidel 5e.
3. **Úspěch** = engine změní stav dle pravidel. **Neúspěch** = komplikace nebo menší zisk — ne automaticky „nic“.
4. **Komplikace (podmíněná):** vzniká jen pokud existuje **skutečné riziko** a hráč zná **základní sázky** rozhodnutí. Ne každý fail = zranění / boj / spotřeba zdroje. Komplikace musí být **předvídatelná z kontextu** a **vyhodnotitelná enginem**.

### A.2 Matice situací (cílová specifikace)

| Situace | Kostka / mechanika | Co může změnit | As-is / gap |
|---------|-------------------|----------------|-------------|
| Útok | D20 + bonus vs AC | HP nepřítele/hrdiny, konec boje, XP | Hotovo |
| Schopnosti | D20 + mod vs **DC** | Quest, travel gate, indície, dialog flag | Často DC 12 → variabilní DC |
| Průzkum | D6 (+ cooldown) | Combat, zlato, stopa, indicie, klid | 5–6 slabé → viz A.4 |
| Rozhovor | Schopnost (CHA/WIS) vs DC | Quest step, inventář (zvon), hint | Engine-owned NPC |
| Plížení | DEX/INT vs DC | Odhalení → combat nebo komplikace | Spíše přes ability routing |
| Kouzla | Slot + D20/Save dle kouzla | HP, condition modeled | Whitelist D17 |

### A.3 Tabulka obtížnosti (DC)

| DC | Obtížnost | Typické použití (návrh) |
|----|-----------|-------------------------|
| 5 | Velmi snadné | Zjevný objekt, spolupracující NPC |
| 10 | Snadné | Běžná stopa, slabý zámek |
| 12 | Běžné | **Současný default** — zachovat jako „standard“ |
| 15 | Náročné | Past, nepřátelský NPC, špatné světlo |
| 18 | Velmi obtížné | Spěch, zranění, časový tlak |
| 20+ | Výjimečné | Boss mechanika, rituál |

**Implementace (později):** mapovat lokaci / quest / intent → DC; testy s fixním RNG.

### A.4 Průzkum D6 — varianty a doporučení

**Společné pro obě varianty:**
- Zachovat **exploration_cooldown** po setkání z D6=1.
- **Forgotten Crypt** zůstává **deterministická jednorázová odměna** (`try_side_quest_explore`), ne D6.
- Side quest explore v Cryptu má prioritu před běžným `_explore`.

#### Varianta A — klid s rozlišením 5 a 6 (evoluce as-is)

| D6 | Pravděpodobnost | Výsledek |
|----|----------------|----------|
| 1 | 17 % | Setkání (cooldown) |
| 2 | 17 % | Stopa |
| 3 | 17 % | 1–4 gp |
| 4 | 17 % | Indicie |
| 5 | 17 % | **Persistovaná stopa** v lokaci (viz níže) + krátký beat v logu |
| 6 | 17 % | Klid; **žádný** combat; krátký „safe“ beat (**bez nového flagu**) |

**D6=5 ve variantě A (závazná specifikace pro E3):** engine uloží **trvalý fakt** na postavě — `quest_flags["explore_track:<location>"]` (normalizovaný název lokace) — se stejným herním významem jako text `track_discovery` pro danou lokaci. Journal a vypravěč smí stopu parafrázovat, ale **nesmí** být jediným „důkazem“ stopy.

**Jednou za lokaci (závazné):** novou persistovanou stopu lze z D6=5 získat **nejvýše jednou na lokaci**. Pokud flag už existuje, další D6=5 v téže lokaci je **bez nového flagu** — engine vrátí krátkou zprávu typu „už známá stopa“ (může citovat uložený `track_discovery` text). D6=2 (as-is) zůstává odděleně; E3 sjednotí chování 2 vs 5 podle doporučené varianty A.

**D6=6:** pouze prose beat; **žádná** nová persistovaná stopa (odlišení od 5).

**Modelový dopad (Whispering Cellar, 4× search):** stále ~44 % „nižší drama“ na 5–6, ale 5 přidává mikro-progres ověřitelný enginem, 6 je explicitně bezpečný odpočinek.

#### Varianta B — každý výsledek mění stav

| D6 | Výsledek |
|----|----------|
| 1 | Setkání |
| 2–4 | Jako as-is |
| 5 | Komplikace bez combatu (např. noise flag → další check DC +2 příští tah) |
| 6 | Drobná odměna (1 gp nebo „free“ clue tier) |

**Modelový dopad:** žádný čistě prázdný tah; vyšší tempo, vyšší riziko „spam search“.

#### Doporučení GDS01

**Implementovat později Variantu A (rozlišené 5 a 6).** Nižší riziko pro balance, zachovává „dech“ po boji, řeší nudu 5–6 bez přetížení odměn. Varianta B ponechat jako alternativu pro playtest A/B, pokud hráči hlásí prázdný průzkum.

### A.5 Důsledky úspěchu a neúspěchu (příklady)

| Kontext | Úspěch | Neúspěch (komplikace, ne trest) |
|---------|--------|----------------------------------|
| INT inspect panel | Odemkne hint / quest flag | Škrábanina beze změny; nebo „něco prasklo“ → +1 noise, ne damage |
| CHA persuade Nib | Quest krok | Nib se urazí; vyšší DC příště, ne combat |
| Search D6=1 | Combat | — |
| Flee | DEX vs **DC 10** — úspěch ukončí boj (`in_combat=false`), nastaví `exploration_cooldown=1` | Neúspěch: zůstáváš **v boji**, monster aktivní; **as-is** v tom samém tahu **neprobíhá** automatický `_enemy_turn` (na rozdíl od útoku / defend). Další poškození až z jiné hráčovy akce, která předá tah nepříteli. |

---

## B. Resource Design

| Zdroj | Vlastník | Účel | Obnova |
|-------|----------|------|--------|
| **HP** | Postava | Přežití | Léčení, potion, rest (D24), level-up částečně |
| **Spell slots** | Postava | Kouzla (whitelist) | Long rest; casting dle D17 |
| **Gold** | Postava | Nib shop, budoucí služby ve světě | Questy, kapitola (+25 gp po Bell Warden), průzkum (1–4 gp); **ne** generický loot z monster (as-is jen XP z boje) |
| **Kredity vypravěče** | **Účet** (Telegram) | Volitelná kvalita AI narace za **změněný tah** | Start 100; budoucí top-up (admin-only dnes) |

**Legacy `CharacterState.mana`:** technický pozůstatek staršího návrhu; **neprezentovat** jako aktivní herní zdroj (cíl UI: skrýt nebo pouze archiv).

**Oddělení (závazné pro copy i monetizaci):** spell slot ≠ kredit vypravěče ≠ legacy mana.

---

## C. Economy & Monetization Design

### C.1 Tři pilíře produktu

| Pilíř | Co hráč dostává | Stav |
|-------|-----------------|------|
| **Free core** | Plná kapitola 1, Lite vypravěč, kostky, boj, quest | As-is engine |
| **Premium narration** | Bohatší AI próza (Normal; Pro až bude dostupný) | Normal vyžaduje provider |
| **Story chapters** | Nové kampaně, oblasti | Deferred produkt |

Kosmetika / personalizace — volitelná 4. vrstva, ne kritická pro GDS01.

### C.2 Anti-patterns (zakázáno)

- Lepší hod / DC za peníze  
- Loot nebo XP za platbu  
- Paywall hlavní quest chain  
- Prodávat „klikání“ místo hodnoty vypravěče nebo obsahu  

### C.3 Cíl uzavřené bety — tier a kredity

| Pravidlo | As-is | Cíl (spec) |
|----------|-------|------------|
| Výchozí tier nového hráče | normal | **lite** |
| Bezplatná hra | Lite 0 kreditů; ale default normal spotřebovává | **Nikdy neúčtovat**, když hráč hraje Lite nebo nemá dostupného online vypravěče |
| Zapnutí paid tier | Možné bez providera na starých účtech | **Jen** pokud provider + tier skutečně doručí placenou službu |
| Sdílení kreditů | Mezi postavami jednoho účtu | Zachovat |

### C.4 Narrator billing contract (návrh)

| Událost | As-is | Cíl |
|---------|-------|-----|
| Tah nezmění stav | Neúčtovat | Zachovat (D10) |
| Tah změní stav, Lite | Neúčtovat | Zachovat |
| Tah změní stav, Normal/Pro, **úspěšná AI narace** | Účtovat | Zachovat |
| Tah změní stav, paid tier, **fallback offline** | **Účtovat** | **Neúčtovat nebo refund** |
| Stream přerušen, nahrazeno offline | Neuřazeno | **Stejná politika jako fallback** |

**Doporučení:** Hráč **nesmí** přijít o kredit, pokud neobdržel slíbenou placenou kvalitu vypravěče.

**Implementační poznámka (později):** vázat debit na `narration_status` / receipt flag, audit v `energy_transactions`.

### C.5 Pro — tři vrstvy pravdy

| Vrstva | Popis |
|--------|--------|
| Plánovaný produkt | Pro = vyšší reasoning / kvalita |
| Cena v kódu | 1,4 kreditu (`MODEL_TIERS`) |
| Dostupná služba | **Ne** — `/economy/tier` odmítá `pro`; v listu jen s OpenRouter |

Konstanta v kódu **≠** funkční produkt.

---

## D. Progression Design

### D.1 Aktivita → odměna

| Aktivita | Odměna (engine) |
|----------|-----------------|
| Boj (vítězství) | XP dle `reward_xp` šablony; **žádný** obecný loot drop (kapitola 1) |
| Main quest krok | XP/gp/flags dle `quests.py` |
| Side Crypt | 10 XP, 15 gp, Echo shard (jednou) |
| Průzkum D6 | gp / stopa / combat |
| Kapitola complete | +25 gp + narrative closure |
| Level-up | +1 level max/turn, HP die, sloty, spells |

### D.2 Session model

Odhady délky a ekonomiky: **`design/ECONOMY_MODEL_V1.md`** (30 min / 2 h scénáře z baseline tabulky).

### D.3 Designové mantinely

- Po ~2 h nesmí hráč být **bezmocný v obchodě** (Shortsword 100 gp vs příjem z questů + explore).
- Po ~2 h nesmí být **přebytek zlata bez výdaje** (jen 2 položky v shopu dnes — riziko hromadění; sledovat v playtestu).

---

## E. Player Flow — Chapter One (model)

| Krok | Hráč | Engine | Vypravěč | Odměna / stav |
|------|------|--------|----------|----------------|
| 1 | Otevře Mini App, vytvoří/vybere hrdinu | Auth, character load | Welcome / cellar beat | — |
| 2 | `search` v Cellar | D6 průzkum nebo cooldown | Prose + exploration roll fact | track/gp/combat |
| 3 | Travel → Shrine | travel intent, location | arrival_beat | quest dostupný |
| 4 | Talk Caldus, accept quest | `bell_quest_accepted` | dialog prose | quest flag |
| 5 | Market, ask Nib | `bell_acquired`, item bell | prose | inventář |
| 6 | Return bell (Caldus) | `bell_quest_complete` | prose | **30 XP + 5 gp** (`return_bell`) |
| 7 | Talk Caldus znovu (po vrácení) | `vault_hint_given`, `vault_unlocked` | prose | cesta do Vault (druhý dialog — **ne** ve stejném tahu jako vrácení) |
| 8 | Vault, Bell Warden, victory | combat, `chapter_one_complete` | prose | 180 XP (boss) + **25 gp** chapter reward |

Detailní playtest scénář: **`design/CHAPTER_ONE_PLAYTEST_V1.md`**.

---

## Akceptační checklist (GDS01 deliverable)

- [x] Jednotná tabulka kostek a as-is průzkumu včetně Crypt výjimky a cooldownu
- [x] DC škála a pravidlo komplikací s podmínkou rizika
- [x] D6 varianty A/B modelované; **doporučena varianta A**
- [x] Oddělení HP, spell slots, gold, kredity vypravěče; legacy mana deprecated
- [x] Free vs placené pilíře; anti pay-to-win
- [x] AI náklady — pouze v `ECONOMY_MODEL_V1.md` (známé/hypotézy/neměřené)
- [x] XP/zlato baseline a odkaz na session model
- [x] Chapter One flow + playtest doc
- [x] Testovací protokol 10–15 hráčů
- [x] Tier/provider nesrovnalost a billing contract zdokumentovány

**Sign-off:** _Čeká na produktové schválení po review tří dokumentů GDS01._

---

## Navazující implementace (mimo GDS01)

| Epic | Obsah |
|------|--------|
| E1 | UI copy: Kredity vypravěče |
| E2 | Default Lite, tier gating |
| E2b | Billing při fallback / interrupted stream |
| E3 | DC + D6 varianta A |
| E4 | Kapitola 1 motivation polish |
| E5* | Minimální telemetrie před playtestem (náklady/billing signály) |
| E6 | Monetizace až po validaci produktu playtestem |

**Pořadí implementace:** E1 → E2 → E2b → minimální telemetrie → closed beta playtest → E3 → E4 → **E6** (platby až po go z playtestu). Viz `ROADMAP.md`.

Viz `DECISIONS.md` D30+, `ROADMAP.md`.
