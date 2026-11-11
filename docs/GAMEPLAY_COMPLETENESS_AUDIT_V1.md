# Gameplay Completeness Audit V1 — Chapter 1 RPG MVP

**Sprint:** 11 (audit only — no gameplay code changes)  
**Repository baseline:** `aa8faea` on `clean-main` · CI run `42824720654` (4/4 SUCCESS, user-reported)  
**Audit date:** 2026-11-10  
**Method:** Code-first review of `app/engine/`, API narration boundary, frontend journey; tests cited where they prove behavior. Documentation is secondary.

**Deployment / human fun:** HTTPS staging **NOT DEPLOYED** · Android/iOS playtest **NOT TESTED** · Claimed “fun” **NOT VERIFIED** by this audit.

### Sprint 25 — Combat action economy (2026-11-11, local)

See [`SPRINT_25_COMBAT_ACTION_ECONOMY_ACCEPTANCE.md`](SPRINT_25_COMBAT_ACTION_ECONOMY_ACCEPTANCE.md). **Start baseline:** `53a6fed`. Action + bonus pools; Healing Word / Second Wind / Hide; reaction slot without triggers.

| Finding | Status |
|---------|--------|
| Unified action economy | **PARTIAL** (no reaction abilities) |
| Bonus-action class/spells in combat | **IMPLEMENTED** (MVP set) |

### Sprint 24 — Background features (2026-11-11, committed `53a6fed`)

See [`SPRINT_24_BACKGROUND_FEATURES_ACCEPTANCE.md`](SPRINT_24_BACKGROUND_FEATURES_ACCEPTANCE.md). Six MVP backgrounds; one-shot informational gifts; Stealth disadvantage fix.

| Finding | Status |
|---------|--------|
| Background features mechanical | **PARTIAL** (Chapter One, 6/6) |
| Sprint 23 stealth disadvantage | **FIXED** |

### Sprint 23 — Skill checks & Bandit Camp (2026-11-11, committed `32ebfd7`)

See [`SPRINT_23_SKILL_CHECKS_PLAYER_AGENCY_ACCEPTANCE.md`](SPRINT_23_SKILL_CHECKS_PLAYER_AGENCY_ACCEPTANCE.md). **Committed baseline:** `9e7fbac`. Fail-closed unknown actions; Bandit Camp stealth/social/combat evidence (20 gp, ledger); optional — main chapter unchanged.

| Finding | Status |
|---------|--------|
| Unknown free text → no fake checks | **IMPLEMENTED** (Sprint 23) |
| Meaningful skill challenge + persistence | **PARTIAL** (Bandit Camp V1) |
| Optional location payoff | **IMPROVED** (Bandit Camp); Underground River **OPEN** |

### Sprint 22 — Chapter One completion audit (2026-11-11, committed `9e7fbac`)

See [`SPRINT_22_CHAPTER_ONE_GAMEPLAY_ACCEPTANCE.md`](SPRINT_22_CHAPTER_ONE_GAMEPLAY_ACCEPTANCE.md). No XP/loot rebalance; UI gates Bell Warden chip until L3; completion/idempotency tests.

| Finding | Status |
|---------|--------|
| Main path L3 without search grind | **VERIFIED** (Sprint 15 tests + simulator) |
| Full chapter E2E → `chapter_one_complete` | **VERIFIED** (`chapter-one-quest.spec.ts`) |
| Boss / quest rewards idempotent | **VERIFIED** (+ Sprint 22 pytest) |
| Exploration gold farm | **MITIGATED** (one-time per location) |
| Background features mechanical | **OPEN** |
| Human fun on device | **NOT TESTED** |

### Sprint 20 — Character → Adventure V1 (2026-11-11, local)

See [`SPRINT_20_CHARACTER_TO_ADVENTURE_ACCEPTANCE.md`](SPRINT_20_CHARACTER_TO_ADVENTURE_ACCEPTANCE.md).

| Finding | Status | Notes |
|---------|--------|--------|
| 4×4 MVP create (engine) | **VERIFIED** | `test_character_creation_mvp_matrix.py` (16 pairs) |
| 4-class E2E create → first turn | **VERIFIED** | `character-to-adventure.spec.ts` |
| Character sheet combat basics | **IMPROVED** | Speed, save profs, proficiency display |
| Background features in play | **OPEN** | Narrative-only |
| Full 15-min class-distinct fun | **NOT TESTED** | Facilitator playtest |

