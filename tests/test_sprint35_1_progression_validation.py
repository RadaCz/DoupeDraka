"""Sprint 35.1 — progression audit, HP edge cases, Action Surge, Cunning Action, persistence."""

from __future__ import annotations

import random
from dataclasses import asdict

import pytest

from app.db import decode_character_state, encode_character_state
from app.engine.chapter_one_progression import (
    XP_PER_LEVEL,
    apply_xp_with_level_ups,
    award_vault_route_reveal_xp,
)
from app.engine.class_features import try_hide_in_combat, use_action_surge
from app.engine.level_progression import average_hit_die_gain, hp_gain_on_level_up
from app.engine.models import CharacterState, MonsterState
from app.engine.ruleset_v1 import MAX_MVP_LEVEL
from app.engine.service import GameEngine, XP_THRESHOLD
from app.engine.spells import spell_slot_progression


def _hero(klass: str, **abilities) -> CharacterState:
    game = GameEngine(random.Random(11))
    base = {
        "strength": 10,
        "dexterity": 10,
        "constitution": 10,
        "intelligence": 10,
        "wisdom": 10,
        "charisma": 10,
    }
    base.update(abilities)
    return game.create_character(1, f"audit-{klass}", "human", klass, base)


def _game() -> GameEngine:
    return GameEngine(random.Random(12))


@pytest.mark.parametrize(
    ("start_xp", "grant", "expected_level", "expected_xp"),
    [
        (0, 99, 1, 99),
        (0, 100, 2, 0),
        (99, 1, 2, 0),
        (0, 199, 2, 99),
        (0, 200, 3, 0),
        (0, 250, 3, 50),
    ],
)
def test_story_xp_level_boundaries(start_xp, grant, expected_level, expected_xp):
    game = _game()
    hero = _hero("fighter")
    hero.xp = start_xp
    apply_xp_with_level_ups(hero, grant, game._level_up)
    assert hero.level == expected_level
    assert hero.xp == expected_xp


def test_combat_kill_single_level_with_carry():
    game = _game()
    hero = _hero("fighter", strength=16)
    enemy = MonsterState(hp=1, max_hp=1, reward_xp=250)
    game.rng.randint = lambda _a, _b: 20
    game.resolve_action(hero, "attack", enemy)
    assert hero.level == 2
    assert hero.xp == 150


def test_idempotent_story_xp_no_double_level():
    game = _game()
    hero = _hero("cleric")
    first_events, _, ok1 = award_vault_route_reveal_xp(hero, game._level_up)
    assert ok1
    level_after_first = hero.level
    xp_after_first = hero.xp
    second_events, _, ok2 = award_vault_route_reveal_xp(hero, game._level_up)
    assert not ok2
    assert hero.level == level_after_first
    assert hero.xp == xp_after_first
    assert not second_events


@pytest.mark.parametrize("con", [8, 10, 16])
@pytest.mark.parametrize("current_hp_mode", ["full", "damaged", "one", "zero"])
def test_hp_level_up_preserves_wounds_unless_dead(con, current_hp_mode):
    game = _game()
    hero = _hero("fighter")
    hero.abilities["constitution"] = con
    gain = hp_gain_on_level_up(hero)
    if current_hp_mode == "full":
        hero.hp = hero.max_hp
    elif current_hp_mode == "damaged":
        hero.hp = max(1, hero.max_hp - 4)
    elif current_hp_mode == "one":
        hero.hp = 1
    else:
        hero.hp = 0
    wound = hero.max_hp - hero.hp if hero.hp > 0 else None
    hero.xp = XP_PER_LEVEL
    events, facts = game._level_up(hero)
    if current_hp_mode == "zero":
        assert hero.level == 1
        assert hero.hp == 0
        assert hero.xp == XP_PER_LEVEL
        assert not events
        return
    assert hero.level == 2
    assert facts["hp_gained"] == gain
    assert hero.max_hp - hero.hp == wound


@pytest.mark.parametrize(
    ("klass", "avg_die", "con_mod", "expected"),
    [
        ("fighter", 10, 2, 8),
        ("rogue", 8, 1, 6),
        ("cleric", 8, 0, 5),
        ("wizard", 6, -1, 3),
    ],
)
def test_hit_die_average_table(klass, avg_die, con_mod, expected):
    assert average_hit_die_gain(avg_die, con_mod) == expected


def test_level_up_at_cap_still_applies_hp_once():
    game = _game()
    hero = _hero("wizard")
    hero.level = MAX_MVP_LEVEL
    hero.xp = XP_PER_LEVEL
    old_max = hero.max_hp
    events, _ = game._level_up(hero)
    assert not events
    assert hero.max_hp == old_max


def test_action_surge_class_and_level_gates():
    game = _game()
    for klass in ("rogue", "cleric", "wizard"):
        hero = _hero(klass)
        hero.level = 2
        hero.action_surge_available = True
        hero.in_combat = True
        hero.combat_flags["action_used"] = True
        ok, _, _ = use_action_surge(hero)
        assert not ok
    fighter_l1 = _hero("fighter")
    fighter_l1.action_surge_available = True
    fighter_l1.in_combat = True
    fighter_l1.combat_flags["action_used"] = True
    assert not use_action_surge(fighter_l1)[0]
    fighter_l2 = _hero("fighter")
    fighter_l2.level = 2
    fighter_l2.action_surge_available = True
    fighter_l2.in_combat = True
    fighter_l2.combat_flags["action_used"] = True
    assert use_action_surge(fighter_l2)[0]
    assert not use_action_surge(fighter_l2)[0]


def test_action_surge_short_rest_refill():
    game = _game()
    hero = _hero("fighter")
    hero.level = 2
    hero.action_surge_available = False
    result, _ = game.resolve_action(hero, "short rest", None)
    assert hero.action_surge_available
    assert any("Action Surge" in line for line in result.events)


def test_rogue_cunning_action_hide_gated_to_level_two():
    game = _game()
    rogue_l1 = _hero("rogue", dexterity=16)
    rogue_l1.in_combat = True
    assert not try_hide_in_combat(game, rogue_l1)[0]
    rogue_l2 = _hero("rogue", dexterity=16)
    rogue_l2.level = 2
    rogue_l2.in_combat = True
    game.rng.randint = lambda _l, h: h
    ok, _, _ = try_hide_in_combat(game, rogue_l2)
    assert ok


def test_non_casters_have_no_spell_slots_after_level_ups():
    game = _game()
    for klass in ("fighter", "rogue"):
        hero = _hero(klass)
        apply_xp_with_level_ups(hero, 200, game._level_up)
        assert hero.level == 3
        assert not hero.spell_slots
        assert not hero.max_spell_slots


def test_caster_slots_level_three_without_full_restore_on_level():
    game = _game()
    hero = _hero("wizard")
    hero.spell_slots = {1: 0}
    hero.xp = XP_PER_LEVEL
    game._level_up(hero)
    assert hero.level == 2
    assert hero.max_spell_slots == {1: 3}
    assert hero.spell_slots == {1: 1}


def test_action_surge_survives_json_roundtrip():
    hero = _hero("fighter")
    hero.level = 2
    hero.action_surge_available = False
    payload = encode_character_state(asdict(hero))
    restored = CharacterState(**decode_character_state(payload))
    assert restored.action_surge_available is False
    restored.action_surge_available = True
    roundtrip = CharacterState(**decode_character_state(encode_character_state(asdict(restored))))
    assert roundtrip.action_surge_available is True
