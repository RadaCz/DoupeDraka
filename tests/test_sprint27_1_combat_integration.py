"""Sprint 27.1 — COMBAT_MOVE intent and encounter distance initialization."""

from __future__ import annotations

import random

import pytest

from app.engine.combat_positioning import ensure_encounter_distance, movement_remaining
from app.engine.intent import COMBAT_MOVE, parse_action_intent
from app.engine.models import MonsterState
from app.engine.service import GameEngine


@pytest.fixture
def game() -> GameEngine:
    return GameEngine(random.Random(11))


def test_combat_move_intent_advance_and_reject_zero():
    intent = parse_action_intent("advance 15 ft")
    assert intent.kind == COMBAT_MOVE
    assert intent.move_delta_ft == -15
    bad = parse_action_intent("advance 0 ft")
    assert bad.kind == "rejected"


def test_combat_move_via_resolve_action(game: GameEngine):
    hero = game.create_character(1, "Mover", "human", "fighter")
    hero.in_combat = True
    hero.combat_turn = "player"
    hero.combat_distance_ft = 40
    hero.combat_movement_remaining_ft = 30
    hero.combatant = {"name": "Kobold", "hp": 5, "max_hp": 5, "armor_class": 12}
    monster = MonsterState(name="Kobold", hp=5, max_hp=5, armor_class=12, attack_bonus=3, damage="1d4+1", template_key="kobold")
    result, _ = game.resolve_action(hero, "advance 15 ft", monster)
    assert result.state_changed
    assert hero.combat_distance_ft == 25
    assert movement_remaining(hero) == 15
    assert not hero.combat_flags.get("action_used")


def test_ensure_encounter_distance_idempotent(game: GameEngine):
    hero = game.create_character(1, "T", "human", "fighter")
    hero.in_combat = True
    first = ensure_encounter_distance(hero, "kobold")
    assert hero.combat_distance_ft == 60 and first
    second = ensure_encounter_distance(hero, "goblin")
    assert hero.combat_distance_ft == 60 and not second


def test_kobold_enemy_ranged_at_distance(game: GameEngine):
    hero = game.create_character(1, "Target", "human", "fighter")
    hero.in_combat = True
    hero.combat_turn = "enemy"
    hero.combat_distance_ft = 60
    hero.combat_flags = {"action_used": True}
    monster = MonsterState(name="Kobold skirmisher", hp=5, max_hp=5, armor_class=12, attack_bonus=3, damage="1d4+1", template_key="kobold")
    events, _ = game._enemy_turn(hero, monster)
    joined = " ".join(events).casefold()
    assert "ranged" in joined or "miss" in joined or "hits" in joined
    assert hero.combat_turn == "player"
