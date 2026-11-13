# Sprint 38 — Test Boundaries & First Session

**Datum:** 2026-11-13  
**HEAD (commitnutý):** `38aa768` na `clean-main` (= `origin/clean-main`)  
**Working tree:** dirty (zachováno; **žádný commit/push**)  
**Inventura:** Uncommitted už obsahovalo opravu `completeBossViaEngine` (stabilize/long rest) a BW UI recovery — Sprint 38 na tom staví, nepřepisuje destruktivně.

---

## 1. Co bylo změněno

### Test boundaries
| Soubor | Změna |
|--------|--------|
| `tests/test_sprint38_engine_chapter_integration.py` | **Nový** engine-only chapter: bell → vault L3 → BW → persistence |
| `frontend/e2e/chapter-one-quest.spec.ts` | UI jen po **vault_unlocked**; **bez** `completeBossViaEngine` / vault grind; fail dump fází |
| `frontend/e2e/first-session.spec.ts` | **Nový** first-session UI (wizard → Overview → travel chip → mapa/shrine → Caldus → explore) |
| `frontend/e2e/bell-warden-ui.spec.ts` | Explicitní fixture vs UI boj; honest komentáře |
| `frontend/e2e/fallen.spec.ts` | Defeat recovery: hub CTA, revive, HP>0, composer |
| `frontend/e2e/chapter-one-e2e-helpers.ts` | Boss/UI smyčky ≤48 s progress; `sawDamage` jen při poklesu HP bosse; bandit ≤48; fail snapshot |
| `frontend/e2e/playwright.config.ts` | `retries: 0`; first-session + fallen v `chapter-journey`; smoke ignore |
| `frontend/e2e/run-tests.mjs` | Fáze: first-session → chapter-one UI → fallen → BW; `reapReservedE2eListeners` po cleanup |

### Produkt (minimální)
| Soubor | Změna |
|--------|--------|
| `frontend/src/GameScreens.tsx` | Overview při `hp<=0`: CTA **Revive hero** místo Continue |
| `frontend/src/i18n/gameDisplay.ts` | CS lokalizace travel/NPC/combat no-op hlášek |
| `frontend/src/i18n/gameDisplay.test.ts` | Vitest pro tyto řádky |
| `frontend/src/App.test.tsx` | Fallen hub CTA → Revive hero |
| `frontend/src/i18n.tsx` | `Back to Hub` → Zpět do přehledu |
| `tests/test_chapter_one_boss.py` | MVP defeat = 1 HP na hubu (ne `hp<=0`); návrat do Pit; progress stall |

---

## 2. Co každý test skutečně dokazuje

| Test | Kategorie | Dokazuje | Obchází / fixture |
|------|-----------|----------|-------------------|
| `test_sprint38_engine_chapter_integration` | A Engine | Celá kapitola + rewards + persistence | Žádné UI |
| `test_chapter_one_*` / `test_sprint37_3_1_*` | A Engine | Boss flag, low-HP engage, journey parts | UI |
| `chapter-one-quest.spec.ts` | B/C UI | Mapa + čipy Caldus/Nib/return → `vault_unlocked` | **Ne** vault L3, **ne** boss |
| `first-session.spec.ts` | B UI | Create, Overview, travel chip, map shrine, Caldus accept, explore | Vault/boss |
| `bell-warden-ui.spec.ts` | C Hybrid | Boss deck UI + skutečný pokles HP + flag + reload | Quest/vault přes engine fixture |
| `fallen.spec.ts` | D UI | Fallen modal, revive, HP>0, playable | `__e2e/fallen` fixture |

---

## 3. První session — co funguje / nefunguje

| Krok | Stav |
|------|------|
| Create → Adventure (sklep) | Funguje |
| Overview + MAIN QUEST | Funguje (nav Přehled) |
| Chip „Travel to Sunken Corridor“ / CS label | Funguje |
| Shrine hop bez mapy (jen chip v corridor) | **Nestabilní** — po travel často combat/jiné čipy → first-session používá **Map UI** |
| Caldus chip → `bell_quest_accepted` | Funguje |
| Explore / talk po questu | Funguje |
| Free-text EN reject | CS prezentace no-opů v journalu (minimální) |
| Defeat z Overview | CTA Revive → FallenScreen |

---

## 4. Otevřené

- `bell-warden-ui` dlouhý UI boj — neběžel v tomto sprintu jako mandatory green (hranice hotové; green vyžaduje samostatný cílený běh).
- `chapter-one-quest` UI po vault_unlocked — zkrácený; cílený běh v tomto sprintu ne (pytest engine pokrývá finále).
- Po corridor stále chybí spolehlivý **jeden** travel chip na svatyni bez mapy (produkt backlog).
- Full 7-phase matice **neběžela** (záměrně).

---

## 5. Git a testy

### Git
```
branch: clean-main @ 38aa768
dirty: ano (P1/P2 + Sprint 38 + dřívější untracked docs/logy)
commit/push: žádný
```

### Cílené běhy (tento sprint)

| Příkaz | Výsledek | Čas |
|--------|----------|-----|
| `.\.venv\Scripts\python.exe -m pytest tests/test_sprint38_engine_chapter_integration.py tests/test_chapter_one_boss.py tests/test_sprint37_3_1_bell_warden_e2e.py tests/test_chapter_one_journey.py -q` | **8 passed** | ~4.8 s |
| `cd frontend && npm run test -- --run src/i18n/gameDisplay.test.ts src/App.test.tsx` | **29 passed** | ~54 s |
| `cd frontend && node e2e/run-tests.mjs --project=chapter-journey e2e/first-session.spec.ts` | **PASS** | ~25 s (test ~6.8 s) |
| `cd frontend && node e2e/run-tests.mjs --project=chapter-journey e2e/fallen.spec.ts` | **PASS** | ~23 s (test ~5.2 s) |

---

## 6. Pořadí další práce

1. Cíleně `fallen.spec.ts` + `chapter-one-quest.spec.ts` (UI vault unlock).  
2. Cíleně `bell-warden-ui.spec.ts` (48-kolový progress loop).  
3. Produkt: spolehlivý shrine travel chip z chodby (bez nutnosti More→Map).  
4. Až short specs zelené → zvažovat CI fáze bez long retry.
