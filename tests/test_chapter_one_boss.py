"""Chapter-one finale: Bell Warden defeat sets chapter_one_complete (engine-only)."""

import random
from dataclasses import asdict

from app.engine.models import MonsterState
from app.engine.service import GameEngine

from tests.combat_turn_helpers import resolve_combat_action_for_simulation


def _pit_hero(game: GameEngine):
    hero = game.create_character(1, "Champion", "human", "fighter")
    hero.quest_flags = {"vault_unlocked": True}
    hero.location = "The Bell Warden's Pit"
  # Level 4+ so tier-3 Bell Warden is allowed.
    for _ in range(4):
        game._grant_xp(hero, 100)
    hero.hp = hero.max_hp
    return hero


def _turn(game: GameEngine, hero, action: str):
    monster = MonsterState(**hero.combatant) if hero.combatant else None
    result, active = resolve_combat_action_for_simulation(game, hero, action, monster)
    hero.combatant = asdict(active) if active else None
    return result


def test_chapter_one_bell_warden_completes_chapter():
    game = GameEngine(random.Random(42))
    hero = _pit_hero(game)
    _turn(game, hero, "attack the Bell Warden")
    prior_foe_hp = None
    stall = 0
    for round_i in range(120):
        if hero.quest_flags.get("chapter_one_complete"):
            break
        # MVP defeat leaves 1 HP at a safe hub — not hp<=0.
        left_pit = "Pit" not in (hero.location or "") and "Bell Warden" not in (hero.location or "")
        if hero.hp <= 0 or (not hero.in_combat and left_pit):
            hero.location = "The Bell Warden's Pit"
            hero.hp = max(hero.max_hp // 2, 1)
            hero.death_state = "alive"
            hero.in_combat = False
            hero.combatant = None
            prior_foe_hp = None
            stall = 0
            _turn(game, hero, "attack the Bell Warden")
            continue
        if hero.in_combat and hero.combatant:
            foe = MonsterState(**hero.combatant)
            if prior_foe_hp is not None and foe.hp >= prior_foe_hp:
                stall += 1
            else:
                stall = 0
            prior_foe_hp = foe.hp
            assert stall < 20, f"boss stall round={round_i} foe_hp={foe.hp} hero_hp={hero.hp}"
            _turn(game, hero, f"attack {foe.name}")
        else:
            _turn(game, hero, "attack the Bell Warden")

    assert hero.quest_flags.get("chapter_one_complete")


def test_bell_warden_attackable_at_1_hp_after_respawn():
    """MVP defeat leaves 1 HP at the hub — boss must still open combat when returning to the pit."""
    game = GameEngine(random.Random(18))
    hero = _pit_hero(game)
    hero.level = 3
    while hero.level < 3:
        game._grant_xp(hero, 100)
    hero.hp = 1
    hero.in_combat = False
    hero.combatant = None
    hero.location = "The Bell Warden's Pit"
    result, monster = game.resolve_action(hero, "attack the Bell Warden", None)
    assert result.state_changed or hero.in_combat
    assert hero.in_combat or monster is not None
