# Sprint 38 — Physical Telegram QA protocol

**Purpose:** Exercise the Mini App on **real Android and iOS** clients.  
**Environment:** HTTPS **staging** only (`MINI_APP_URL` from staging checklist) — not `localhost`, not Playwright.  
**Baseline build:** `188f187` or newer `clean-main` with green CI.  
**Lite mode:** `LLM_PROVIDER=fallback` unless Normal smoke is explicitly scoped.

**Legend:** `PASS` | `FAIL` | `NOT TESTED`  
**Default for all rows below:** **NOT TESTED** until a human records result.

Record template per session:

| Field | Value |
|-------|-------|
| Date | |
| Tester | |
| Device model | |
| OS version | |
| Telegram app version | |
| Staging URL | |
| Git SHA | |
| UI locale | CS / EN |

---

## A. Launch & session

| ID | Scenario | Steps | Android | iOS |
|----|----------|-------|---------|-----|
| TG-01 | Open Mini App from bot menu | Bot → Menu button → app loads | NOT TESTED | NOT TESTED |
| TG-02 | Cold start (kill Telegram, reopen) | Force-stop → open bot → Mini App | NOT TESTED | NOT TESTED |
| TG-03 | Telegram auth (no browser form) | Fresh Telegram user → auto session | NOT TESTED | NOT TESTED |
| TG-04 | Safe area / notch | Status bar not overlapping hub title | NOT TESTED | NOT TESTED |
| TG-05 | Theme sync | Toggle Telegram dark/light → app readable | NOT TESTED | NOT TESTED |

---

## B. Character creation

| ID | Scenario | Steps | Android | iOS |
|----|----------|-------|---------|-----|
| TG-10 | New hero wizard | Create → complete 9-step flow | NOT TESTED | NOT TESTED |
| TG-11 | Quick / preset path | Quick generate → enter Play | NOT TESTED | NOT TESTED |
| TG-12 | Czech UI | Set CS → labels with diacritics on wizard | NOT TESTED | NOT TESTED |

---

## C. First exploration & adventure

| ID | Scenario | Steps | Android | iOS |
|----|----------|-------|---------|-----|
| TG-20 | First průzkum turn | Type or chip action → journal updates | NOT TESTED | NOT TESTED |
| TG-21 | MainButton send | Draft in composer → MainButton sends | NOT TESTED | NOT TESTED |
| TG-22 | Keyboard | Open keyboard → composer visible, nav usable | NOT TESTED | NOT TESTED |
| TG-23 | SSE / slow narration | Turn completes; no stuck pending spinner | NOT TESTED | NOT TESTED |

---

## D. Map & travel

| ID | Scenario | Steps | Android | iOS |
|----|----------|-------|---------|-----|
| TG-30 | Open map from nav | More → Map → render | NOT TESTED | NOT TESTED |
| TG-31 | Travel legal node | Tap unlocked location → state changes | NOT TESTED | NOT TESTED |
| TG-32 | Locked route feedback | Tap fogged edge → understand why | NOT TESTED | NOT TESTED |

---

## E. Chapter One quest spine

| ID | Scenario | Steps | Android | iOS |
|----|----------|-------|---------|-----|
| TG-40 | Caldus / bell quest | Talk chips → accept bell quest | NOT TESTED | NOT TESTED |
| TG-41 | Vault / descent | Reach vault arc via play + travel | NOT TESTED | NOT TESTED |
| TG-42 | Quest screen | Quests → active objective readable | NOT TESTED | NOT TESTED |
| TG-43 | Bell Warden boss | Pit fight → victory → `chapter_one_complete` equivalent UX | NOT TESTED | NOT TESTED |

---

## F. Nib, inventory, gear

| ID | Scenario | Steps | Android | iOS |
|----|----------|-------|---------|-----|
| TG-50 | Shop at Nib | Buy potion → gold decreases | NOT TESTED | NOT TESTED |
| TG-51 | Equip item | Character → equip weapon/armor | NOT TESTED | NOT TESTED |
| TG-52 | Use healing potion | Character or Play chip → HP increases | NOT TESTED | NOT TESTED |

---

## G. Combat & spellcasting

| ID | Scenario | Steps | Android | iOS |
|----|----------|-------|---------|-----|
| TG-60 | Enter combat | Encounter → Combat UI | NOT TESTED | NOT TESTED |
| TG-61 | Attack + End turn | Spend action → End turn offered (P0.2) | NOT TESTED | NOT TESTED |
| TG-62 | Cast spell | Caster → spell from deck → slot spent | NOT TESTED | NOT TESTED |
| TG-63 | Reaction prompt | OA or reaction window → Decline/Use | NOT TESTED | NOT TESTED |
| TG-64 | Flee / defend | Non-lethal exit path readable | NOT TESTED | NOT TESTED |

---

## H. Rest & progression

| ID | Scenario | Steps | Android | iOS |
|----|----------|-------|---------|-----|
| TG-70 | Short / long rest | Rest chip or command → HP/slots recover | NOT TESTED | NOT TESTED |
| TG-71 | Level-up | Gain XP → modal → apply choice | NOT TESTED | NOT TESTED |

---

## I. Journal, Tools, Settings

| ID | Scenario | Steps | Android | iOS |
|----|----------|-------|---------|-----|
| TG-80 | Journal scroll | Long session → scroll performance OK | NOT TESTED | NOT TESTED |
| TG-81 | Journal filters | Filter categories → no dup spam | NOT TESTED | NOT TESTED |
| TG-82 | Tools spellbook | Open Tools → known spells list | NOT TESTED | NOT TESTED |
| TG-83 | Settings Lite/Normal | Tier labels; Lite works offline | NOT TESTED | NOT TESTED |
| TG-84 | Language EN↔CS | Switch → persists after reload | NOT TESTED | NOT TESTED |

---

## J. Resilience

| ID | Scenario | Steps | Android | iOS |
|----|----------|-------|---------|-----|
| TG-90 | Reload Mini App | Telegram refresh → same character | NOT TESTED | NOT TESTED |
| TG-91 | Background / resume | Switch apps 30s → resume Play | NOT TESTED | NOT TESTED |
| TG-92 | Close Telegram, reopen | Session + character intact | NOT TESTED | NOT TESTED |
| TG-93 | BackButton | From Map/Quests/Journal → expected parent | NOT TESTED | NOT TESTED |
| TG-94 | Network blip | Airplane 5s mid-turn → recover or clear error | NOT TESTED | NOT TESTED |

---

## Pass criteria for “Physical Telegram QA v1”

- **Android:** all P1 scenarios (TG-01–03, 10, 20–22, 40, 60–61, 90–92) **PASS**  
- **iOS:** same set **PASS**  
- **Zero P0 FAIL** (crash, data loss, cannot login, cannot save character)

**Automated E2E does not satisfy this protocol.**

---

## Related docs

- [`STAGING_DEVICE_VALIDATION_V1.md`](STAGING_DEVICE_VALIDATION_V1.md)  
- [`TELEGRAM_MOBILE_QA_V1.md`](TELEGRAM_MOBILE_QA_V1.md) (older checklist)  
- [`SPRINT_38_STAGING_CHECKLIST.md`](SPRINT_38_STAGING_CHECKLIST.md)