### Sprint 11.1 — Player experience gap closure (2026-11-10, local)

| Audit gap | Status after 11.1 | Notes |
|-----------|-------------------|--------|
| P1-1 Quest phrase discoverability | **PARTIAL → improved** | `resolveQuestTravelAction`, vault Caldus chip, quest strip always visible |
| P0 Inventory / equip / potion | **FIXED** (already in `CharacterInventoryPanel`) | No engine change; verified E2E equip |
| P1-5 Mobile quest text overflow | **PARTIAL** | `overflow-wrap` on play quest strip; device NOT VERIFIED |
| Full chapter E2E without typing | **PARTIAL** | `e2e/chapter-one-quest.spec.ts` (corridor → shrine → Caldus chip); Warden path not automated |
| Cellar quest travel chip (pre-accept) | **FIXED** | `resolveQuestTravelAction` → Sunken Corridor when objective has no pinned location |
| E2E user ID collision | **FIXED** | `chapter-one-quest.spec.ts` uses `745_000_000+` (was `740_000_000+`, collided with `mobile-text-first`) |
| Unequip weapon | **OPEN** | Engine has equip-swap only, not unequip-to-empty |

### Sprint 11.3 — Acceptance QA preparation (2026-11-10, audit only)

See [`CHAPTER_ONE_ACCEPTANCE_QA_SPRINT_11_3.md`](CHAPTER_ONE_ACCEPTANCE_QA_SPRINT_11_3.md) for E2E credibility, boss grind analysis, and Telegram facilitator script. **No new code.**

### Sprint 12 — Internal playtest preparation (2026-11-10, audit only)

See [`SPRINT_12_INTERNAL_PLAYTEST_ACCEPTANCE.md`](SPRINT_12_INTERNAL_PLAYTEST_ACCEPTANCE.md) — git/diff audit, regression matrix, ngrok PowerShell playbook, facilitator script. **No deploy; no services started.**

### Sprint 13 — Czech narration & immersion V1 (2026-11-10, local)

Presentation-only sprint: CS catalog cases, narration guard/offline embed, journal action labels, map arrival beats, locale↔`narration_language` sync. **No gameplay balance changes.** Mobile Telegram QA **NOT TESTED** post-sprint on device.

See [`SPRINT_13_CZECH_NARRATION_QA.md`](SPRINT_13_CZECH_NARRATION_QA.md).

| Gap (QA screenshots) | Status | Notes |
|----------------------|--------|--------|
| EN/hybrid journal prose in CS UI | **IMPROVED** | Backend guard + FE `presentNarrationProse` |
| Raw `search The …` action labels | **FIXED** | `journalActionPresent.ts` |
| EN map arrival beats | **FIXED** | `arrival_beats_cs` + `MapScreen` |
| Wrong location case in CS prose | **IMPROVED** | Locative/accusative in catalog + offline templates |
| `narration_language` drift vs UI | **FIXED** | Auto-sync on character load |
| Play-surface provider meta (Lite) | **UNCHANGED OK** | Hidden on play; economy copy remains in Settings |

### Sprint 15 — Story-paced progression & first descent V1 (2026-11-10, local)

See [`SPRINT_15_PROGRESSION_FIRST_DESCENT.md`](SPRINT_15_PROGRESSION_FIRST_DESCENT.md). Main path **200 XP** (30+50+35+85) → L3 without mandatory `search` grind; first Vault entry = kobold encounter + story flags.

| Finding (Sprint 14) | Status |
|---------------------|--------|
| Post-vault XP gap | **ADDRESSED** (story milestones + first descent) |
| E2E `ensureLevelAtLeast` mask | **REMOVED** from chapter E2E |
| Crypt XP without level_up | **FIXED** |

### Sprint 14 — Gameplay fun audit & experience design V1 (2026-11-10, audit only)

**HEAD:** `dc08808` · **no code / commit / deploy.** Human fun & playtest **NOT VERIFIED.**

See [`SPRINT_14_GAMEPLAY_FUN_AUDIT.md`](SPRINT_14_GAMEPLAY_FUN_AUDIT.md) — 20‑min journey map, grind simulation, location/class/NPC audits, TOP 10 fun fixes, backlog **Sprints 15–17**.

