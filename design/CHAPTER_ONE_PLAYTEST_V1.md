# CHAPTER_ONE_PLAYTEST_V1 — Průchod kapitolou a protokol closed beta

Podpůrný dokument k [`DICE_AND_ECONOMY_V1.md`](./DICE_AND_ECONOMY_V1.md).

**Cíl playtestu:** zda je hra **zábavná**, srozumitelná (kostky, zdroje), a zda hráč **chce pokračovat** — ne měřit ochotu platit (WTP).

**Velikost vzorku:** 10–15 hráčů (kvalitativní; žádné statistické závěry o ceně).

**Dva časové rámce (neplest):**

| Rámec | Délka | Co měříme |
|-------|-------|-----------|
| **První session (closed beta slot)** | **45–90 min** | UX, kostky, zdroje, chuť pokračovat — KPI níže |
| **Úplný průchod kapitolou 1** | typicky **~2 h** (viz `ECONOMY_MODEL_V1.md` §3.2) | Bell Warden, ekonomická rovnováha — **nemusí** vstoupit do jedné session playtestu |

Playtest protokol primárně hodnotí **první session**; dokončení celé kapitoly je bonusový signál, ne povinnost v jednom sedu.

---

## 1. Příprava

### 1.1 Build a prostředí

- Větev `clean-main` (nebo release candidate po merge).
- Telegram Mini App na reálném telefonu (Android / iOS).
- Instrukce v **češtině** (UI locale `cs`).

### 1.2 Výchozí režim vypravěče (cíl bety)

**Cíl specifikace:** hráč začíná na **Lite** (bez útraty kreditů).  
**As-is:** může být uložen **Normal** — facilitator před startem:

1. Nastavení → vypravěč → **Lite** (nebo v budoucnu E2 default).
2. Vysvětlit: ⚡ = **kredity vypravěče**, ne mana kouzelníka.

### 1.3 Facilitator checklist

- [ ] Hráč má Telegram a otevře bota.
- [ ] Vytvoří nebo vybere postavu (fighter/wizard smoke OK).
- [ ] Lite tier potvrzen.
- [ ] **45–90 min** první session (úplná kapitola ~2 h je volitelný follow-up).

---

## 2. Modelový průchod kapitolou (referenční kroky)

*Kompletní řetězec ~2 h; v první session 45–90 min často končí dříve — to je očekávané.*

| # | Kroky hráče | Očekávaný engine fact | Odměna | Poznámka |
|---|-------------|----------------------|--------|----------|
| 1 | Home → Continue | Načtení Cellar | — | Pochopení UI |
| 2 | Chip „Prohledat“ / `search` | Exploration D6 | gp/stopa/combat | První kostka |
| 3 | `travel to The Shrine of the Forgotten` | Změna lokace | — | Mapa volitelně |
| 4 | Talk Caldus / accept quest | `bell_quest_accepted` | — | NPC engine |
| 5 | Travel Market, ask Nib | `bell_acquired`, bell v inventáři | — | |
| 6 | Return bell (`return_bell`) | `bell_quest_complete` | 30 XP, 5 gp | **Jen** vrácení zvonu |
| 7 | Talk Caldus znovu (`accept_caldus`) | `vault_hint_given`, `vault_unlocked` | — | Vault route — **samostatný** krok po §6 |
| 8 | Vault → Pit → Bell Warden | Combat, `chapter_one_complete` | boss XP + 25 gp | Boss; často až mimo první 45–90 min |

**Volitelný side:** Forgotten Crypt search (1×) — 10 XP, 15 gp, Echo shard (mimo D6).

**Negativní cesty k pozorování:** flee, rest mimo combat, opakovaný search přes cooldown.

---

## 3. KPI a otázky po session

### 3.1 Hlavní KPI

| KPI | Otázka | Škála |
|-----|--------|-------|
| **Return intent** | „Otevřel bys hru zítra / v příštích dnech?“ (ochota pokračovat) | nízká / střední / vysoká + volitelně 0–10 jako **ilustrace**, ne NPS benchmark |
| **Kostky** | „Chápal jsi, proč něco vyšlo / nevyšlo?“ | ano / částečně / ne |
| **Zdroje** | „Víš rozdíl mezi kouzly (sloty) a ⚡?“ | ano / ne |
| **Tempo** | Kde ses nudil / ztratil? | volný text |

### 3.2 Doplňkové (Lite vs Normal)

Pouze pokud je nakonfigurován **online AI provider**:

- Krátká session A: Lite  
- Krátká session B: Normal (stejný hráč jindy)  
- „Cítil jsi rozdíl v próze? Stálo to za kredit?“ — **kvalitativně**, ne pricing.

### 3.3 Co playtest **neprokazuje**

- Ochotu platit 49/99/149 Kč  
- Dlouhodobou retenci na stovkách uživatelů  
- Přesné AI náklady  

---

## 4. Sběr dat

| Kanál | Co |
|-------|-----|
| Dotazník (5 min) | KPI tabulka |
| Facilitator notes | Drop-off krok, bugy, confusion |
| Server logy (volitelně) | `analytics_events`, fallback rate |

Doporučené eventy ke kontrole po session: `death`, `level_up`, `llm_fallback_triggered`.

---

## 5. Kritéria úspěchu (go / no-go před implementačními epicemi)

| Go | No-go |
|----|-------|
| Většina respondentů s **vysokým return intent** po první session | Většina končí před quest accept / ztracená v UI |
| Většina chápe D6 explore | Systematické myšlení „Mana = kouzla“ |
| Bell Warden u **dokončivších** kapitolu — bonus, ne povinný v 45–90 min | Frustrace z DC/combat bez pochopení |

Po **go:** pokračovat pořadím E1 → E2 → E2b → minimální telemetrie → **další kolo playtestu** → E3, E4; **E6 / platby** až po validaci produktu (`ROADMAP.md`).

---

## 6. Bezpečnost a scope

- Žádné platby, žádné admin top-up pro hráče.
- Nešířit admin tokeny.
- Reportovat P0 bugy mimo tento protokol.
