# CHAPTER_ONE_PLAYTEST_V1 — Průchod kapitolou a protokol closed beta

Podpůrný dokument k [`DICE_AND_ECONOMY_V1.md`](./DICE_AND_ECONOMY_V1.md).

**Cíl playtestu:** zda je hra **zábavná**, srozumitelná (kostky, zdroje), a zda hráč **chce pokračovat** — ne měřit ochotu platit (WTP).

**Velikost vzorku:** 10–15 hráčů (kvalitativní; žádné statistické závěry o ceně).

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
- [ ] 45–90 min blok bez přerušení ideálně.

---

## 2. Modelový průchod kapitolou (7 kroků)

| # | Kroky hráče | Očekávaný engine fact | Odměna | Poznámka |
|---|-------------|----------------------|--------|----------|
| 1 | Home → Continue | Načtení Cellar | — | Pochopení UI |
| 2 | Chip „Prohledat“ / `search` | Exploration D6 | gp/stopa/combat | První kostka |
| 3 | `travel to The Shrine of the Forgotten` | Změna lokace | — | Mapa volitelně |
| 4 | Talk Caldus / accept quest | `bell_quest_accepted` | — | NPC engine |
| 5 | Travel Market, ask Nib | `bell_acquired`, bell v inventáři | — | |
| 6 | Return bell → vault hint | XP+gp, `vault_unlocked` | 30 XP, 5 gp | |
| 7 | Vault → Pit → Bell Warden | Combat, chapter complete | XP, +25 gp | Boss |

**Volitelný side:** Forgotten Crypt search (1×) — 10 XP, 15 gp, Echo shard (mimo D6).

**Negativní cesty k pozorování:** flee, rest mimo combat, opakovaný search přes cooldown.

---

## 3. KPI a otázky po session

### 3.1 Hlavní KPI

| KPI | Otázka | Škála |
|-----|--------|-------|
| **Návrat** | „Otevřel bys hru zítra?“ | 0–10 NPS style |
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
| ≥70 % respondentů „zítra ano“ (8+/10) | Většina končí před quest accept |
| Většina chápe D6 explore | Systematické myšlení „Mana = kouzla“ |
| Bell Warden dosažen u ≥50 % | Frustrace z DC/combat bez pochopení |

Po **go:** E2 (tier default), E2b (billing), E3 (dice), playtest round 2.

---

## 6. Bezpečnost a scope

- Žádné platby, žádné admin top-up pro hráče.
- Nešířit admin tokeny.
- Reportovat P0 bugy mimo tento protokol.