| Finding | Status | Notes |
|---------|--------|--------|
| Bell quest chain completable (UI chips) | **VERIFIED (code + E2E)** | Grind/boss phases cheat level in E2E |
| Post-vault XP gap → search grind | **OPEN (design)** | Sim 13–90 explores to L5 (seed 99) |
| Exploration core loop repetitive | **OPEN** | d6 search + cooldown |
| Ranger L1 without prepared spells | **OPEN** | Half-caster slot table |
| Optional locations weak narrative payoff | **OPEN** | Bandit Camp, Underground River |
| „Is it fun?“ | **NOT TESTED** | Requires facilitator playtest |

### Sprint 11.4 — Boss readiness & progression UX (2026-11-10, local)

See [`CHAPTER_ONE_PROGRESSION_SPRINT_11_4.md`](CHAPTER_ONE_PROGRESSION_SPRINT_11_4.md) for XP tables, RNG scenarios, and design variants A/B/C.

| Gap | Status | Notes |
|-----|--------|--------|
| Misleading “No bell warden is here…” at low level | **FIXED** | `attack_block_message` + wired in `_resolve_attack_turn` |
| CS/EN presentation of gate messages | **FIXED** | `gameDisplay.ts` + vitest |
| Progression math / grind scenarios | **DOCUMENTED** | `tools/progression_scenarios.py` (engine-turn sim, not playtime) |
| XP / loot / boss balance | **UNCHANGED** | Per sprint constraints |
| Progression redesign (B/C) | **NOT IMPLEMENTED** | Recommendations only |

### Sprint 11.2 — Complete chapter one player journey (2026-11-10, local)

| Gap | Status | Notes |
|-----|--------|--------|
| Full chapter UI path (Nib → vault → Warden) | **FIXED** (E2E) | `chapter-one-quest.spec.ts` (~6.5 min); UI chips + map; boss via stream API after chip check |
| Boss chip at pit | **FIXED** | `resolveQuestBossAction` → `attack the Bell Warden` |
| Quest hint CS on main path | **PARTIAL** | i18n for step labels/hints + travel to vault/pit |
| Level grind before Warden | **BY DESIGN** | Tier-3 boss needs L4+; E2E explores via stream (`E2E_RNG_SEED=42` in E2E API only) |
| Backend boss regression | **FIXED** | `tests/test_chapter_one_boss.py` |
| Telegram device QA | **NOT TESTED** | Browser E2E only |

---

## 1. Executive verdict

Doupě Draka **is a coherent, deterministic Chapter 1 solo RPG slice** with a **complete main quest chain** (stolen bell → vault → Bell Warden) that **persists in engine state** and is **covered by integration tests**. Combat, exploration, rest, shop gold spend, equip, potions, spellcasting (subset), travel gating, and chapter completion **work in the engine** without relying on the LLM for mechanics.

It is **not yet proven as an enjoyable tabletop-like experience**. Gameplay is **phrase- and intent-gated** (quest steps, shop, travel), **exploration is a lightweight d6 loop** (cooldown, random fight / gold / discovery lines), and **NPC “talk” is mostly static hints** unless the player hits exact quest phrasing routed through `intent.py`. Optional locations add **atmosphere and fights** but **no structured side arcs** beyond the Forgotten Crypt relic.

| Verdict | Statement |
|---------|-----------|
| **Chapter 1 MVP (systems)** | **READY for internal engine playtesting** — main arc is implementable end-to-end in code. |
| **Chapter 1 MVP (player UX)** | **UNKNOWN** — discoverability of quest phrases, mobile Telegram flow, and narration quality need humans. |
| **Closed beta “fun”** | **NOT READY** — requires staging, physical QA, and qualitative playtests (see §12–13). |
| **Full D&D 5e** | **Out of scope** — by design (`ruleset_v1.py` locks 4 races / 4 classes / level 5). |

---

## 2. Current game identity and intended player experience

**Product:** Solo Chapter 1 underground fantasy in a Telegram Mini App. Default hero starts in **`The Whispering Cellar`** (`models.CharacterState.location`). Player explores nine linked locations, accepts Caldus’s bell quest, buys from Nib, returns the bell for **10 gp + 30 XP**, unlocks vault routes, defeats **Bell Warden** for **25 gp** and `chapter_one_complete`.

