# ECONOMY_MODEL_V1 — Model odměn, session a nákladů vypravěče

Podpůrný dokument k [`DICE_AND_ECONOMY_V1.md`](./DICE_AND_ECONOMY_V1.md). **Neobsahuje vymyšlené přesné AI náklady** — jen strukturované scénáře a kategorie jistoty.

---

## 1. Čtyři kategorie čísel

| Kategorie | Význam | Příklad |
|-----------|--------|---------|
| **Známé (engine / API)** | Ověřeno v kódu | Lite 0 / Normal 1,0 / Pro 1,4 kreditu; start 100 kreditů |
| **Modelové předpoklady** | Odhad pro plánování | 60 % tahů mění stav; 40 % z nich u aktivního hráče |
| **Dosud neměřené** | Chybí telemetrie | Tokeny/tah, model mix, délka streamu, fallback rate |
| **Budoucí telemetrie** | Co logovat před monetizací | Viz §5 |

---

## 2. Známé hodnoty — herní ekonomika

### 2.1 XP a level

| Položka | Hodnota |
|---------|---------|
| XP na level | 100 |
| Max level-up / turn | 1 (D25) |
| Hard XP multiplier | ×1,35 na `reward_xp` |

### 2.2 Odměny (referenční tabulka)

| Zdroj | XP | Gold | Poznámka |
|-------|-----|------|----------|
| Goblin | 50 | — | |
| Kobold | 35 | — | |
| Skeleton | 50 | — | |
| Bell Warden | 180 | — | Chapter boss |
| Caldus bell return | 30 | 5 | |
| Forgotten Crypt (1×) | 10 | 15 | + Echo shard |
| Chapter complete | — | 25 | Po bossovi |
| Explore D6=3 | — | 1–4 | 1d4 |

### 2.3 Obchod (Goblin Market)

| Položka | Cena (gp) |
|---------|-----------|
| Healing Potion | 50 |
| Shortsword +1 | 100 |

### 2.4 Kredity vypravěče (účet)

| Tier | Kredit / změněný tah |
|------|----------------------|
| lite | 0 |
| normal | 1,0 |
| pro (cena) | 1,4 — tier nedostupný v API |

| Balíček (admin top-up) | Kredity | Cena v kódu |
|------------------------|---------|-------------|
| starter | 50 | 100 RUB (není produkční prodej) |

**Sdílení:** jeden účet Telegram — jeden pool kreditů pro všechny postavy.

---

## 3. Modelové session scénáře (30 min / 2 h)

*Předpoklady: aktivní hráč, kapitola 1, mix explore/travel/quest/combat.*

### 3.1 ~30 minut (orientační)

| Metrika | Předpoklad | Rozmezí playtest |
|---------|------------|------------------|
| Počet tahů | 25–40 | měřit |
| Boje | 1–2 (D6 nebo scripted) | |
| XP získané | 35–130 | závisí na combat + quest |
| Gold získané | 5–25 (bez shop) | + explore 1–4 |
| Úroveň | 1 (možná 2 po Caldus) | |
| Kredity spotřebované (Normal, všechny tahy platné) | 0–40 | **0 pokud Lite** |

### 3.2 ~2 hodiny (dokončení kapitoly)

| Metrika | Předpoklad |
|---------|------------|
| Tahy | 80–140 |
| Boje | 3–6 včetně Bell Warden |
| XP | 250–400+ (boss + quest + boje) |
| Gold | 40–80+ (quest, chapter, explore, Crypt) |
| Úroveň | 2–3 typicky |
| Nákup | Potion (50) nebo šetření na Shortsword (100) |

### 3.3 Rizikové rovnováhy (sledovat v playtestu)

| Riziko | Signál |
|--------|--------|
| Příliš mnoho zlata, nothing to buy | >150 gp bez dalších výdajů |
| Příliš málo zlata | Nemůže koupit potion po 2+ bojích |
| XP grind | Opakovaný farm D6 bez quest progresu |
| Kredit confusion | Mytí spell slot / kredit / legacy mana |

---

## 4. Náklady vypravěče a zisk na hráče

### 4.1 Vzorec (symbolický)

```
Zisk_na_hráče = Příjem - Náklady_AI - Provoz - Poplatky
```

Všechny vstupy kromě **flat cost per tier** jsou dnes **hypotézy nebo neměřené**.

### 4.2 Scénáře 100 / 500 / 1000 tahů

**Účel:** plánovací stůl — **ne** účetní závěr.

| Scénář | Předpoklad | Kredity při Normal (všechny platné) |
|--------|------------|-------------------------------------|
| 100 tahů | 60 % state_changed | až 60 kreditů |
| 500 tahů | stejné | až 300 kreditů |
| 1000 tahů | stejné | až 600 kreditů |

**Lite:** vždy 0 kreditů za tah bez ohledu na počet.

**Poznámka k nesrovnalosti as-is:** pokud hráč platí při fallbacku, **reálná spotřeba kreditů ≠ užitná hodnota** — opravit v E2b před monetizací.

### 4.3 Neměřené (dnes)

- Průměrné tokeny vstup/výstup na tah (Normal vs Lite offline)
- Podíl `llm_fallback_triggered` vs úspěšných streamů
- Průměrná délka `result` textu / journal entry
- Náklady per provider (Ollama local vs OpenRouter model X)

### 4.4 Hypotézy cen (validace mimo playtest 10–15)

| Hypotéza balíčku | CZK | Co by hráč mohl dostat (ilustrativně) | Stav |
|------------------|-----|----------------------------------------|------|
| H1 | 49 | ~30–50 kreditů nebo 1 měsíc Lite+ | k ověření průzkumem / landing |
| H2 | 99 | ~80–120 kreditů nebo Normal měsíc | k ověření |
| H3 | 149 | Kapitola 2 unlock + bonus kreditů | k ověření |

**Playtest 10–15 hráčů neprokáže WTP** statisticky — jen kvalitativní signály (zda vůbec rozumí hodnotě prémiové narace).

---

## 5. Požadovaná budoucí telemetrie

| Event / pole | Proč |
|--------------|------|
| `turn_narration` + `tier` + `state_changed` | Nákladový model per tier |
| `prompt_tokens`, `completion_tokens` (pokud dostupné) | Reálný AI cost |
| `narration_outcome`: `stream_ok` / `fallback` / `interrupted` | Billing policy E2b |
| `energy_charged_tenths` per turn | Audit vs refund |
| `session_duration`, `turns_per_session` | Retence |

Existující: `character_created`, `level_up`, `purchase`, `death`, `llm_fallback_triggered`, `llm_narration` (`analytics_events`).

---

## 6. Odkazy

- Hlavní spec: `DICE_AND_ECONOMY_V1.md`
- Playtest: `CHAPTER_ONE_PLAYTEST_V1.md`
- Kód: `app/engine/economy.py`, `app/api.py`, `app/engine/shop.py`, `app/engine/quests.py`
