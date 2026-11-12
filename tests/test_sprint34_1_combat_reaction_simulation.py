"""Sprint 34.1 — automated combat loops resolve Shield reaction windows via decline."""

from __future__ import annotations

import random

import pytest

from app.engine.models import MonsterState
from app.engine.reactive_spells import has_pending_reaction
from app.engine.service import GameEngine
from tests.combat_turn_helpers import (
    resolve_combat_action_for_simulation,
    resolve_pending_reaction_for_simulation,
)
from tools.simulate_story_main_path import simulate_main_path


def test_wizard_sim_declines_pending_and_uses_stored_attack_roll():
    game = GameEngine(random.Random(42))
    hero = game.create_character(1, "W", "human", "wizard")
    if "Shield" not in hero.known_spells:
        hero.known_spells.append("Shield")
    hero.in_combat = True
    hero.combat_turn = "reaction"
    hero.hp = 20
    hero.combat_reaction_pending = {
        "kind": "shield_vs_attack",
        "natural": 12,
        "attack_total": 15,
        "damage_dice": "1d6",
        "damage_bonus": 2,
        "critical": False,
        "melee": True,
        "monster_name": "Kobold",
        "monster_key": "kobold",
        "label": "attack",
    }
    monster = MonsterState(name="Kobold", hp=5, max_hp=5, armor_class=12, attack_bonus=4, damage="1d6+2")
    hp_before = hero.hp
    monster_ref = resolve_pending_reaction_for_simulation(game, hero, monster)
    assert not has_pending_reaction(hero)
    assert hero.combat_turn == "player"
    assert hero.combat_reaction_pending == {}
    if hero.in_combat:
        assert monster_ref is not None
    assert hero.hp < hp_before


def test_wizard_main_path_seed_42_reaches_level_3():
    row = simulate_main_path("wizard", 42, include_crypt=False)
    assert row["level"] >= 3
    assert row["vault_story_awarded"]


def test_fighter_attack_loop_not_stuck_on_reaction():
    game = GameEngine(random.Random(7))
    hero = game.create_character(1, "F", "human", "fighter")
    monster = MonsterState(name="Goblin scout", hp=30, max_hp=30, armor_class=12, attack_bonus=4, damage="1d6+2")
    hero.in_combat = True
    hero.combat_turn = "player"
    for _ in range(40):
        if hero.hp <= 0 or monster.hp <= 0:
            break
        _, monster = resolve_combat_action_for_simulation(game, hero, f"attack {monster.name}", monster)
        if not hero.in_combat:
            break
    assert hero.combat_turn != "reaction"
    assert not has_pending_reaction(hero)
