# Sprint 38 — Prioritized UX backlog

**Baseline:** `188f187` @ `clean-main`  
**Source:** Code review + E2E coverage map (not physical Telegram).  
**Historical audits:** `docs/PRODUCT_UX_AUDIT_V1.md` (2026-11-09) — **do not treat as current truth**.

Priority legend:

| Level | Meaning |
|-------|---------|
| **P0** | Progress loss, broken critical path, security |
| **P1** | Player cannot understand or finish a common activity |
| **P2** | Výrazné zhoršení zážitku |
| **P3** | Polish / cosmetics |

---

## P0 — None confirmed by static audit @ `188f187`

| ID | Area | Note |
|----|------|------|
| — | — | Idempotency, auth gate, and character persistence covered by pytest/CI. **Re-open only** if staging smoke or device QA finds data loss. |

---

## P1

### UX-38-P1-01 — Opening coaching not shown on Play

| | |
|---|---|
| **Area** | Adventure / Overview |
| **Evidence** | `scenePrompt()` in `frontend/src/game/gameActions.ts` is exported but **not wired** in `AdventureScreen` / `sharedPlayUI`. |
| **Player impact** | After bell quest acceptance, new players rely on chips alone; easy to miss Caldus → cellar → vault → pit sequence without opening Quests. |
| **Automated test** | Partial — `chapter-one-quest.spec.ts` drives engine; does not assert visible coaching copy. |
| **Fix direction** | Render compact coaching strip when `scenePrompt` non-empty; link to Quests active step. **No new mechanics.** |

### UX-38-P1-02 — Tools: missing “Dostupná” (available spells) tab

| | |
|---|---|
| **Area** | Tools |
| **Evidence** | `ToolsScreen.tsx` — tabs: My spellbook, Rules, SRD, Combat balance. ROADMAP item still open. i18n directs “available spells” to **Play**, not Tools. |
| **Player impact** | Casters cannot compare “known vs castable now” in one reference screen during planning. |
| **Fix direction** | Add tab listing `prepared_spells` / slot availability (read-only); keep cast actions on Play/Combat. |

### UX-38-P1-03 — Narrator credits error UX

| | |
|---|---|
| **Area** | Adventure / Settings |
| **Evidence** | `App.tsx` — HTTP **402** navigates to Settings. |
| **Player impact** | On Normal tier without credits, turn failure feels like “kicked out of game” instead of inline explanation. |
| **Fix direction** | Modal on Play with Lite fallback hint; keep Settings as secondary. **No payment UI.** |

### UX-38-P1-04 — Bell Warden / chapter gate discoverability

| | |
|---|---|
| **Area** | Quests / Map / Combat |
| **Evidence** | Boss chips gated in `gameActions.ts` (level ≥ 3, pit, not complete). E2E passes with helpers; human path depends on Quest screen or chips. |
| **Player impact** | Players at L2 may not know why pit travel is blocked. |
| **Fix direction** | Quest chronicle shows explicit “Reach level 3” objective; map tooltip on locked pit route. |

### UX-38-P1-05 — Telegram BackButton vs “More” hub

| | |
|---|---|
| **Area** | Telegram chrome |
| **Evidence** | `MORE_HUB_SCREENS` in `types.ts` omits `quests` (and consistency with `map`/`journal`). |
| **Player impact** | Back from Quests returns to Play, not More — breaks menu mental model. |
| **Fix direction** | Add `quests` (and audit `journal`) to hub set; align with `TELEGRAM_MOBILE_QA` expectations. |

### UX-38-P1-06 — First open auth confusion

| | |
|---|---|
| **Area** | Telegram |
| **Evidence** | In-Telegram path can still show browser login affordances when `initData` present (per prior mobile QA docs). |
| **Player impact** | Duplicate login paths on first launch. |
| **Fix direction** | Hide browser registration when `WebApp.initData` valid; single Telegram identity path. |

---

## P2

### UX-38-P2-01 — Combat vs Adventure journal split

Combat beats in `CombatMoment`; full chronicle on Adventure/Journal screens. Players may not find recent combat narration in Journal tab during fight.

### UX-38-P2-02 — Map locked routes without “why”

`MapScreen` gates routes via `quest_flags` but limited in-map explanation for fogged edges.

### UX-38-P2-03 — Quest location strings vs Czech display

Some quest CTAs use English location fragments; map uses `displayLocation` catalog.

### UX-38-P2-04 — Character sheet out of combat loop

No quick sheet link from `CombatUI`; inventory changes require leaving fight UI.

### UX-38-P2-05 — Hub hero roster thin

Home shows active hero only; switching heroes requires Character tab — acceptable but unclear for multi-character accounts.

### UX-38-P2-06 — Tools tab clutter (SRD + calculator)

Fourth tab mixes reference with power-user calculator; overwhelms “field guide” goal.

### UX-38-P2-07 — Physical layout unverified

Safe-area CSS exists (`env(safe-area-inset-*)`, `--app-safe-top`); keyboard overlap on real devices **NOT TESTED**.

---

## P3

- Cosmetic journal typography / filter defaults  
- Campaign screen stub redirect only  
- Referral / `startapp` deep links not in frontend  
- English quest pulse strings on Czech UI in edge cases  

---

## Verified strengths (do not regress)

| Area | Evidence |
|------|----------|
| **Combat** | Action economy strip, End turn (P0.2), reactions E2E, ghoul paralysis UI |
| **Character** | Creation v2 wizard, equip, potion use, level-up modal |
| **Persistence** | Idempotent actions, SSE turn flow, Vitest + E2E reload paths |
| **Chapter One arc** | Bell Warden UI E2E, `chapter_one_complete` flag |
| **Lite narration** | Free offline narrator; no payment gateway |

---

## Mapping to Alpha 1.0 goal

| Alpha criterion | Backlog linkage |
|-----------------|-----------------|
| Understand situation | P1-01, P1-04 |
| Play & fight | Combat OK; P2-01 journal |
| Progress & save | Engineering OK; staging unverified |
| Return willingly | Needs player playtest after P1 UX + staging |
