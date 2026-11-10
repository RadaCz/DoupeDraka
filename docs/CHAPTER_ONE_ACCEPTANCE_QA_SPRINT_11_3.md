# Chapter One Acceptance QA — Sprint 11.3 Preparation

**Date:** 2026-11-10  
**Scope:** Audit and Telegram playtest preparation only (no code/deploy).  
**Baseline HEAD:** `aa8faea` (`clean-main`, in sync with `origin/clean-main`).  
**Uncommitted work:** Sprint 11.1 + 11.2 (local, not committed).

---

## 1. Git and change inventory

### 1.1 Working tree

| Category | Paths |
|----------|--------|
| **Application** | `app/api.py` (E2E-only RNG seed hook), `frontend/src/game/gameActions.ts`, `frontend/src/i18n.tsx`, `frontend/src/screens/sharedPlayUI.tsx`, `frontend/src/styles/journal-quest-v2.css` |
| **Tests** | `frontend/e2e/chapter-one-quest.spec.ts`, `frontend/e2e/chapter-one-e2e-helpers.ts`, `frontend/e2e/mobile-text-first.spec.ts`, `frontend/e2e/start-api.mjs`, `frontend/src/game/gameActions.talk.test.ts`, `tests/test_chapter_one_boss.py` |
| **Documentation** | `docs/GAMEPLAY_COMPLETENESS_AUDIT_V1.md`, `design/CHAPTER_ONE_PLAYTEST_V1.md`, this file |
| **Tools** | `tools/audit_cs_suspects.py` |
| **Local data / logs** | `data/`, `.pytest-flake*.txt`, `.pytest-strict-once.txt`, `.pytest-verify-full.txt` |

**Diff size (tracked only):** 9 files, +196 / −6 lines (`git diff --stat`).

### 1.2 Sprint 11.1 summary (UX gaps)

- Quest objective strip always visible in play (`sharedPlayUI`).
- NPC/vault/travel/boss chips (`gameActions.ts`), CS strings (`i18n.tsx`), narrow quest strip CSS.
- Partial E2E: corridor → shrine → Caldus.
- E2E telegram ID `745_000_000+` → later `755_000_000+` for chapter spec.

### 1.3 Sprint 11.2 summary (full chapter path)

- Full Playwright chapter spec + helpers.
- Boss chip `resolveQuestBossAction`.
- `E2E_RNG_SEED=42` in `frontend/e2e/start-api.mjs` → `app/api.py` seeds `GameEngine` **only when env set**.
- Backend regression `tests/test_chapter_one_boss.py`.
- E2E grind/boss via `/actions/stream` (same as UI), not flag injection.

**Last verified automation (local):** pytest 475 passed, Vitest 147, E2E 19/19 (chapter spec ~6.5 min).

---

## 2. E2E credibility audit (`chapter-one-quest.spec.ts`)

| Check | Verdict | Notes |
|-------|---------|--------|
| Real API / game actions | **YES (mixed)** | Quest steps use UI chips + map; grind and boss use `POST …/actions/stream` |
| Quest flag tampering | **NO** | Flags only via engine turns (`waitForQuestFlag` on GET character) |
| Seed 42 scope | **E2E API only** | `start-api.mjs` sets env; production/default `GameEngine()` stays unseeded |
| Rewards / vault / chapter end | **Partial proof** | `bell_quest_complete` + journal gold/XP; `vault_unlocked`; `chapter_one_complete` via API after boss loop; journal text asserted after reload |
| Boss = player flow | **PARTIAL** | UI asserts **chip visible** at Pit; **no** full UI combat loop — `completeBossViaEngine` drives stream attacks |
| Grind hides difficulty | **RISK** | E2E forces **level 5** in ≤120 stream explores; masks that real players need many fights |
| Test identity | **OK** | `755_000_000 + workerIndex` (no overlap with 700–760 ranges in other specs) |

### 2.1 Interaction classification

