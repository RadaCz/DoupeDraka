# Sprint 34 — Inventory & equipment gameplay acceptance

## Git baseline
- Branch: `clean-main` @ `4184746` (Sprint 33 pushed) before local Sprint 34 edits.
- No destructive git operations; no commit/push in sprint close.

## Inventory model (unchanged authority)
- **`inventory`**: list of display labels (quantity = duplicate labels).
- **`item_instances`**: one row per stack label with `instance_id`, `definition_id`, `item_kind`, `equipped_slot`, `attack_bonus`.
- **Equip state**: `equipped_slot` ∈ `weapon` | `armor` | `shield`; sync via `sync_item_instances()` after inventory mutations.
- **Sprint 34 tweak**: `sync_item_instances` preserves `instance_id` per label when consumption removes items.

## Gameplay delivered / hardened
| Area | Status |
|------|--------|
| Equip / unequip | Existing Sprint 17 flow; blocks during reaction window (engine + UI) |
| AC | `compute_armor_class()` unchanged authority; Mage Armor + worn armor interaction tested |
| Potion | SRD **2d4+2** (fixed; removed CON modifier from heal roll) |
| Combat potion | Spends **Action**; enemy turn follows via `_maybe_advance_enemy_after_player_action` |
| Reaction window | `use potion` / `equip` rejected while `combat_reaction_pending` (Sprint 33 gate) |
| Shop / rewards | No new loot tables; shop + existing rewards unchanged |

## UI
- `CharacterInventoryPanel` (Sprint 17): grouped weapons / armor / consumables / gear; equip, unequip, use potion.
- Sprint 34: EN/CS strings for blocked actions during reaction window.

## Tests (local)
- `tests/test_sprint34_inventory_gameplay.py` (12 cases)
- Sprint 33 regression covered in same file (pending payload, shield gate, equip/potion block)
- `frontend/e2e/inventory-gameplay.spec.ts` (shop + potion + reload; uses API + Character UI)

## Not run in this session
- Full `regress` / `full` / `slow` / Playwright matrix / `secret_scan` — run before release sign-off.

## Verdict
**READY FOR REVIEW** (local engine + fast suite), pending full regression matrix and E2E execution.
