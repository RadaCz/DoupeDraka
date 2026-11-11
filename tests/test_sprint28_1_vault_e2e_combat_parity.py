"""Sprint 28.1 — E2E vault helper used attack-only; Sprint 27 opens kobold at 60 ft."""

from __future__ import annotations

import random

from app.engine.models import MonsterState
from app.engine.quests import resolve_main_quest_step
from app.engine.service import GameEngine

from tests.combat_turn_helpers import resolve_combat_action_for_simulation


def _bell_arc_to_vault_unlocked(game: GameEngine, hero) -> None:
    def level_up(h):
        return game._level_up(h)

    hero.location = "The Shrine of the Forgotten"
    resolve_main_quest_step(hero, "talk", "accept_caldus", level_up)
    hero.location = "The Goblin Market"
    resolve_main_quest_step(hero, "talk", "ask_nib", level_up)
    hero.location = "The Shrine of the Forgotten"
    resolve_main_quest_step(hero, "return", "return_bell", level_up)
    resolve_main_quest_step(hero, "talk", "accept_caldus", level_up)


def test_vault_descent_attack_only_stalls_at_l1_like_e2e_helper():
    game = GameEngine(random.Random(1))
    hero = game.create_character(1, "E2E", "human", "fighter")
    _bell_arc_to_vault_unlocked(game, hero)
    assert hero.xp == 80 and hero.level == 1

    hero.location = "The Sunken Corridor"
    _, monster = game._travel(hero, "travel to The Vault of Echoes")
    for _ in range(40):
        if hero.quest_flags.get("vault_first_descent_story_awarded"):
            break
        if not hero.in_combat or not monster:
            _, monster = game._travel(hero, "travel to The Vault of Echoes")
            if hero.combatant:
                monster = MonsterState(**hero.combatant)
            continue
        game.resolve_action(hero, f"attack {monster.name}", monster)
        flags = hero.combat_flags or {}
        if hero.in_combat and hero.combat_turn == "player" and flags.get("action_used"):
            game.resolve_action(hero, "end turn", monster)
        if hero.combatant:
            monster = MonsterState(**hero.combatant)
        elif not hero.in_combat:
            monster = None

    assert hero.level == 1
    assert hero.xp == 80
    assert not hero.quest_flags.get("vault_first_descent_story_awarded")
    assert hero.in_combat
    assert hero.combat_distance_ft == 60


def test_vault_descent_with_engine_advance_reaches_l3():
    game = GameEngine(random.Random(1))
    hero = game.create_character(1, "E2E", "human", "fighter")
    _bell_arc_to_vault_unlocked(game, hero)
    hero.location = "The Sunken Corridor"
    _, monster = game._travel(hero, "travel to The Vault of Echoes")
    for _ in range(40):
        if hero.quest_flags.get("vault_first_descent_story_awarded"):
            break
        if hero.hp <= 0:
            game._recover_from_combat_defeat(hero)
            monster = None
            continue
        if monster is None:
            _, monster = game._travel(hero, "travel to The Vault of Echoes")
        if hero.in_combat and monster:
            _, monster = resolve_combat_action_for_simulation(
                game, hero, f"attack {monster.name}", monster,
            )
            if hero.combatant:
                monster = MonsterState(**hero.combatant)
            elif not hero.in_combat:
                monster = None

    assert hero.quest_flags.get("vault_first_descent_story_awarded")
    assert hero.level >= 3
