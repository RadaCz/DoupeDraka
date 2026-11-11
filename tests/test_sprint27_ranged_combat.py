"""Sprint 27 — weapon ranges and combat positioning."""

from __future__ import annotations

import random

import pytest

from app.engine.combat_positioning import (
    MELEE_REACH_FT,
    apply_player_movement,
    enemy_can_melee_attack,
    init_combat_distance,
    movement_remaining,
)
from app.engine.combat_range import evaluate_player_attack_range, has_ammunition
from app.engine.equipment import WEAPONS, equipped_weapon
from app.engine.models import CharacterState, MonsterState
from app.engine.service import GameEngine


@pytest.fixture
def game() -> GameEngine:
    return GameEngine(random.Random(7))


def _archer(game: GameEngine) -> CharacterState:
    return game.create_character(
        1,
        "Archer",
        "human",
        "fighter",
        background="folk_hero",
        class_skills=["Athletics", "Perception"],
        equipment_package="archer",
    )


def test_longbow_out_of_range_denied(game: GameEngine):
    archer = _archer(game)
    bow = WEAPONS["longbow"]
    archer.combat_distance_ft = 700
    ctx = evaluate_player_attack_range(archer, bow)
    assert not ctx.allowed


def test_longbow_long_range_disadvantage(game: GameEngine):
    archer = _archer(game)
    bow = WEAPONS["longbow"]
    archer.combat_distance_ft = 200
    ctx = evaluate_player_attack_range(archer, bow)
    assert ctx.allowed and ctx.disadvantage and ctx.reason == "long range"


def test_ranged_melee_disadvantage(game: GameEngine):
    archer = _archer(game)
    bow = WEAPONS["shortbow"]
    archer.combat_distance_ft = 5
    ctx = evaluate_player_attack_range(archer, bow)
    assert ctx.allowed and ctx.disadvantage and ctx.reason == "ranged in melee"


def test_melee_out_of_reach_denied(game: GameEngine):
    archer = _archer(game)
    sword = WEAPONS["shortsword"]
    archer.combat_distance_ft = 30
    ctx = evaluate_player_attack_range(archer, sword)
    assert not ctx.allowed


def test_movement_budget_and_advance(game: GameEngine):
    archer = _archer(game)
    archer.in_combat = True
    archer.combatant = {"name": "Kobold"}
    init_combat_distance(archer, "kobold")
    start = movement_remaining(archer)
    ok, lines = apply_player_movement(archer, -15)
    assert ok and archer.combat_distance_ft == 45
    assert movement_remaining(archer) == start - 15


def test_attack_out_of_range_no_action_spent(game: GameEngine):
    archer = _archer(game)
    archer.in_combat = True
    archer.combat_turn = "player"
    archer.combat_distance_ft = 650
    for entry in archer.item_instances:
        if entry.get("equipped_slot") == "weapon":
            entry["definition_id"] = "longbow"
            entry["name"] = "longbow"
    monster = MonsterState(name="Goblin scout", hp=7, max_hp=7, armor_class=13, attack_bonus=4, damage="1d6+2", template_key="goblin")
    result, _ = game.resolve_action(archer, "attack goblin", monster)
    joined = " ".join(result.events).casefold()
    assert "beyond" in joined or "cannot reach" in joined
    assert not result.state_changed
    assert not archer.combat_flags.get("action_used")


def test_init_combat_distance_persists(game: GameEngine):
    archer = _archer(game)
    lines = init_combat_distance(archer, "kobold")
    assert archer.combat_distance_ft == 60
    assert lines


def test_has_ammunition_requires_arrows(game: GameEngine):
    archer = _archer(game)
    assert has_ammunition(archer, WEAPONS["longbow"])
    archer.inventory = [i for i in archer.inventory if "arrow" not in i.casefold()]
    assert not has_ammunition(archer, WEAPONS["longbow"])
