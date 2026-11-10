# Sprint 11.4 — Boss readiness & progression UX

**Datum:** 2026-11-10  
**Baseline:** `aa8faea` · větev `clean-main` · working tree zachovává necommitnuté změny Sprintů 11.1–11.3  
**Omezení sprintu:** žádná změna XP/loot/DC/HP/boss balance · žádný commit/push  

---

## A. Předkontrola

| Položka | Stav |
|---------|------|
| `git rev-parse HEAD` | `aa8faeae95a898f9916456bd16d9ffbcb138873b` |
| Branch | `clean-main` |
| Necommitnuté změny | Zachovány (engine, frontend, testy, E2E, docs) |
| Mazání / reset / stash | **Neprovedeno** |

---

## B. XP a levely (engine)

Zdroj: `app/engine/service.py` (`XP_THRESHOLD = 100`), `ruleset_v1.py` (`MAX_MVP_LEVEL = 5`).

Každý level-up **odečte 100 XP** z baru; hráč nikdy ne„platí“ XP zpět mimo level-up.

| Cílový level | Kumulativní XP získané od startu (L1, 0 XP) | XP „v baru“ po dosažení levelu |
|--------------|---------------------------------------------|--------------------------------|
| **2** | 100 | 0 (po level-up) |
| **3** | 200 | 0 |
| **4** | 300 | 0 |
| **5** | 400 | 0 (cap; přebytek XP se neukládá nad 99) |

**Bell Warden:** tier **3** → minimální level **3** (`minimum_level_for_tier` / `tier_allowed_for_level` v `encounters.py`). Přežitelnost souboje obvykle vyžaduje **L4–5** (viz 11.3); to není hard gate, jen obtížnost.

---

## C. Tabulka XP z aktivit (kapitola 1, normal difficulty)

| Zdroj | XP | Poznámka |
|-------|-----|----------|
| Vrácení zvonu Caldusovi | **30** | `quests.py` — hlavní quest |
| Echo shard (Forgotten Crypt, jednorázově) | **10** | `try_side_quest_explore` |
| Goblin scout | **50** | tier 1 |
| Kobold skirmisher | **35** | tier 1 |
| Starving wolf | **60** | tier 1 |
| Rattling skeleton | **50** | tier 1 |
| Road bandit | **70** | tier 2 (L2+) |
| … vyšší tier | 85–200 | až po odemčení levelu |
| Bell Warden (kill) | **180** | tier 3 boss |
| Explore (bez souboje) | **0** | zlato / stopa / flavor na d6 2–4 |

**Exploration encounter:** `search` / `explore` → `1d6`; při **1** spawn nepřítel (~**1/6**), `exploration_cooldown = 1` po boji nebo po „dechu“.

RNG vliv:

- **Frekvence soubojů:** binomická, průměrně ~1 boj na 6 `search` (plus cooldown prodlužuje smyčku).
- **Typ monstra:** náhodný z poolu lokace filtrovaný level tierem.
- **Boj:** d20 initiative, zásahy, porážka → revive v Cellaru (může přidat průzkumné kolo navíc — simulace seedů 0/42/99 v tomto sprintu **0 defeats** u fighter grind loop).

---

## D. Kolik aktivit na level 3 / 4 / 5

**Metoda:** deterministický engine sim (`tools/progression_scenarios.py`) — fighter, Whispering Cellar, smyčka `search` + `attack`, bez travel questů. **Nejde o naměřený herní čas** — pouze počet engine tahů.

### D.1 Příprava na Bell Warden (minimum **L3**) — po vrácení zvonu (+30 XP)

Start: L1, 30 XP v baru (případně +10 crypt = 40).

| Scénář | Seed | Crypt 10 XP | `explores` do L3 | `wins` do L3 |
|--------|------|-------------|------------------|--------------|
| Příznivý | 0 | ano | 12 | 3 |
| Příznivý | 0 | ne | 20 | 5 |
| Běžný | 42 | ano | 13 | 4 |
| Běžný | 42 | ne | 13 | 4 |
| Nepříznivý | 99 | ano | 45 | 5 |
| Nepříznivý | 99 | ne | 44 | 5 |

**Interpretace:** od vrácení zvonu po **otevření boje** (L3) typicky **~13–45 explore tahů** a **~4–12 výher** podle RNG. S crypt relicem o 10 XP méně bojových XP potřeba, ale harsh seed stále ~45 explore.

### D.2 Post-bell grind na **L5** (komfort pro boss) — start L1 + 30 XP, vault unlocked

| Scénář | Seed | Celkem `explores` | Celkem `wins` | Milestones (explores / wins) |
|--------|------|-------------------|---------------|------------------------------|
| Příznivý | 0 | 48 | 9 | L2: 13/3 · L3: 21/5 · L4: 38/7 |
| Běžný | 42 | 51 | 8 | L2: 8/2 · L3: 14/4 · L4: 32/7 |
| Nepříznivý | 99 | 90 | 11 | L2: 29/2 · L3: 45/5 · L4: 58/8 |

