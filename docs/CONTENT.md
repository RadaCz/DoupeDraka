# Campaign Content

## Connected locations

Location names, connections, encounter pools, discovery text, and arrival beats are
engine-owned data in `app/engine/locations.py`.

| Location | Forward route | Encounter pool | First-visit beat |
|---|---|---|---|
| The Whispering Cellar | The Sunken Corridor | Kobold, goblin, wolf, bandit | A cold draft curls around the old stone stairs. |
| The Sunken Corridor | The Shrine of the Forgotten; back to the cellar | Kobold, goblin, wolf, ghoul | Mara, a lantern-bearing scavenger, warns that something follows the waterway. |
| The Shrine of the Forgotten | The Goblin Market; back to the corridor | Bandit, ghoul, wolf | Caretaker Caldus asks the player to return a stolen shrine bell. |
| The Goblin Market | Back to the shrine | Kobold, goblin, bandit | Goblin trader Nib watches from a stall of mismatched charms and stolen bells. |

The game screen reads connected routes from `GET /reference` and offers the next
route as a contextual quick action. Travel can also be typed directly. Revisited
locations do not repeat their first-visit beat.

## Shrine bell quest

At the Shrine of the Forgotten, Caldus offers a small quest to recover the stolen
bell. At the Goblin Market, Nib returns it only after the player accepts the request.
Returning the bell to Caldus grants 30 XP and 5 gold exactly once. The engine persists
the acceptance/found/completed flags and inventory item.

## Current narrative limits

Mara, Caldus, and Nib have only the explicit actions described above; there is no
general NPC dialogue system, shop, or branching quest resolution. Discovery results
are location-specific, but there is not yet a branching campaign or a persistent map
beyond the current location and visited-location list.

The bestiary is a small SRD-derived set of six monsters. Exploration selects only
from the current location's pool, with higher-tier monsters added by character level.
The combat balance calculator is separate and does not start encounters.

## SRD reference

The spell/race/class/feat/background catalog is reference material. Only mechanics
explicitly implemented in `app/engine/` are playable. Required attribution and
license details are in the root [README](../README.md).
