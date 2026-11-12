"""Sprint 36 — real L2–L3 class features (Cunning Action, Channel Divinity)."""

import pytest

from app.db import decode_character_state, encode_character_state
from app.engine.class_features import (
    use_action_surge,
    use_cunning_dash,
    use_cunning_disengage,
    use_preserve_life,
    use_turn_undead,
    try_hide_in_combat,
)
from app.engine.combat_reactions import is_disengaged
from app.engine.models import CharacterState, MonsterState
from app.engine.service import GameEngine
from dataclasses import asdict


def _game(seed=11):
    return GameEngine(__import__("random").Random(seed))


def _hero(klass: str, level: int = 2, **abilities):
    game = _game()
    base = {
        "strength": 10,
        "dexterity": 14,
        "constitution": 12,
        "intelligence": 10,
        "wisdom": 16,
        "charisma": 10,
    }
    base.update(abilities)
    hero = game.create_character(1, f"S36-{klass}", "human", klass, base)
    hero.level = level
    hero.speed = 30
    if klass == "cleric":
        hero.divine_domain = "life"
        hero.channel_divinity_available = level >= 2
    if klass == "fighter" and level >= 2:
        hero.action_surge_available = True
    return game, hero


def test_rogue_cunning_dash_adds_movement():
    _, rogue = _hero("rogue")
    rogue.in_combat = True
    rogue.combat_movement_remaining_ft = 10
    ok, lines, facts = use_cunning_dash(rogue)
    assert ok
    assert rogue.combat_movement_remaining_ft == 40
    assert rogue.combat_flags["bonus_action_used"]
    assert facts["movement_granted_ft"] == 30
    assert "Dash" in lines[0]


def test_rogue_cunning_disengage_sets_flag():
    _, rogue = _hero("rogue")
    rogue.in_combat = True
    ok, lines, _ = use_cunning_disengage(rogue)
    assert ok
    assert is_disengaged(rogue)
    assert rogue.combat_flags["bonus_action_used"]
    assert not use_cunning_disengage(rogue)[0]


def test_rogue_hide_still_bonus_and_once():
    game, rogue = _hero("rogue")
    rogue.in_combat = True
    game.rng.randint = lambda _a, _b: 20
    ok, _, _ = try_hide_in_combat(game, rogue)
    assert ok
    assert rogue.combat_flags["bonus_action_used"]


def test_rogue_level_two_lists_full_cunning_in_level_up():
    game = _game()
    rogue = game.create_character(1, "R", "human", "rogue")
    rogue.xp = 100
    _, facts = game._level_up(rogue)
    assert "Cunning Action" in facts["class_features_gained"]
    assert "Channel Divinity" not in facts.get("class_features_deferred", [])


def test_cleric_preserve_life_spends_channel_and_heals():
    game, cleric = _hero("cleric")
    cleric.hp = 5
    cleric.max_hp = 20
    ok, lines, facts = use_preserve_life(game, cleric)
    assert ok
    assert cleric.hp == 10  # half max (10), not full pool to 15
    assert facts["healing"] == 5
    assert not cleric.channel_divinity_available
    assert not use_preserve_life(game, cleric)[0]


def test_cleric_turn_undead_on_skeleton():
    game, cleric = _hero("cleric")
    cleric.in_combat = True
    skel = MonsterState(name="Skeleton", hp=12, max_hp=12, saving_throws={"wisdom": -1})
    game.rng.randint = lambda _a, _b: 20
    ok, lines, facts = use_turn_undead(game, cleric, skel)
    assert ok
    assert facts["save_succeeded"]
    assert skel.hp == 12
    assert not cleric.channel_divinity_available
    assert "resists" in lines[0]


def test_cleric_turn_undead_kill_via_resolve_action():
    game, cleric = _hero("cleric")
    cleric.in_combat = True
    cleric.channel_divinity_available = True
    skel = MonsterState(name="Skeleton", hp=13, max_hp=13, saving_throws={"wisdom": -1}, template_key="skeleton")
    game.rng.randint = lambda _a, _b: 1
    result, monster = game.resolve_action(cleric, "turn undead", skel)
    assert result.state_changed
    assert not cleric.channel_divinity_available
    assert monster is not None
    assert any("Turn Undead" in line for line in result.events)
    assert any("turned" in line.lower() for line in result.events)


def test_cleric_channel_recharges_on_short_rest():
    game, cleric = _hero("cleric")
    cleric.channel_divinity_available = False
    result, _ = game.resolve_action(cleric, "short rest", None)
    assert cleric.channel_divinity_available
    assert any("Channel Divinity" in line for line in result.events)


def test_fighter_action_surge_regression():
    _, fighter = _hero("fighter")
    fighter.in_combat = True
    fighter.combat_flags["action_used"] = True
    ok, _, facts = use_action_surge(fighter)
    assert ok and facts["extra_action"]
    assert not fighter.combat_flags["action_used"]
    assert not fighter.action_surge_available


def test_channel_divinity_persists_in_payload():
    _, cleric = _hero("cleric")
    cleric.channel_divinity_available = False
    payload = encode_character_state(asdict(cleric))
    restored = CharacterState(**decode_character_state(payload))
    assert restored.channel_divinity_available is False


@pytest.mark.parametrize("action", ["dash", "disengage", "hide"])
def test_rogue_cunning_via_intent_in_combat(action):
    game, rogue = _hero("rogue")
    rogue.in_combat = True
    rogue.combat_movement_remaining_ft = 15
    foe = MonsterState(name="Goblin scout", hp=7, max_hp=7)
    if action == "disengage":
        game.rng.randint = lambda _a, _b: 10
    else:
        game.rng.randint = lambda _a, _b: 18
    result, monster = game.resolve_action(rogue, action, foe)
    assert result.state_changed
    assert monster is not None or action == "hide"