**Odhad délky přípravy (ne playtest):** při ~30–60 s na tah v UI → řádově **15–45 min** grindu po vrácení zvonu do L5; harsh RNG až **~90 search** (~45 min+). E2E (11.2) používá stream + seed 42 — ne ekvivalent náhodné produkce.

---

## E. P0 — Boss readiness UX (implementováno)

### Problém

Při L1–2 v Jámě engine vracel `"No bell warden is here for you to fight."` — hráč usoudil, že boss „chybí“, ne že má nízký level.

### Oprava (`app/engine/encounters.py`)

- `minimum_level_for_tier(tier)`
- `attack_block_message(character, key)` — rozlišuje:
  - špatná lokace → cesta do Jámy
  - pit sealed → Caldus / vault
  - **nízký level** → aktuální level, **min. level**, hint na XP (souboje + explore)
- `service._resolve_attack_turn` volá block message místo generického „not here“.

### Lokalizace

| EN (engine) | CS (`gameDisplay.ts`) |
|-------------|------------------------|
| `{name} is beyond your current experience (you are level X; reach at least level Y…)` | Strážce zvonu je příliš nebezpečný… úroveň X / alespoň Y… |
| Pit travel | Čeká v Jámě… dojdi přes mapu |
| Pit sealed | Jáma zamčená do Caldus vault route |

**Testy**

- `tests/test_gameplay_integrity.py` — block L2, initiative L3, wrong location
- `frontend/src/i18n/gameDisplay.test.ts` — CS překlady tří hlášek
- `tests/test_chapter_one_boss.py` — regrese chapter complete (beze změny balance)

---

## F. Progression design — doporučení (bez implementace)

### Varianta A — Zachovat XP, jen vysvětlení (aktuální sprint + drobné UI copy)

| | |
|--|--|
| **Délka kapitoly** | Beze změny |
| **Ekonomie** | Beze změny |
| **Obtížnost** | Beze změny |
| **Rizika** | Hráč bez čtení logu stále musí grindovat; jen méně frustrace z matoucí hlášky |
| **Doporučení** | **P0 hotovo** — doplnit volitelně quest hint / chip tooltip „doporučená úroveň 3+“ (copy only, mimo tento sprint) |

### Varianta B — Přerozdělit odměny v existujících aktivitách

Např. mírně zvýšit quest XP nebo crypt, snížit grind před pit — **bez nového obsahu**.

| | |
|--|--|
| **Délka kapitoly** | Kratší pre-boss grind |
| **Ekonomie** | Nepřímo rychlejší level → dřív tier-2 explore pool |
| **Obtížnost** | Nižší tension před bossem |
| **Rizika** | Rozbití ekonomiky shop/potion; nutný rebalance test matrix |
| **Doporučení** | Až po interním playtestu s metrikou „% hráčů stuck na L2 v pit“ |

### Varianta C — Upravit tempo kapitoly 1 (práh / tier gate / quest pacing)

Např. boss tier 2 do L2, nebo 80 XP per level v kapitole 1 — **systémová změna**, v tomto sprintu **zakázáno**.

| | |
|--|--|
| **Délka kapitoly** | Výrazně kratší nebo plynulejší křivka |
| **Ekonomie** | Středně až vysoký dopad |
| **Obtížnost** | Boss může být triviální nebo naopak smrtící při špatném návrhu |
| **Rizika** | Rozbití E2E, tier pravidel, RPG slib level 5 cap |
| **Doporučení** | Pouze pokud A+B nestačí po kvantitativním playtestu |

---

## G. Rozhodnutí pro interní playtest

| Otázka | Verdikt |
|--------|---------|
| Je progression systém **matematicky funkční** pro kapitolu 1? | **Ano** — L3 gate dosažitelný grindem; quest + explore + boje |
| Je **bez UX opravy** vhodný? | **Ne** — matoucí hláška (opraveno v 11.4) |
| Je **po 11.4** vhodný pro interní playtest? | **Ano, s výhradou** — testerům sdělit očekávaný grind (~L4–5 doporučeno) a RNG v explore; sledovat čas k prvnímu pokusu o Wardena |
| Měřený „zábavný“ čas | **NEZMĚŘENO** — pouze engine-turn simulace |

---

## H. Jak reprodukovat analýzu

```powershell
cd D:\DoupeDraka
$env:PYTHONPATH = 'D:\DoupeDraka'
python tools/progression_scenarios.py
python -m pytest tests/test_gameplay_integrity.py -k bell_warden -q
cd frontend; npm run test -- --run src/i18n/gameDisplay.test.ts
```

---

## I. Související dokumenty

- [`CHAPTER_ONE_ACCEPTANCE_QA_SPRINT_11_3.md`](CHAPTER_ONE_ACCEPTANCE_QA_SPRINT_11_3.md) — boss audit před UX fixem  
- [`GAMEPLAY_COMPLETENESS_AUDIT_V1.md`](GAMEPLAY_COMPLETENESS_AUDIT_V1.md) — audit trail Sprint 11.4  