**Narration (Lite):** Offline/template narrator decorates committed facts; **mechanics are engine-owned** (`app/engine/service.py` → persist → SSE).

**Intended feel (design docs):** 45–90 min first session, Czech UI option, curiosity in ruins, light combat tension, clear next quest step in UI (`questProgress.ts`, hub).

---

## 3. Feature truth matrix

| Feature | Status | Evidence | Tests / journey |
|---------|--------|----------|-----------------|
| Character creation (4 race / 4 class) | IMPLEMENTED_AND_TESTED | `ruleset_v1.py`, `GameEngine.create_character` | API + wizard tests |
| Racial ability bonuses at create | IMPLEMENTED_AND_TESTED | engine + `test_race_bonuses.py` | pytest |
| Racial traits (Lucky, saves, poison, Perception) | IMPLEMENTED_AND_TESTED | `race_features.py`, `test_sprint26_racial_traits.py` | pytest; tagged content optional |
| Darkvision / Trance / Nimbleness | DEFERRED | data contract or no movement grid | Sprint 26 acceptance |
| HP / AC / abilities / XP / level ≤5 | IMPLEMENTED_AND_TESTED | `models.py`, `service._grant_xp` | combat + progression tests |
| ActionIntent routing | IMPLEMENTED_AND_TESTED | `intent.py` | `test_intent_negation.py` |
| Travel + vault gating | IMPLEMENTED_AND_TESTED | `locations.travel_allowed`, `_travel` | `test_chapter_one.py` |
| Main bell quest (5 flags) | IMPLEMENTED_AND_TESTED | `quests.py` | `test_chapter_one_journey.py` |
| Side crypt relic | IMPLEMENTED_AND_TESTED | `try_side_quest_explore` | economy / quest tests |
| Exploration d6 (fight/gold/track/clue) | IMPLEMENTED_BUT_WEAK | `service._explore` | scattered tests; thin variety |
| Location discoveries (persist flags) | IMPLEMENTED_AND_TESTED | `discoveries.py` | inspect/talk flags |
| Combat initiative, attack, defend, flee | IMPLEMENTED_AND_TESTED | `service` combat block | combat tests |
| Defeat → respawn 1 HP Cellar | IMPLEMENTED_AND_TESTED | `_recover_from_combat_defeat` | `test_e2e_fallen` integration |
| Bell Warden boss + chapter reward | IMPLEMENTED_AND_TESTED | `encounters.bell_warden`, `_chapter_one_boss_rewards` | journey + boss tests |
| Shop (2 items, gold spend) | IMPLEMENTED_AND_TESTED | `shop.py`, `_resolve_shop` | shop tests |
| Equip / potion use | IMPLEMENTED_AND_TESTED | `equipment.py` | `test_chapter_one_journey` |
| Spell lists (SRD-wide catalog) | UI_ONLY_OR_CATALOG_ONLY | `spells.py` CLASS_SPELL_LISTS for 8 classes | — |
| Spell **effects** in combat | PARTIALLY_IMPLEMENTED | `MODELED_SPELL_EFFECTS` (~11 spells) | spell tests for modeled set |
| MVP classes only at create | IMPLEMENTED_AND_TESTED | `validate_mvp_creation` | ruleset tests |
| Generic NPC talk | IMPLEMENTED_BUT_WEAK | `npc_interactions.py` static lines | no E2E dialogue trees |
| Quest via natural language | PARTIALLY_IMPLEMENTED | Must match `intent` quest patterns | failure = hint only |
| Mara / optional NPC depth | IMPLEMENTED_BUT_WEAK | Warning flags only | — |
| Bandit Camp / Underground River arcs | PARTIALLY_IMPLEMENTED | Locations + pools only | no unique quests |
| Memory / LLM DM improvisation | DOCUMENTED_BUT_MISSING | Engine has `npc_presence` facts for narrator only | — |
| Multiplayer / party | MISSING | — | deferred |
| Real-money payments | MISSING (intentional) | billing = narrator credits only | — |
| Pro narration tier | MISSING (intentional) | API filters `pro` | — |

---

## 4. Chapter 1 — locations and quests

### Main arc (engine-backed)

