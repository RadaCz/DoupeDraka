# Sprint 38 — Proposed implementation sprint (Sprint 39)

**Prerequisite:** Staging deploy per [`SPRINT_38_STAGING_CHECKLIST.md`](SPRINT_38_STAGING_CHECKLIST.md) on `188f187+`.  
**Out of scope:** Billing E, v006, multiplayer, new classes/races, SRD expansion, payments.

**Goal:** Close **P1 UX** gaps so first human playtest on Telegram can succeed without facilitator coaching.

---

## Sprint 39 scope (recommended)

| Work package | Backlog IDs | Effort | Acceptance |
|--------------|-------------|--------|------------|
| **39.1 Play coaching strip** | P1-01, P1-04 | S | `scenePrompt` visible when non-empty; quest link; Vitest snapshot or unit on prompt selection |
| **39.2 Tools “Dostupná” tab** | P1-02 | M | New read-only tab: prepared spells + slot counts; no duplicate cast pipeline |
| **39.3 402 inline UX** | P1-03 | S | Play modal on 402; tier explanation; optional “switch to Lite” if API allows |
| **39.4 Telegram navigation** | P1-05, P1-06 | S | `quests` in `MORE_HUB_SCREENS`; hide browser login when `initData` present |
| **39.5 Device QA execution** | Protocol TG-* | Ops | Fill `SPRINT_38_TELEGRAM_QA_PROTOCOL.md` on Android + iOS |
| **39.6 Playtest pack** | — | Docs | 3–5 testers, `CLOSED_BETA_PLAYTEST_GUIDE.md`, facilitator script |

**Effort:** S ≈ 0.5–1 day, M ≈ 1–2 days (single developer).

---

## Sprint 39 — Non-goals

- Engine rule changes  
- New locations or quests  
- Normal tier provider integration (separate sprint after Lite playtest)  
- Committing Billing E  

---

## Test plan (Sprint 39 code)

| Layer | Command |
|-------|---------|
| Regression | `python -m pytest -m "not slow" -q` |
| Frontend | `cd frontend && npm run test -- --run && npm run typecheck && npm run build` |
| Targeted E2E | `chapter-one-quest.spec.ts`, `bell-warden-ui.spec.ts` if coaching touches chips |
| Physical | Mandatory subset TG-01–03, 20–22, 60–61, 90–92 on staging |

---

## Release gate after Sprint 39

1. Staging smoke checklist §7 **PASS**  
2. Physical QA minimum set **PASS** both platforms  
3. GitHub CI green on merge commit  
4. Facilitator-led playtest: **≥3** testers complete bell arc or document blocking P1  
5. **Then** tag `alpha-1.0-rc1` (proposal only — requires user approval)

---

## Parallel track (ops — not dev)

| Task | Owner |
|------|-------|
| Provision VPS + DNS + TLS | Operator |
| First staging deploy | Operator + checklist |
| BotFather menu URL | Operator |
| Tester invites | Product |

---

## If staging blocked

Sprint 39 can start **39.1–39.4** against local HTTPS tunnel (`ngrok`) for **developer** smoke only — still **not** a substitute for § staging checklist + device protocol.
