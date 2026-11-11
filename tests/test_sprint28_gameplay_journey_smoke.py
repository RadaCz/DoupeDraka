"""Sprint 28 — high-value journey smoke via public ``GameEngine.resolve_action`` only."""

from __future__ import annotations

import random

import pytest

from app.engine.models import MonsterState
from app.engine.service import GameEngine

pytestmark = [pytest.mark.integration, pytest.mark.regress]


@pytest.fixture
def game() -> GameEngine:
    return GameEngine(random.Random(28))


def test_advance_then_melee_attack_when_out_of_initial_range(game: GameEngine):
    hero = game.create_character(1, "Charger", "human", "fighter")
    hero.in_combat = True
    hero.combat_turn = "player"
    hero.combat_distance_ft = 60
    hero.combat_movement_remaining_ft = 60
    hero.combatant = {"name": "Kobold", "hp": 8, "max_hp": 8, "armor_class": 12}
    monster = MonsterState(
        name="Kobold",
        hp=8,
        max_hp=8,
        armor_class=12,
        attack_bonus=3,
        damage="1d4+1",
        template_key="kobold",
    )
    move, _ = game.resolve_action(hero, "advance 55 ft", monster)
    assert move.state_changed
    assert hero.combat_distance_ft == 5
    atk, _ = game.resolve_action(hero, "attack kobold", monster)
    joined = " ".join(atk.events).casefold()
    assert atk.state_changed or "miss" in joined or "hit" in joined
