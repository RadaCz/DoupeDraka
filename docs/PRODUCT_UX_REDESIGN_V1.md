# PRODUCT UX REDESIGN V1 — Report

**Datum:** 2026-11-09  
**Branch:** `clean-main` · **HEAD:** `cebbe66`  
**Stav:** Fáze 0 dokončena · Fáze 1–2 částečně implementovány · Fáze 3–8 převážně návrh

---

## 1. Původní problémy a příčiny

| Problém | Příčina |
|---------|---------|
| Hráč neví, co dělat po otevření | Hub = statistiky + CTA, chybí poslední beat a krok úkolu |
| Duplicity | Iterativní sprinty (UI-1…6) přidávaly zkratky bez čištění starých cest |
| Deník „technický“ | Engine fakta v `event.result`; UI je odděluje, ale nefiltruje |
| Mapa „není mapa“ | Chybí serverový layout; client graph je jediná možnost bez migrace |
| Kouzla matoucí | SRD katalog ≠ modeled efekty; slabý empty state |
| Pozvánka „nefunguje“ | Custom onClick místo `shareText`; žádný backend referral |
| Boj flat | Stejný journal layout; explore chip vždy dominantní |

Detail: [`PRODUCT_UX_AUDIT_V1.md`](./PRODUCT_UX_AUDIT_V1.md).

---

## 2. Nová informační architektura (cíl)

**Spodní navigace (4 taby):**

1. **Overview** (Přehled) — kampaň domů: aktivní hrdina, poslední beat, hlavní úkol, **Continue adventure**, zkratky Map/Quests  
2. **Adventure** (Hra) — scéna, journal, kontextové akce, composer  
3. **Character** (Postava) — sheet, inventář, kouzla; přepínání hrdinů **jen zde**  
4. **More** (Více) — mapa, úkoly, deník, nastavení, pravidla/kouzla, kampaň, pozvánka, další hrdina  

Žádná funkce by neměla mít tři vstupy bez důvodu — mapa/úkoly zůstávají na Hub jako zkratky + v More jako plné menu.

---

## 3. Co bylo opraveno / implementováno (tento sprint)

| Oblast | Změna |
|--------|--------|
| Hub | `hub-campaign-pulse`: hlavní úkol + poslední próza (`latestSceneNarration`) |
| Hub | Odstraněn roster „Other adventurers“ a invite karta |
| Hub | Presety jen bez aktivní postavy |
| More | Úkoly v menu, `InviteShareCard`, „Create another adventurer“ |
| Character | Odstraněna duplicitní záložka Quests; odkaz „Quest log“ |
| Character | Spell empty state (caster vs non-caster) + odkaz na Tools |
| Journal | Filtry All/Story/Combat/Quest, scrollovatelný kontejner |
| Play | `primaryPlayChipKey` — zvýraznění kontextové akce |
| Nav | Přejmenování Hub/Play → Overview/Adventure (i18n CS) |
| Pozvánka | `shareText` + kopírování + upřímný copy o chybějícím referralu |

**Beze změny:** engine, API kontrakty, billing, combat pravidla.

---

## 4. Co je pouze návrh (dokument / neimplementováno)

- **Bojové UI V2** — samostatný enemy panel, oddělený combat action bar (viz `design/miniapp-screens.md` Sprint 4)  
- **Deník V2** — serverové kategorie beatů, quest timeline API  
- **Mapa fantasy ilustrace** — vizuální směr Fáze 8  
- **Settings split** — Účet vs Kampaň jako dvě root obrazovky  
- **Tools: Moje / Dostupná / Pravidla** — tři taby  
- **Heavy / Aim** — `design/COMBAT_TACTICS_PROPOSAL_V1.md` only  

---

## 5. Backendová práce (požadavky)

Viz [`design/BACKEND_UX_GAPS_V1.md`](../design/BACKEND_UX_GAPS_V1.md):

- Quest pin na mapě (`quest_step.location` → highlight node)  
- Journal taxonomy (optional `event_kind` v DB)  
- Referral / `startapp` attribution  
- Map layout z reference (x,y) pro konzistenci klientů  

**Nevyrábět** fake UI bez těchto dat.

---

## 6. Ne funkční / nedostupné

- Pro narration tier  
- Platby a top-up v UI  
- Referral odměny  
- Multiplayer  
- Plný SRD spell progress mimo engine  

---

## 7. Změněné soubory (tento sprint)

**Docs:** `docs/PRODUCT_UX_AUDIT_V1.md`, `docs/PRODUCT_UX_REDESIGN_V1.md`, `design/BACKEND_UX_GAPS_V1.md`, `ROADMAP.md`

**Frontend:** `GameScreens.tsx`, `App.tsx`, `sharedPlayUI.tsx`, `gameActions.ts`, `types.ts`, `journalCategories.ts`, `components/InviteShareCard.tsx`, `styles/polish/layout.css`, `i18n.tsx`, `App.test.tsx`

**Testy:** `journalCategories.test.ts`, `gameActions.primaryChip.test.ts`

(+ dřívější safe-area / narration soubory z immersion sprintu v working tree)

---

## 8. Testy

| Sada | Stav (po implementaci) |
|------|------------------------|
| pytest | spustit `python -m pytest -q` |
| Vitest | spustit `npm run test:run` |
| build | `npm run build` |
| E2E | `npm run test:e2e` |

Automatické testy **nedokazují** kvalitu gameplaye na telefonu.

---

## 9. Manuální ověření (Telegram Android / iOS)

- [ ] Overview: vidím beat + úkol + Continue  
- [ ] Přepnutí hrdiny jen na Character  
- [ ] More: pozvánka sdílí / kopíruje  
- [ ] Journal: scroll, filtry  
- [ ] Play: jiný zvýrazněný chip při Caldus / boji / odpočinku  
- [ ] Safe area (P0 z předchozího sprintu)  
- [ ] Normal tier při vypnutém provideru → Lite fallback  

---

## 10. Verdikt pro interní testery

**NOT READY** pro širokou closed beta z čistě UX důvodů, dokud není:

1. Telefonní QA (safe area, keyboard, invite v reálném Telegramu)  
2. Dokončení bojového layoutu a Tools spell tabs (P1)  
3. Produktové sign-off GDS01  

**READY** pro **úzký** design/playtest sprint (5–8 lidí) s checklistem výše a jasným scope kap. 1.

---

## Implementační podfáze (doporučené pořadí)

1. ✅ Navigace + Hub dedup (tento commit)  
2. Journal V2 + Play journal sjednocení  
3. Tools spell IA + Character inventář karty  
4. Combat layout (bez nových mechanik)  
5. Settings / Campaign merge  
6. Map quest pins (po backend gap)  
7. Vizuální polish mapy  
