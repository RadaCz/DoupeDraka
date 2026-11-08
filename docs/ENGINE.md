# Game Engine

## Core rule

Mechanics are resolved by `app/engine/service.py`; the LLM is never an authority for
game state. Dice are rolled through the engine's injected RNG, and every effect sent
to the narrator is already resolved.

## Supported actions

- Combat: `attack`, `cast`, `flee`.
- Recovery: `rest` is a free long rest outside combat; it restores HP and spell slots.
- Exploration: `explore`, `search`, `look around`, `travel`, and supported Czech
  variants. Encounters are rolled on a six-sided die; an encounter appears on 1, and
  the turn immediately after a fight or escape is safe.
- Explicit travel: `travel to <connected location>` changes location without an
  exploration roll. Only connected routes are allowed. First visits write a short
  NPC/story beat to the journal.
- Shrine bell quest: accept Caldus's request, ask Nib for the bell, and return it to
  receive 30 XP and 5 gold. Quest flags and item/reward changes are engine-owned,
  persisted character state; repeated completions are no-ops.
- Other free text resolves to an ability check selected from intent keywords.

Rejected actions do not change state and do not consume Adventure Mana. Rest while in
combat is rejected.

## Combat and advancement

The engine applies easy/normal/hard scaling to monster stats and XP. A character
advances at most one level per resolved turn. Current supported progression and
spell behavior are bounded; see the spell limitations below.

## Spellcasting

The engine has class-specific spell lists and current/maximum slots. Cantrips use no
slot. Supported effects are Fire Bolt, Eldritch Blast, Sacred Flame, Vicious Mockery
(the next-attack disadvantage is only flagged), Magic Missile, Burning Hands, Cure
Wounds, Healing Word (treated as a main action), Scorching Ray, combat-escape Misty
Step, and Invisibility (flag only; no attack modifier).

Other recognized spells are honest no-ops: the engine reports that the effect is not
modeled and does not consume a slot. Area and save effects currently target one
enemy. Higher-level class progression, concentration, durations, many spell
conditions, and complete SRD spell effects are not implemented.

See `app/engine/service.py`, `app/engine/spells.py`, and `tests/test_locations.py`,
`tests/test_engine.py`, and `tests/test_spells.py`.
