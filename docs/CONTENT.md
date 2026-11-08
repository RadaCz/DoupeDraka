# Campaign Content

## Connected locations

Location names, connections, encounter pools, discovery text, and arrival beats are
engine-owned data in `app/engine/locations.py`.

| Location | Forward routes | Encounter pool | First-visit beat |
|---|---|---|---|
| The Whispering Cellar | The Sunken Corridor | Kobold, goblin, wolf, bandit | A cold draft curls around the old stone stairs. |
| The Sunken Corridor | Shrine, cellar; **The Vault of Echoes** (after Caldus reveals it) | Kobold, goblin, wolf, ghoul | Mara warns that something follows the waterway. |
| The Shrine of the Forgotten | The Goblin Market; back to the corridor | Bandit, ghoul, wolf | Caretaker Caldus asks you to return a stolen shrine bell. |
| The Goblin Market | Back to the shrine | Kobold, goblin, bandit | Goblin trader Nib watches from a stall of stolen bells. |
| The Vault of Echoes | The Bell Warden's Pit; back to the corridor | Ghoul, bandit, wolf | Broken bells hang from rusted chains. |
| The Bell Warden's Pit | Back to the vault | **Bell Warden**, ghoul | The Bell Warden stirs in the pit. |

### Optional chapter-one sites

| Location | Routes | Notes |
|---|---|---|
| The Forgotten Crypt | Underground River | One-time echo relic side reward via exploration. |
| The Bandit Camp | Goblin Market area | Extra encounters; not required for the bell arc. |
| The Underground River | Sunken Corridor, Forgotten Crypt | Flavour travel / side content. |

Ruleset v1 character creation supports **four races** and **four classes** in the engine; the `/reference` catalog lists more SRD entries for tooltips only.

The game screen reads connected routes from `GET /reference` and offers contextual
quick actions. Travel can also be typed directly (`travel to …`). Revisited locations
do not repeat their first-visit beat.

## Chapter one quests

### Shrine bell (branching intro)

At the Shrine of the Forgotten, Caldus offers a quest to recover the stolen bell. At
the Goblin Market, Nib returns it only after the player accepts the request. Returning
the bell grants 30 XP and 5 gold exactly once. Flags: `bell_quest_accepted`,
`bell_found`, `bell_acquired`, `bell_quest_complete`. The bell stays marked as obtained after delivery.

Travel to **The Vault of Echoes** and **The Bell Warden's Pit** is blocked until the player
returns the bell, speaks with Caldus again, and the engine sets `vault_unlocked` (together with
`vault_hint_given`).

### Vault finale (after the bell)

After the bell is returned, speaking with Caldus again reveals the route to
**The Vault of Echoes**. The **Bell Warden** miniboss guards the pit; defeating it sets
`chapter_one_complete`, awards bonus gold, and closes the first chapter arc.

## Current narrative limits

Mara, Caldus, and Nib have explicit engine actions only; general NPC dialogue is still
limited. The six-location region is a complete vertical slice, not an open world.

The bestiary is a small SRD-derived set plus the Bell Warden. Exploration rolls use
each location's pool. The combat balance calculator is separate and does not start
encounters.

## SRD reference

The spell/race/class/feat/background catalog is reference material. Only mechanics
explicitly implemented in `app/engine/` are playable. Required attribution and
license details are in the root [README](../README.md).
