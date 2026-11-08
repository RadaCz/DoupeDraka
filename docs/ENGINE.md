# Game Engine

## Core rule

Mechanics are resolved by `app/engine/service.py`; the LLM is never an authority for
game state. Dice are rolled through the engine's injected RNG, and every effect sent
to the narrator is already resolved.

## ActionIntent routing

Player text is classified in `app/engine/intent.py` (`parse_action_intent`). Kinds
include quest, shop, use_item, attack, cast_spell, flee, defend, rest, travel,
explore, talk, rejected, ambiguous, unknown, and ability_check. `resolve_action`
branches only on `intent.kind`.

- Negation is evaluated per clause (comma/semicolon separated) in Czech and English.
  Purely negated commands return `rejected` and do not change state or spend narrator credits.
- “Nechci zaútočit, chci mluvit” resolves to talk; “don't buy a potion” is rejected.
- Conflicting positive verbs (for example rest + attack, travel + cast) return `ambiguous`.
- Chapter-one quest steps (`accept_caldus`, `ask_nib`, `return_bell`) route only through
  `intent.kind == quest` with `quest_step`. Caldus/Nib patterns require an imperative
  verb addressed to the NPC (for example “talk to Caldus about the shrine bell”);
  narrative mentions do not start quests.

## Supported actions

- Combat: attack (intent), cast (intent), flee, defend.
- Recovery: rest is a long rest outside combat; short-rest phrases recover partial HP.
- Exploration: explore/search/look around and travel-without-destination; six-sided
  encounter roll; safe turn after fight or escape.
- Explicit travel: `travel to <connected location>` via intent travel; only connected
  and **story-unlocked** routes (vault and pit require `vault_unlocked` or
  `vault_hint_given`). See `app/engine/locations.py`.
- Shrine bell and chapter one: Caldus/Nib/bell return, vault hint, Bell Warden defeat;
  flags include `bell_quest_accepted`, `bell_acquired`, `bell_quest_complete`,
  `vault_hint_given`, `vault_unlocked`, `chapter_one_complete` (see [CONTENT.md](./CONTENT.md)).
- Talk: quest resolution first, then a Charisma ability check when no quest line matches.
- Other free text maps to an ability check by keyword (`ACTION_ABILITIES`).

Rejected and ambiguous actions do not change state and do not consume narrator credits.

## Combat and advancement

Ruleset v1: proficiency bonus on attacks only when the class is proficient with the
equipped weapon (`reference.CLASS_SPECS` via `equipment.weapon_proficiency`), weapon
damage dice, finesse, and initiative (1d20 + Dexterity) when a fight begins.

**Ability checks** succeed when `d20 + modifier >= DC`. Natural 20 and 1 do not
auto-pass or auto-fail ability checks (attack rolls still use crit miss on 1).

The engine applies easy/normal/hard scaling to monster stats and XP. A character
advances at most one level per resolved turn.

## Spellcasting

The engine has class-specific spell lists and current/maximum slots. Cantrips use no
slot. Supported effects are Fire Bolt, Eldritch Blast, Sacred Flame, Vicious Mockery
(the next-attack disadvantage is only flagged), Magic Missile, Burning Hands, Cure
Wounds, Healing Word (treated as a main action), Scorching Ray, combat-escape Misty
Step, and Invisibility (flag only; no attack modifier).

Casting is routed only through `intent.kind == cast_spell`. Other recognized spells are
honest no-ops: the engine reports that the effect is not modeled and does not consume
a slot.

See `app/engine/service.py`, `app/engine/spells.py`, `tests/test_intent.py`,
`tests/test_chapter_one.py`, `tests/test_ruleset_v1.py`, and `tests/test_engine.py`.
