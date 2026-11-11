# Ruleset v1 (engine authority)

Canonical rules live in [`../design/RULESET_v1.md`](../design/RULESET_v1.md). This file exists so sprint docs can reference `docs/RULESET_v1.md` without duplicating content.

**Sprint 19.1 combat notes (2026-11-11):**

- Ghoul **Paralyzing Claws:** weapon damage, then CON save DC 10; on fail, `paralyzed` (incapacitated, auto-fail STR/DEX saves, attacks vs target have advantage). Repeat CON save at **end of each of the target's turns**; success ends paralysis.
- Melee hits vs a paralyzed creature within reach are **critical** (`enemy_attack_is_melee()` — catalog defaults to melee; `RANGED_ATTACK_MONSTERS` for exceptions).
- `disadvantage_next_attack` on monsters is consumed on the next attack roll only (Vicious Mockery).
