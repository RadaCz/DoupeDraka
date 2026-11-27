"""Combat P0a — spell range vs combat_distance_ft."""

from __future__ import annotations

import random

import pytest

from app.api import character_api_payload
from app.engine.models import MonsterState
from app.engine.service import GameEngine
from tests.test_spells import create_hero, force_high_rolls


@pytest.fixture
def game() -> GameEngine:
    return GameEngine(random.Random(11))


def _wizard_in_combat(distance_ft: int):
    hero = create_hero("wizard", intelligence=16)
    hero.in_combat = True
    hero.combat_turn = "player"
    hero.combat_distance_ft = distance_ft
    hero.combatant = {"name": "Goblin scout"}
    from app.engine.class_features import mark_player_turn_start

    mark_player_turn_start(hero)
    for spell in ("Fire Bolt", "Magic Missile", "Burning Hands", "Scorching Ray"):
        if spell not in hero.known_spells:
            hero.known_spells.append(spell)
    hero.spell_slots = {1: 2, 2: 1}
    monster = MonsterState(
        name="Goblin scout",
        hp=12,
        max_hp=12,
        armor_class=13,
        attack_bonus=4,
        damage="1d6+2",
        template_key="goblin",
    )
    return hero, monster


def _cleric_in_combat(distance_ft: int):
    hero = create_hero("cleric", wisdom=16)
    hero.in_combat = True
    hero.combat_turn = "player"
    hero.combat_distance_ft = distance_ft
    hero.combatant = {"name": "Goblin scout"}
    from app.engine.class_features import mark_player_turn_start

    mark_player_turn_start(hero)
    if "Sacred Flame" not in hero.prepared_spells:
        hero.prepared_spells.append("Sacred Flame")
    if "Cure Wounds" not in hero.prepared_spells:
        hero.prepared_spells.append("Cure Wounds")
    hero.max_hp = 24
    hero.hp = 8
    monster = MonsterState(name="Goblin scout", hp=12, max_hp=12, armor_class=13)
    return hero, monster


@pytest.mark.parametrize("spell", ["Fire Bolt", "Magic Missile", "Scorching Ray"])
def test_offensive_spell_within_range(game: GameEngine, spell: str):
    force_high_rolls(game)
    hero, monster = _wizard_in_combat(120)
    result, _ = game.resolve_action(hero, f"cast {spell}", monster)
    assert result.state_changed


@pytest.mark.parametrize("spell", ["Fire Bolt", "Magic Missile", "Scorching Ray"])
def test_offensive_spell_beyond_range_no_cost(game: GameEngine, spell: str):
    hero, monster = _wizard_in_combat(121)
    slots_before = dict(hero.spell_slots)
    result, _ = game.resolve_action(hero, f"cast {spell}", monster)
    assert not result.state_changed
    assert hero.spell_slots == slots_before
    assert not hero.combat_flags.get("action_used")
    assert "ft away" in " ".join(result.events)


def test_sacred_flame_on_range_boundary(game: GameEngine):
    force_high_rolls(game)
    hero, monster = _cleric_in_combat(60)
    ok, _ = game.resolve_action(hero, "cast Sacred Flame", monster)
    assert ok.state_changed


def test_sacred_flame_beyond_sixty_denied(game: GameEngine):
    hero, monster = _cleric_in_combat(61)
    slots = dict(hero.spell_slots)
    deny, _ = game.resolve_action(hero, "cast Sacred Flame", monster)
    assert not deny.state_changed
    assert hero.spell_slots == slots
    assert "Sacred Flame" in deny.events[0]


def test_burning_hands_fifteen_vs_twenty(game: GameEngine):
    force_high_rolls(game)
    hero, monster = _wizard_in_combat(15)
    slots = dict(hero.spell_slots)
    ok, _ = game.resolve_action(hero, "cast Burning Hands", monster)
    assert ok.state_changed

    hero, monster = _wizard_in_combat(20)
    slots = dict(hero.spell_slots)
    deny, _ = game.resolve_action(hero, "cast Burning Hands", monster)
    assert not deny.state_changed
    assert hero.spell_slots == slots


def test_healing_spell_always_ok_at_any_distance(game: GameEngine):
    force_high_rolls(game)
    hero, monster = _cleric_in_combat(200)
    slots = dict(hero.spell_slots)
    result, _ = game.resolve_action(hero, "cast Cure Wounds", monster)
    assert result.state_changed
    assert hero.spell_slots != slots


def test_combat_tactics_spells_payload():
    hero, _ = _wizard_in_combat(121)
    payload = character_api_payload(hero)
    spells = payload["combat_tactics"]["spells"]
    by_name = {row["name"]: row for row in spells}
    assert by_name["Fire Bolt"]["range_ft"] == 120
    assert by_name["Fire Bolt"]["can_cast"] is False
    assert by_name["Fire Bolt"]["denial"]
    assert by_name["Burning Hands"]["range_ft"] == 15
    assert by_name["Burning Hands"]["can_cast"] is False