| Step | Flag / condition | Player action (examples) | Persistence |
|------|------------------|---------------------------|-------------|
| Accept quest | `bell_quest_accepted` | `talk to Caldus about the shrine bell` | `quests.resolve_main_quest_step` |
| Get bell | `bell_found`, `bell_acquired`, inventory | `ask Nib about the shrine bell` (requires accepted) | item + flags |
| Return bell | `bell_quest_complete` | `return the shrine bell to Caldus` | removes item, +10 gp, +30 XP |
| Vault hint | `vault_hint_given`, `vault_unlocked` | Talk Caldus again after return | unlocks Vault/Pit travel |
| Finale | `chapter_one_complete` | Defeat Bell Warden in Pit | +25 gp, flag permanent |

**Softlock risks (audited):**

- **P1 — Quest phrasing:** Generic `talk to Caldus` does **not** accept quest (`npc_interactions` hints only). Player needs UI chips or exact wording → confusion risk, not hard lock (hints exist).
- **P1 — Vault without return:** `travel_allowed` blocks Vault/Pit until `vault_unlocked` — tested; message mentions Caldus (`test_chapter_one.py`).
- **P1 — Nib before accept:** `ask_nib` rejected without `bell_quest_accepted` — intentional gate.
- **Low — Bell in inventory after return:** Flags `bell_acquired` kept; inventory item removed — consistent.

### Location audit (9 nodes)

| Location | Why visit | Distinct hook | Return reason | Stuck risk |
|----------|-----------|---------------|---------------|------------|
| **Whispering Cellar** | Start / respawn | Panel clue flag | Safe long rest | Low |
| **Sunken Corridor** | Hub to shrine/vault/crypt/river | Mara warning | Travel hub | Vault gated |
| **Shrine** | Caldus quest | Quest accept/return | Post-quest vault hint | Must learn phrasing |
| **Goblin Market** | Nib + shop | Buy potion/sword | Spend quest gold | Shop needs exact `buy` phrase |
| **Vault** | Finale approach | Atmosphere + fights | Boss path | Needs `vault_unlocked` |
| **Bell Warden's Pit** | Boss | `bell_warden` pool only | Once per chapter | Boss gated by location |
| **Forgotten Crypt** | Optional | One-time relic +15 gp | Completionist | Repeat search noop |
| **Bandit Camp** | Optional | Harder pool | Grinding XP? | No quest payoff |
| **Underground River** | Optional | Flavor encounters | Exploration | No quest payoff |

Optional sites **do not block** main arc; they add **combat variety** only.

---

## 5. Combat and spell audit

**Combat model:** d20 attack vs AC, damage dice, initiative, player/enemy turns, defend, flee, death respawn at Cellar 1 HP. Difficulty profiles scale monsters (`encounters.DIFFICULTY_PROFILES`). Encounters from exploration d6=6 or explicit attack.

**Enemy roster:** Templates in `MONSTERS` — chapter pools exclude `ogre` from location lists (ogre exists in catalog but **not** in Ch1 pools — good).

**Bell Warden:** Only spawnable in Pit with `vault_unlocked` (`monster_allowed_for_character`).

**Spells:** Full SRD-style lists in data for reference classes; **only Wizard/Cleric (etc.) MVP** get slots. **`MODELED_SPELL_EFFECTS`** defines real combat outcomes for a **small set** (Magic Missile, Cure Wounds, Burning Hands, …). Casting unparsed spells → engine rejection (tested patterns).

**Gap:** Casters may **see** many spell names in reference/UI but only modeled spells matter — **P2** clarity risk.

**Tactics:** No Heavy/Aim/Defend redesign (design doc only). **Defend** exists in engine.

---

## 6. Character, equipment, progression

- **Progression:** XP from kills, quest XP, level-up to max 5 (`MAX_MVP_LEVEL`), spell slot progression for casters.
- **Gold sources:** Bell return 10, crypt 15, boss chapter 25, explore 1d4 once per location, combat XP only (no generic monster gold loot).
- **Gold sinks:** Nib shop 45 / 95 gp — **meaningful** if player wants sword/potion (`shop.py`).
- **Equipment:** Item instances, equip weapon, shortsword +1 from shop, starting gear from create.
- **Rest:** Short rest (HP, gated flag), long rest (full HP + spell slots) only in safe locations set.

**Persistence:** All via character payload + `quest_flags` in DB — survives API restart.

---

## 7. NPC and narrative audit

