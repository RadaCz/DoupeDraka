# Mini App UI etapa (clean-main)

## UI-1 Done

- Bottom nav: Play, Map, Quests, Hero, More (5 columns).
- More hub: Journal, Settings, Rules & spells (Tools), Campaign mood.
- Bottom nav hidden on Home / character creation.
- Tap targets: 48px nav height, 12px labels; quick action cards 72px min-height.

## UI-2 Done

- Game screen quick-action grid: explore, talk, travel (opens map), custom (focuses composer).
- Combat: attack, defend, flee, optional cast spell / use potion.
- Quick actions execute immediately (no fill-then-submit for chips).

## UI-3 Done

- Chapter-one graph map with node states: current, adjacent, visited, locked, hidden.
- Edges and legend; route list for current location.

## UI-4 Done

- Quest tracker with guided **next step** from `quest_flags`.
- Step list with done / active / pending states.

## UI-5 Done

- Character sheet split into collapsible panels: combat & resources, abilities, inventory.
- Summary strip with AC / HP / gold.

## UI-6 Done

- Telegram `themeParams` applied to shell colors when available.
- `BackButton` on More sub-screens and secondary screens.
- Haptic success feedback when a streamed turn completes.

## Deferred

- Full design/direction.md parchment theme migration (palette typography overhaul).
- UI-7+: journal-as-interface marginal notes, shop screen, generated narration locale.