| Phase | UI | API stream | Direct test state |
|-------|-----|------------|-------------------|
| Wizard → Cellar | ✓ | — | — |
| Map travel (corridor, shrine, vault, pit) | ✓ | — | — |
| Caldus, Nib, return bell, vault talk | ✓ chips | — | — |
| Level 5 grind | — | ✓ search/attack/revive | — |
| Economy topup | — | ✓ `POST /economy/topup` | Adds **⚡ credits**, not XP/level |
| Boss defeat | Chip visibility only | ✓ attack loop + revive | — |
| Assertions | Journal snippet | GET character flags | — |

**Honesty label:** E2E proves **engine can complete chapter one** with **UI-guided quest** and **stream-assisted grind/boss**. It is **not** a pure Telegram UI combat playthrough.

---

## 3. Boss readiness audit (read-only)

### 3.1 Why level 4+ (practically 3+ tier, 4–5 to survive)

| Rule | Source |
|------|--------|
| Bell Warden **tier 3** | `encounters.py` |
| Named fight allowed only if `monster_allowed_for_character` → `level >= 3` for tier 3 | `tier_allowed_for_level` |
| At **level 1–2**, `attack the Bell Warden` → level/pit-specific block text (Sprint **11.4**; was `"No bell warden is here for you to fight."`) | `encounters.attack_block_message` |
| Random explore at Pit **never** rolls Bell Warden below tier | `test_gameplay_integrity` |

**Player-facing gap:** Engine does **not** say “reach level 3 first”; quest hint only mentions Vault and Pit.

### 3.2 XP sources (chapter one, no admin)

| Source | XP (typical) |
|--------|----------------|
| Return bell to Caldus | **30** (+ level-up if under cap) |
| Exploration fights (tier 1 mobs) | ~**35–110** per win (e.g. goblin 50) |
| Bell Warden | **180** (on kill) |
| Level threshold | **100 XP per level** (`XP_THRESHOLD`) |

After bell at **level 1** with 30 XP: player still **level 1**, needs ~**2–4 combat wins** for level 2, ~**4–8 more** for level 3+ (plus explore cooldown 1 turn, ~1/6 encounter rate on `search`).

**Order-of-magnitude:** **~15–40 explore/combat cycles** from post-bell to comfortable boss attempt (RNG-dependent; E2E seed 42 differs from production).

### 3.3 Pre-Pit player information

| Surface | Content |
|---------|---------|
| Quest objective (play strip) | “Defeat the Bell Warden” / CS equivalent |
| Map | Vault/Pit unlocked after `vault_unlocked`; lock reasons before |
| Chip at Pit | “Face the Bell Warden” / “Postav se Strážci zvonu” |
| **Missing** | No UI line “recommended level 3+” or “grind first” |

### 3.4 Lite playthrough without admin

| Requirement | Achievable in Lite? |
|-------------|---------------------|
| Quest to `vault_unlocked` | **Yes** (chips + map) |
| Tier-3 boss **legal** | **Yes**, after enough XP from fights |
| Boss **win** on first try at min level | **Unlikely** (high boss stats; E2E uses revive + many attempts via stream) |
| `/economy/topup` | Real endpoint; **narrator credits only**, not combat power |

---

## 4. Open issues (acceptance blockers / watchlist)

| ID | Severity | Issue |
|----|----------|--------|
| O1 | **P1 playtest** | Bell Warden needs grind; not explained in UI |
| O2 | **P1 → mitigated 11.4** | Low-level attack now explains level/pit (`attack_block_message`) — verify on device |
| O3 | **P2** | E2E overstates “full UI chapter” (boss/grind via stream) |
| O4 | **P2** | Uncommitted 11.1/11.2 — staging must ship this commit before phone QA |
| O5 | **P2** | CS coverage incomplete outside main quest strings |
| O6 | **P0 physical** | No Android/iOS Telegram run yet (`TELEGRAM_MOBILE_QA_V1` tables empty) |
| O7 | **INFO** | E2E calls `economy/topup` — not needed for real XP; document for facilitators only |

---

## 5. Telegram playtest scenario — new character (facilitator script)

**Preconditions:** Lite narrator, UI `cs` recommended, isolated Telegram test user, build includes 11.1+11.2 changes, HTTPS staging bot URL.

