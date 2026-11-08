# DoupěDraka Mini App — obrazovky a engine truth

Zdroj pravdy pro frontend sprinty 1–4. Vizuál: **B modern dark fantasy**; ilustrace **C** až po Sprintu 4 (placeholder).

## 1. Tři vrstvy

| Vrstva | Data (engine) | UI povrch |
|--------|---------------|-----------|
| **Svět** | `LOCATIONS`, `visited_locations`, `quest_flags`, travel gates | Map, Travel, scene text |
| **Hrdina** | `Character` payload, inventář, sloty, HP | Hero, HUD, delta po tahu |
| **Vypravěč** | `POST .../actions/stream`, offline fakta | Journal, composer, chips |

Tok: Map → `travel to X` → Adventure scéna → Talk/Explore → stream → aktualizace postavy a quest flags.

## 2. Wireframes (struktura)

### Adventure (průzkum)

```
[ Kapitola I · Ztracený zvon ]     [ mana ]
[ NÁZEV LOKACE ]
[ Aktuální scéna — poslední narace / scenePrompt ]
[ HUD: jméno · class · HP · AC ]
[ Journal — poslední beaty, roll highlight ]
[ Quick: Explore | Talk | Travel | Custom ]
[ Suggested chips ]
[ Composer + Odeslat ]
[ Bottom nav: Hub · Play · Map · Quests · Hero · More ]
```

### Combat (Sprint 4 layout)

```
[ BOJOVÁ SITUACE ]
[ Enemy card dominantní ]
[ HUD hráče ]
[ Journal ]
[ Attack | Cast | Potion | Flee | Defend ]
[ Composer — volitelný ]
```

### Fallen

```
[ Padl jsi ]
[ Krátký text — žádný narrator error ]
[ Obnovit (revive API) ]
[ Hub ]
```

### Map

```
[ Kapitola I ]
[ Graf uzlů ]
[ Klepnutí → sheet: popis, stav, Travel jen pokud allowed ]
```

### Quests

```
[ HLAVNÍ ÚKOL — Ztracený zvon ]
[ Next step karta ]
[ Seznam kroků ]
```

### Hero

```
[ Přehled AC/HP/XP ]
[ Vlastnosti | Inventář | Kouzla ]
```

### Hub / More / Settings

Beze změny architektury: Hub = mana, continue, invite; More = journal, settings, tools, campaign.

## 3. Engine truth (tlačítka)

| UI | Zobrazit když | Akce / API | Zakázat |
|----|---------------|------------|---------|
| Explore | `!in_combat && hp>0` | `search {location}` | fallen |
| Talk | `!in_combat && hp>0` | NPC quest string (`resolveNpcTalkAction`) nebo focus composeru — **ne** `listen for movement` | fallen |
| Travel | `!in_combat && hp>0` | otevře Map / `travel to …` | locked routes |
| Bojovat | **`in_combat` only** | attack/defend/flee/cast | nikdy v průzkumu |
| Shop | intent SHOP + lokace | text shop | **ne** globální tlačítko (jen chip pokud engine vrátí shop) |
| Kouzlo submit | `effect_modeled` | cast | jinak warning, disabled submit |
| Revive | `hp <= 0` | `POST /characters/{id}/revive` | jinak skryté |
| Akce obecně | `hp > 0` | stream | 409 fallen → Fallen UI, ne error-panel |

## 4. Stavy hry

| Stav | Panely aktivní |
|------|----------------|
| explore | Adventure layout, vše kromě combat akcí |
| combat | Combat layout |
| fallen | Fallen overlay, žádné quick actions |
| sending | thinking, disabled inputs |
| narrator error | error-panel: **Try again** = zopakuje poslední tah (idempotence); jinak **Dismiss** — **ne** fallen |

## 5. Mobil

Pořadí scroll: kontext → HUD → journal → akce → composer. `safe-area` na header/nav (`viewportChanged`). Composer sticky nad klávesnicí. Telegram **MainButton**: jeden handler, teardown při opuštění hry (`telegramWebApp.ts`).

## 6. Mapování kódu

| Soubor | Účel |
|--------|------|
| `frontend/src/game/gameActions.ts` | quick actions, chips, scene |
| `frontend/src/screens/FallenScreen.tsx` | revive |
| `frontend/src/screens/AdventureScreen.tsx` | průzkum |
| `frontend/src/screens/CombatScreen.tsx` | boj |
| `frontend/src/components/JournalScene.tsx` | deník + roll highlight |
| `GameScreens.tsx` | GameScreen router, Map, Quest, Hero |
| `App.tsx` | stream, revive, delta, fallen error routing |
| `app/api.py` `/reference` | locations + `arrival_beat` |

## 7. Sprint checklist

- [x] Doc
- [ ] Sprint 1: Fallen + Adventure layout
- [ ] Sprint 2: Map sheet + beats
- [ ] Sprint 3: Quest hero delta
- [ ] Sprint 4: Combat + Telegram + LocationArt placeholder
