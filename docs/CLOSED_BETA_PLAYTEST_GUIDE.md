# Closed Beta Playtest Guide — Chapter One

**Verze:** 1.1 (Sprint 37.1)  
**Cíl:** ověřit, že nový hráč bez vývojářské pomoci projde počátek hry a hlavní Chapter One linku.

**Stav protokolu:** **PENDING EXECUTION** — výsledky zatím nejsou k dispozici.

---

## Kdo testuje

- **3–5 testerů** (různá zařízení pokud možno: min. 1× Android, 1× iOS).
- **Bez** sdíleného vývojářského taháku během první hodiny.
- Facilitátor pouze při eskalaci (P0 bug).

---

## Před startem (organizátor)

1. Nasadit **staging HTTPS** Mini App (viz `STAGING_RUNBOOK_V1.md`).
2. V Telegramu otevřít oficiální beta bot / odkaz (ne lokální `localhost`).
3. Připravit formulář pro feedback (volný — Notion/Sheets).
4. Nastavit **Lite** jako výchozí tier (doporučeno pro první kola).

---

## Session A — Všichni (45–90 min)

Každý tester:

| # | Úkol | Co sledovat |
|---|------|-------------|
| A1 | Otevřít app z Telegramu poprvé | Načtení, jazyk EN/CS, žádný crash |
| A2 | Vytvořit **novou** postavu (libovolná z 4 ras × 4 tříd) | Validace formuláře, mobilní ovládání jednou rukou |
| A3 | Přečíst sheet, vstoupit do **Hry** | Jasná lokace (Whispering Cellar) |
| A4 | Prozkoumat / `look around` / travel na **Sunken Corridor** | Journal, quest hint |
| A5 | Najít **Caldus / bell quest**, přijmout | Quest strip, chipy |
| A6 | Cesta na **Goblin Market**, dialog s **Nib**, získat zvon | gold, inventory |
| A7 | Návrat ke **Shrine**, odevzdat zvon | **+10 gp, +30 XP**, flag dokončení |
| A8 | **Min. 1 boj** (attack goblin / explore encounter) | HP, combat actions, konec tahu |
| A9 | Použít **třídní schopnost** (viz níže) | Bonus/action economy srozumitelná |
| A10 | **Reload** (zavřít a znovu otevřít Mini App) | Postava, quest flags, journal |
| A11 | Pokračovat ještě **15 min** volné hraní | Kde se zasekne? |

### Třídní schopnost (A9)

| Třída | Doporučená akce |
|-------|------------------|
| Fighter | `second wind` v boji |
| Rogue | `hide` nebo `dash` (L2+) |
| Cleric | `cast Healing Word` nebo Preserve Life (L2+) |
| Wizard | `cast Fire Bolt` nebo `Magic Missile` |

---

## Session B — Jeden „main path“ tester (2–4 h)

Stejný tester (nebo zkušenější):

1. Dokončit **vault unlock** (Caldus chip po bell quest).
2. Dosáhnout **úroveň 3+** (běžná hra — boss gate).
3. Cestovat do **Bell Warden's Pit**.
4. Porazit **Bell Wardena**.
5. Ověřit **dokončení kapitoly** (journal, quest stav, `chapter_one_complete` sentiment).
6. Zkontrolovat odměny (gold, XP) — **žádné dvojité payouty** po reloadu.

Volitelně: Crypt relic, Bandit Camp (není povinné pro betu).

---

## Session C — Narration (volitelné, 15 min)

| Tier | Test |
|------|------|
| **Lite** | Všechny akce — žádný ⚡ poplatek, hra hratelná offline |
| **Normal** | Pokud staging má providera — 2 akce; při výpadku **fallback** bez ztráty ⚡ |

---

## Záznam průběhu (každý tester, i bez bugu)

| Pole | Otázka |
|------|--------|
| Kde se zasekl? | Lokace / obrazovka / quest krok |
| Co očekával? | Jedna věta |
| Co se stalo? | Jedna věta |
| Ztratil postup po reloadu? | ano / ne |
| Příběh srozumitelný? | 1–5 |
| Bavilo to? | 1–5 |

Uložit do sdíleného sheetu / Notion (kanál bety — doplnit před startem).

## Co zapisovat (každý bug)

1. **Krok** (co jste chtěli udělat).
2. **Očekávání** vs **skutečnost**.
3. **Třída / level / lokace**.
4. **Screenshot** nebo export journalu (pokud lze).
5. **Ztráta postupu:** ano / ne.
6. **Závažnost:** P0 / P1 / P2 / P3 (viz `SPRINT_37_CLOSED_BETA_READINESS.md`).

---

## Známé limity (nehlásit jako bug)

- Wizard **Arcane Tradition** — **COMING LATER** (není mechanika).
- Cleric **domény** mimo Life — MVP Life domain.
- Většina SRD kouzel v knize — **katalog**, ne všechna hratelná.
- **Pro** narrator tier — vypnutý.
- Ko-op / multiplayer — **OUT OF SCOPE**.

---

## Kritéria úspěchu playtestu

- ≥ **80 %** testerů dokončí Session A bez P0/P1 blokace.
- ≥ **1** tester dokončí Session B (Bell Warden + chapter complete).
- Žádný P0 (data loss, billing bez doručení, auth bypass).
- Facilitátor může sepsat **shrnutí** do `SPRINT_37_CLOSED_BETA_READINESS.md` §8 (VERIFIED).

---

## Nahlášení

- Interní: issue tracker / Discord kanál bety (doplňte kanál před startem).
- **Neposílejte** tokeny, `initData`, ani `.env` v reportech.