| Step | Player action | Expected state / UI | If broken, record |
|------|----------------|---------------------|-------------------|
| **1. Start** | Open Mini App → create Fighter (wizard) → Enter adventure | Location **Whispering Cellar**; **CURRENT OBJECTIVE** visible; chips: Explore, Travel, optional corridor travel | No objective strip; English-only critical labels; crash |
| **2. Caldus** | Map: Corridor → Shrine; chip **Talk to Caldus** / talk chip | Journal: quest accepted, mention **Goblin Market / Nib**; flag `bell_quest_accepted` (quest UI) | Must type exact English; no chip |
| **3. Nib** | Travel chip or map → **Goblin Market**; chip **Ask Nib** | Journal: bell acquired; inventory bell | Wrong location chip; Nib chip missing |
| **4. Bell return** | Map/chip → Shrine; chip **Return the shrine bell** | Journal: **10 gp + 30 XP**; objective advances | No return chip with bell |
| **5. Vault** | Chip **Ask Caldus about the Vault** | Journal: vault route; map shows **Vault of Echoes** unlocked | Stuck after return; vault locked on map |
| **6. Pit** | Map: Corridor → Vault → **Bell Warden's Pit** | Arrival beat; chip **Face the Bell Warden** | Pit locked; no chip |
| **7. Leveling** | Repeated **Explore/Search** in safe areas + win fights until **level 3+** (ideally 4+) | Level-up lines in journal; HP/level on Character screen | Player tries boss at L1–2; opaque error |
| **8. Bell Warden** | Chip or `attack the Bell Warden`; Attack in combat until win | Combat UI; boss defeated; **Chapter complete** + gold in journal | Instant death loop; no revive clarity |
| **9. Chapter complete** | Quest screen / objective cleared | Main quest shows complete; `chapter_one_complete` feel | Flag without message |
| **10. Re-open app** | Close Telegram WebApp fully; reopen → **Continue adventure** | Same character, journal persists, quest complete state | Lost progress; duplicate streams |

**Time budget:** Quest through vault **20–40 min**; grind + boss **+30–60 min** (facilitator should warn testers).

---

## 6. Telegram Android / iOS checklist (condensed)

Use full tables in [`TELEGRAM_MOBILE_QA_V1.md`](TELEGRAM_MOBILE_QA_V1.md). Minimum for acceptance session:

### Both platforms

- [ ] **C1–C5** Telegram chrome, safe areas, keyboard vs composer, back navigation, resume after background.
- [ ] **D1–D5** Auth, hero create, first action, 4-tab nav, map/quest/character.
- [ ] **Chapter script §5** steps 1–6 on **UI only** (no facilitator typing intents).
- [ ] **D8** Reload persistence after step 6 or 9.
- [ ] **E** Viewports 320 / 360 / 390 / 430 — no horizontal scroll on Play.
- [ ] Screenshots on every **FAIL**.

### Android-specific notes

- Gesture navigation inset vs bottom nav.
- Keyboard covering composer (Gboard).

### iOS-specific notes

- Safari WebView / Telegram safe-area top (notch).
- Keyboard + `visualViewport` jump.

### Facilitator must NOT do

- Admin DB / flag edits.
- Force Normal/Pro tier unless testing narration credits.
- Share one Telegram account between parallel testers.

---

## 7. Recommendation: proceed to internal playtest?

| Area | Verdict |
|------|---------|
| **Quest path (Cellar → vault)** | **READY** for facilitated internal Telegram test |
| **Full chapter in one session** | **READY with facilitator** (expect grind + possible deaths) |
| **Unaided new player, no spoilers** | **NOT READY** — boss tier/grind under-explained |
| **Staging** | **BLOCKED** until 11.1/11.2 changes are deployed (still uncommitted at `aa8faea`) |
| **Physical Telegram** | **REQUIRED** before “closed beta ready” — E2E does not replace phone QA |

**Overall:** **Conditional GO** — run **internal Telegram playtest** with a **facilitator cheat sheet** (grind before Pit, explain opaque boss message, use chips/map). Do **not** advertise fully unguided chapter completion until O1/O2 are playtest-validated or UX copy is added (future sprint).

---

*Sprint 11.3 — preparation audit only. No gameplay rule changes.*
