"""Sprint 35 — authoritative level-up and class progression (L1–L3)."""

import random

import pytest

from app.engine.chapter_one_progression import apply_xp_with_level_ups
from app.engine.class_features import use_action_surge
from app.engine.equipment import proficiency_bonus
from app.engine.level_progression import average_hit_die_gain, hp_gain_on_level_up
from app.engine.models import CharacterState, MonsterState
from app.engine.ruleset_v1 import MAX_MVP_LEVEL
from app.engine.service import GameEngine, XP_THRESHOLD
from app.engine.spells import spell_slot_progression


def _hero(klass: str, **abilities) -> CharacterState:
    game = GameEngine(random.Random(1))
    base = {"strength": 10, "dexterity": 10, "constitution": 10, "intelligence": 10, "wisdom": 10, "charisma": 10}
    base.update(abilities)
    return game.create_character(1, f"Lv-{klass}", "human", klass, base)


@pytest.mark.parametrize(
    ("klass", "con_score", "expected_gain"),
    [
        ("fighter", 14, 8),  # 6 avg d10 + 2 CON
        ("rogue", 12, 6),
        ("cleric", 10, 5),
        ("wizard", 8, 3),
    ],
)
def test_average_hp_gain_per_class(klass, con_score, expected_gain):
    hero = _hero(klass)
    hero.abilities["constitution"] = con_score
    assert hp_gain_on_level_up(hero) == expected_gain
    assert average_hit_die_gain(6, -4) == 1


def test_xp_below_threshold_does_not_level():
    hero = _hero("fighter")
    hero.xp = 50
    game = GameEngine(random.Random(2))
    events, facts = game._level_up(hero)
    assert hero.level == 1
    assert not events
    assert not facts


def test_story_xp_can_chain_multiple_level_ups():
    game = GameEngine(random.Random(3))
    hero = _hero("fighter", constitution=14)
    old_hp = hero.hp
    events, facts = apply_xp_with_level_ups(hero, 200, game._level_up)
    assert hero.level == 3
    assert hero.xp == 0
    assert len(events) >= 2
    assert facts["new_level"] == 3
    assert hero.hp == old_hp + 8 + 8  # two level-ups


def test_grant_xp_still_one_level_per_combat_kill():
    game = GameEngine(random.Random(4))
    hero = _hero("fighter", strength=16)
    enemy = MonsterState(hp=1, max_hp=1, reward_xp=250)
    game.rng.randint = lambda _a, _b: 20
    result, _ = game.resolve_action(hero, "attack", enemy)
    assert hero.level == 2
    assert hero.xp == 150
    assert result.level_up_facts["new_level"] == 2


def test_level_up_preserves_damage_on_current_hp():
    game = GameEngine(random.Random(5))
    hero = _hero("wizard", constitution=14)
    damage_taken = hero.max_hp - 3
    hero.hp = 3
    hero.xp = 100
    game._level_up(hero)
    assert hero.max_hp - hero.hp == damage_taken


def test_fighter_level_two_grants_action_surge():
    game = GameEngine(random.Random(6))
    hero = _hero("fighter")
    hero.xp = 100
    _, facts = game._level_up(hero)
    assert hero.level == 2
    assert hero.action_surge_available
    assert "Action Surge" in facts["class_features_gained"]
    assert not facts.get("class_features_deferred")


def test_action_surge_restores_action_after_first_action():
    game = GameEngine(random.Random(7))
    hero = _hero("fighter")
    hero.level = 2
    hero.action_surge_available = True
    hero.in_combat = True
    hero.combat_flags["action_used"] = True
    ok, lines, facts = use_action_surge(hero)
    assert ok
    assert not hero.combat_flags["action_used"]
    assert not hero.action_surge_available
    assert facts["extra_action"]


@pytest.mark.parametrize("klass", ["fighter", "rogue", "cleric", "wizard"])
def test_proficiency_bonus_levels_1_to_3(klass):
    for level in (1, 2, 3):
        assert proficiency_bonus(level) == 2


@pytest.mark.parametrize(
    ("klass", "level", "expected_slots"),
    [
        ("cleric", 1, {1: 2}),
        ("cleric", 2, {1: 3}),
        ("cleric", 3, {1: 4, 2: 2}),
        ("wizard", 3, {1: 4, 2: 2}),
    ],
)
def test_caster_spell_slot_table(klass, level, expected_slots):
    assert spell_slot_progression(klass, level) == expected_slots


def test_level_cap_clamps_xp():
    game = GameEngine(random.Random(8))
    hero = _hero("fighter")
    hero.level = MAX_MVP_LEVEL
    hero.xp = 500
    events, _ = apply_xp_with_level_ups(hero, 50, game._level_up)
    assert hero.level == MAX_MVP_LEVEL
    assert hero.xp <= XP_THRESHOLD - 1
    assert not events


def test_invalid_xp_grant_has_no_side_effects():
    game = GameEngine(random.Random(9))
    hero = _hero("rogue")
    before = (hero.level, hero.xp, hero.max_hp)
    events, facts = game._grant_xp(hero, 0)
    assert (hero.level, hero.xp, hero.max_hp) == before
    assert not events and not facts