| NPC | Engine behavior | Quest advancement |
|-----|-----------------|-------------------|
| **Caldus** | `npc_interactions` + quest `accept_caldus` / `return_bell` | Quest steps only via intent patterns |
| **Nib** | Talk hints + `ask_nib` quest step | Shop separate (`shop.py`) |
| **Mara** | Talk sets `mara_warned` | No quest flag for main arc |

**Narration layer:** `npc_presence.py` supplies facts for prose; **does not branch gameplay**.

**Limitation:** No free-form persuasion or dialogue trees — **acceptable for MVP**, **weak vs tabletop social play** (P2).

---

## 8. First 20 minutes — chronological walkthrough (new player, Lite)

*Assumes successful Telegram auth + character wizard (Fighter, Human). Engine facts; UI may add chips.*

| Min | What happens | Understanding / friction |
|-----|--------------|---------------------------|
| 0–2 | Landing home/play; location **Whispering Cellar** | Player may not know goal without reading Quests tab |
| 2–5 | First `explore` / `search` → d6 result (mechanics line + maybe gold/track/clue) | **Exploration roll** exposed in journal — immersion tradeoff (documented Sprint 7 presentation) |
| 5–8 | `travel to The Sunken Corridor` or Shrine | Travel verbs must match regex; map UI helps |
| 8–12 | Shrine: `talk to Caldus` → hint; must use **about the bell** to accept | **First meaningful decision delayed** if player misses phrasing (P1) |
| 12–15 | Market travel; `ask Nib about the shrine bell` → receives bell | Clear if quest UI points to Nib |
| 15–18 | Return bell → 10 gp, 30 XP; talk Caldus again → vault | Strong payoff moment |
| 18–20 | Optional: shop buy, explore fight, or push vault | Combat teachable; boss likely **after** 20 min |

**Dead ends observed in code (not playtested):** wrong travel before vault unlock; talk Nib early; explore cooldown “catch breath” turn.

---

## 9. Tabletop D&D comparison (scoped to product)

| Dimension | Tabletop expectation | Doupě Draka Ch1 | Necessity for MVP |
|-----------|---------------------|-----------------|-------------------|
| Character identity | Deep build | 4×4 MVP, flavorful text | **Necessary** (bounded) |
| Player freedom | Open phrases | Regex intents + chips | **Necessary** simplify |
| Exploration | DM-described | d6 + fixed discovery lines | **Acceptable** if prose carries |
| NPC roleplay | Conversation | Static + quest parsers | **P1** improve hints/chips |
| Quest consequences | Branching | Linear main arc + 1 side | **Necessary** for slice |
| Combat tactics | Choices | Attack/defend/flee/spells | **Necessary** minimum |
| Class identity | Full spell lists | Subset modeled | **P2** communicate limits |
| Equipment | Loot tables | Shop + quest rewards | **OK** for chapter |
| World continuity | Campaign memory | `quest_flags` + journal | **OK** solo |
| Party / DM improv | Core TTRPG | Absent by design | **Optional** (out of scope) |

---

## 10. Fun and replayability (design judgment — not verified)

| Loop element | Assessment | Evidence type |
|--------------|------------|---------------|
| Curiosity | Moderate | Discoveries + vault gate |
| Tension | Moderate | Random explore combat, boss |
| Meaningful decisions | Low–moderate | Quest order; shop buy; difficulty setting |
| Variety | Moderate | 9 locations, pools differ |
| Attachment | Unknown | Needs human narration + time investment |
| Narrative payoff | Moderate at bell return & boss | Engine events exist |
| Replayability | Low | Same deterministic arc |

**Requires human playtest:** emotional engagement, Czech prose quality, mobile UX, “want to continue” after 20 min.

---

## 11. P0–P3 gap register

### P0 — Blocks coherent Ch1 or serious state failure

*None identified in code audit that prevent completing the main quest when using documented actions.*

### P1 — Hurts enjoyment / core clarity

| ID | Problem | Evidence | Player impact | Fix direction | Scope | Before beta? |
|----|---------|----------|---------------|---------------|-------|--------------|
| P1-1 | Quest advancement requires **specific phrases** | `intent.py` quest patterns | Players stall at Caldus/Nib | UI quest chips always visible; in-game “say this” | S | Internal + beta |
| P1-2 | Generic `talk` does not advance quests | `npc_interactions` vs `quests` | Confusion after talk | Merge talk+quest for keyword “bell” | M | Internal |
| P1-3 | Exploration shows **mechanical d6** in events | `service._explore` | Immersion break on mobile | Presentation-only (already partial in frontend) | S | Beta polish |
| P1-4 | Optional locations **no narrative payoff** | `locations.py` only pools | Feels like filler | 1-line location goals in quest UI | S | Beta optional |
| P1-5 | **Fun/unstick** on mobile | NOT TESTED | Unknown frustration | `TELEGRAM_MOBILE_QA_V1` | — | **Required** |

