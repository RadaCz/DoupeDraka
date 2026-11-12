"""Sprint 29 — opportunity attacks, Disengage, reaction economy."""

from __future__ import annotations

import random

import pytest

from app.engine.combat_action_economy import FLAG_REACTION_USED, spend_reaction
from app.engine.combat_positioning import MELEE_REACH_FT, apply_player_movement
from app.engine.combat_reactions import (
    FLAG_DISENGAGED,
    FLAG_ENEMY_REACTION_USED,
    movement_left_melee_reach,
    reset_enemy_reaction_for_new_enemy_turn,
    set_disengaged,
)
from app.engine.equipment import load_character_state
from app.engine.models import MonsterState
from app.engine.service import GameEngine


@pytest.fixture
def game() -> GameEngine:
    return GameEngine(random.Random(29))


def _melee_combat(game: GameEngine):
    hero = game.create_character(1, "Hero", "human", "fighter")
    hero.in_combat = True
    hero.combat_turn = "player"
    hero.combat_distance_ft = MELEE_REACH_FT
    hero.combat_movement_remaining_ft = 30
    hero.combat_flags = {}
    monster = MonsterState(
        name="Goblin",
        hp=12,
        max_hp=12,
        armor_class=12,
        attack_bonus=4,
        damage="1d6+2",
        template_key="goblin",
    )
    hero.combatant = {
        "name": monster.name,
        "hp": monster.hp,
        "max_hp": monster.max_hp,
        "armor_class": monster.armor_class,
    }
    return hero, monster


def test_movement_left_melee_reach_unit():
    assert movement_left_melee_reach(5, 10)
    assert movement_left_melee_reach(5, 6)
    assert not movement_left_melee_reach(10, 20)
    assert not movement_left_melee_reach(5, 5)


def test_step_back_provokes_enemy_opportunity_attack(game: GameEngine):
    hero, monster = _melee_combat(game)
    result, _ = game.resolve_action(hero, "step back 10 ft", monster)
    assert any("opportunity attack" in e.casefold() for e in result.events)
    assert hero.combat_flags.get(FLAG_ENEMY_REACTION_USED)


def test_move_within_reach_does_not_provoke(game: GameEngine):
    hero, monster = _melee_combat(game)
    hero.combat_distance_ft = MELEE_REACH_FT + 5
    hero.combat_movement_remaining_ft = 30
    result, _ = game.resolve_action(hero, "step back 5 ft", monster)
    joined = " ".join(result.events).casefold()
    assert "opportunity attack" not in joined
    assert not hero.combat_flags.get(FLAG_ENEMY_REACTION_USED)


def test_disengage_prevents_opportunity_attack(game: GameEngine):
    hero, monster = _melee_combat(game)
    d, _ = game.resolve_action(hero, "disengage", monster)
    assert d.state_changed
    assert hero.combat_flags.get(FLAG_DISENGAGED)
    move, _ = game.resolve_action(hero, "step back 15 ft", monster)
    assert any("disengage prevents" in e.casefold() for e in move.events)
    assert not hero.combat_flags.get(FLAG_ENEMY_REACTION_USED)


def test_disengage_consumes_action(game: GameEngine):
    hero, monster = _melee_combat(game)
    result, _ = game.resolve_action(hero, "disengage", monster)
    assert result.state_changed
    assert hero.combat_flags.get("action_used")
    second, _ = game.resolve_action(hero, "disengage", monster)
    assert not second.state_changed


def test_enemy_reaction_only_once_per_round(game: GameEngine):
    hero, monster = _melee_combat(game)
    game.resolve_action(hero, "step back 10 ft", monster)
    hero.combat_distance_ft = MELEE_REACH_FT
    hero.combat_movement_remaining_ft = 30
    hero.combat_flags.pop(FLAG_DISENGAGED, None)
    again, _ = game.resolve_action(hero, "step back 10 ft", monster)
    assert any("already used its reaction" in e.casefold() for e in again.events)


def test_player_opportunity_attack_spends_reaction(game: GameEngine):
    hero, monster = _melee_combat(game)
    hero.combat_turn = "enemy"
    hero.combat_flags[FLAG_REACTION_USED] = False
    before_ft = hero.combat_distance_ft
    from app.engine.combat_positioning import enemy_retreat_from_melee, monster_profile

    enemy_retreat_from_melee(hero, monster_profile("goblin"), target_ft=30)
    events, _ = game._player_opportunity_attack_on_enemy(hero, monster)
    assert any("opportunity attack" in e.casefold() for e in events)
    assert hero.combat_flags.get(FLAG_REACTION_USED)
    assert movement_left_melee_reach(before_ft, hero.combat_distance_ft)


def test_forced_movement_helper_does_not_trigger_oa_engine_path(game: GameEngine):
    """apply_player_movement alone does not fire OA — only resolve_action combat move."""
    hero, monster = _melee_combat(game)
    before = hero.combat_distance_ft
    ok, _ = apply_player_movement(hero, 10)
    assert ok and movement_left_melee_reach(before, hero.combat_distance_ft)
    assert not hero.combat_flags.get(FLAG_ENEMY_REACTION_USED)


def test_reaction_resets_on_player_turn_start(game: GameEngine):
    hero, monster = _melee_combat(game)
    spend_reaction(hero)
    assert hero.combat_flags[FLAG_REACTION_USED]
    from app.engine.class_features import mark_player_turn_start

    mark_player_turn_start(hero)
    assert not hero.combat_flags.get(FLAG_REACTION_USED)
    assert not hero.combat_flags.get(FLAG_DISENGAGED)


def test_enemy_reaction_resets_on_enemy_turn(game: GameEngine):
    hero, monster = _melee_combat(game)
    hero.combat_flags[FLAG_ENEMY_REACTION_USED] = True
    reset_enemy_reaction_for_new_enemy_turn(hero)
    assert not hero.combat_flags.get(FLAG_ENEMY_REACTION_USED)


def test_combat_state_survives_reload_with_reaction_flags(game: GameEngine):
    hero, monster = _melee_combat(game)
    set_disengaged(hero, True)
    spend_reaction(hero)
    hero.combat_flags[FLAG_ENEMY_REACTION_USED] = True
    from dataclasses import asdict

    restored = load_character_state(asdict(hero))
    assert restored.combat_flags.get(FLAG_DISENGAGED)
    assert restored.combat_flags.get(FLAG_REACTION_USED)
