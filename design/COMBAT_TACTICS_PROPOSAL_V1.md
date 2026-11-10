# Combat tactics proposal — Heavy Attack, Aim, Defend

**Status:** návrh ke schválení (neimplementováno v tomto sprintu).  
**Baseline:** `clean-main` po P3; engine zůstává deterministický.

## Současný stav (shrnutí)

- Hráč v boji: **Attack** (weapon/spell intents), **Cast**, potion, **Flee**, **Defend** (pokud engine podporuje).
- Útok: standardní attack roll + damage v `GameEngine`; fakta v angličtině, UI/journal zobrazuje hod + prose odděleně.
- Nepřátelský tah: po hráčově úspěšném/neúspěšném tahu podle `combat_turn`.
- Offline narrator: `combat_prose_from_events` převádí hit/miss na prózu (bez čísel).

## Navrhované akce

### 1. Heavy Attack

| | |
|---|---|
| **Záměr** | Risk/reward: vyšší poškození za nižší šanci zásahu |
| **Pravidlo** | Útok s **disadvantage** (hodí se 2× d20, nižší) nebo **−2 k útoku** (zvolit jednu konvenci a držet ji) |
| **Damage** | `damage_die` + 1 extra die stejné velikosti, nebo `2dX` místo `1dX` při zásahu |
| **Náklady** | žádné sloty; volitelně spotřeba akce = celý tah |
| **Omezení** | nedostupné při Cast/Flee ve stejném tahu; heavy nelze s Aim ve stejném kole |
| **Balance** | očekávané DPR mírně nad standard attack při AC 13–15; pod standard při vysoké AC |
| **Test** | 1000 simulací fighter vs goblin AC 13; porovnat hit% a průměrné damage |

### 2. Aim

| | |
|---|---|
| **Záměr** | Příprava na další útok |
| **Pravidlo** | Tah hráče **neútočí**; nastaví `combat_buff_aim = 1` na postavě |
| **Příští attack** | advantage nebo **+2 attack** (jen na první attack do konce kola); buff se spotřebuje |
| **Náklady** | žádná mana; ztráta damage v tomto kole |
| **Omezení** | nepřítel normálně útočí v odpovědi; Aim ruší Flee v tomtéž kole |
| **Balance** | silné proti high-AC cílům; slabé proti swarm |
| **Test** | stejná simulace; měřit expected damage přes 2 kola (aim + attack) vs 2× standard |

### 3. Defend (aktivní)

| | |
|---|---|
| **Záměr** | Jasná obrana místo pasivity |
| **Pravidlo** | Dokud `combat_turn == player`, **Defend** nastaví `defending_until_next_turn` |
| **Účinek** | **+2 AC** nebo resistance na první zásah do začátku hráčova dalšího tahu; nepřítel útočí normálně |
| **Náklady** | žádný damage output v tom kole |
| **Omezení** | nelze kombinovat s Heavy v tom samém kole |
| **Balance** | situace flee/heal; snižuje spike damage z monster multiattack |
| **Test** | goblin 1d6+2 vs fighter; měřit průměrné HP loss s/bez defend |

## Kompatibilita

- **Proficiency / abilities:** Heavy a Aim používají stávající `attack_bonus`; Defend modifikuje AC field dočasně (jako cover).
- **Kouzla:** neovlivňuje slot economy.
- **Idempotence / SSE:** nové intenty musí projít `intent.py` + stejný ActionReceipt model.

## Implementační epic (po schválení)

1. Engine flagy + intent parsing  
2. UI chips v `sharedPlayUI` / combat banner  
3. Offline + paid narrator fact tags (`heavy_attack`, `aiming`)  
4. Vitest + pytest invarianty  

**V tomto sprintu neimplementovat.**