### P2 — Important, not blocking first beta

| ID | Problem | Evidence | Scope |
|----|---------|----------|-------|
| P2-1 | Spell catalog >> modeled effects | `spells.py` vs `MODELED_SPELL_EFFECTS` | S docs/UI |
| P2-2 | Bandit Camp / River no quests | engine | M content (optional) |
| P2-3 | Short rest gate opaque | `SHORT_REST_FLAG` | S UX copy |
| P2-4 | Combat depth (no tactics v2) | design only | L deferred |

### P3 — Post-beta / expansion

- General NPC dialogue, multiplayer, full SRD classes, E3 dice revision, payments, Pro tier.

---

## 12. Recommended implementation sequence (post-audit)

1. **Human internal playthrough** (engine + Telegram staging): main arc <90 min, note phrasing stalls.  
2. **P1-1** quest chip prominence / onboarding copy (frontend only).  
3. **Staging + physical QA** (Sprint 10.x ops).  
4. **Closed beta protocol** (`CHAPTER_ONE_PLAYTEST_V1`) with facilitators.  
5. **P2** optional location hooks or spell UI honesty.  
6. Content expansion only after beta go/no-go.

---

## 13. Internal playtest readiness

| Criterion | Status |
|-----------|--------|
| Main quest completable in engine | **YES** (tests) |
| Persistence + idempotency | **YES** (CI) |
| Lite narration path | **YES** |
| Developer can run full arc locally | **YES** |
| Telegram staging | **NOT DEPLOYED** |
| Facilitator docs | **YES** |

**Verdict:** **GO** for **desk/internal engine playtest**; **CONDITIONAL GO** for **facilitator-led Telegram internal** after staging deploy.

---

## 14. Closed beta readiness

| Gate | Status |
|------|--------|
| CI green on HEAD | YES (`aa8faea` / #43 per user) |
| Staging HTTPS | NOT DEPLOYED |
| Physical QA Android/iOS | NOT TESTED |
| Qualitative “fun” playtest | NOT RUN |
| P1 discoverability mitigations | Partial (UI exists; not validated on device) |

**Verdict:** **NO-GO** for external 10–15 player beta until staging + physical QA PASS + at least one facilitator dry-run documents P1 friction.

---

## 15. Explicit unknowns and unverified claims

- Whether average new players complete bell quest without facilitator help (**UNKNOWN**).
- Whether Lite Czech narration feels rewarding for 30+ minutes (**UNKNOWN**).
- Bell Warden difficulty vs wizard/fighter at level 1–2 (**UNKNOWN** balance).
- Economic comfort buying 95 gp sword before boss (**design judgment**; numbers in `economy_balance.py`).
- Frontend quest/map alignment with engine hints on small screens (**NOT TESTED** on device).
- Claim “compelling RPG” (**NOT VERIFIED** — this audit does not assert fun).

---

## Appendix A — Files inspected (representative)

`app/engine/service.py`, `locations.py`, `quests.py`, `intent.py`, `encounters.py`, `spells.py`, `shop.py`, `equipment.py`, `economy_balance.py`, `discoveries.py`, `npc_interactions.py`, `npc_presence.py`, `ruleset_v1.py`, `models.py`  
`tests/test_chapter_one.py`, `tests/test_chapter_one_journey.py`, `tests/test_economy_balance.py`  
Frontend: `questProgress.ts`, `CharacterWizard.tsx`, `chapterOneMap.ts` (spot check)

## Appendix B — Tests executed this sprint

```
python -m pytest -q tests/test_chapter_one.py tests/test_chapter_one_journey.py tests/test_economy_balance.py
→ 21 passed
```

(Full suite not re-run in Sprint 11; prior sprint: 474 pytest, 143 Vitest, 18 E2E at `aa8faea`.)

---

*This document does not change gameplay code. Update when engine or Chapter 1 scope changes.*
