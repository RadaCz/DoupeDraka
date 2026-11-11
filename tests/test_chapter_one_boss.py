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
    for _ in range(80):
        if hero.quest_flags.get("chapter_one_complete"):
            break
        if hero.hp <= 0:
            hero.location = "The Bell Warden's Pit"
            hero.hp = hero.max_hp
            hero.in_combat = False
            hero.combatant = None
            _turn(game, hero, "attack the Bell Warden")
            continue
        if hero.in_combat and hero.combatant:
            name = MonsterState(**hero.combatant).name
            _turn(game, hero, f"attack {name}")
        else:
            _turn(game, hero, "attack the Bell Warden")

    assert hero.quest_flags.get("chapter_one_complete")
