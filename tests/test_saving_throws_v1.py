"""Sprint 18 — saving throws and combat effects."""

from __future__ import annotations

import random

import pytest

from app.engine.character_creation import saving_throw_proficiencies
from app.engine.combat_effects import try_vault_hazard, VAULT_HAZARD_FLAG
from app.engine.models import CharacterState, MonsterState
from app.engine.saving_throws import SavingThrowRequest, perform_saving_throw, validate_saving_throw_request
from app.engine.service import GameEngine


def _hero(game: GameEngine, race: str = "human", cls: str = "fighter") -> CharacterState:
    return game.create_character(1, "Hero", race, cls, None)


def test_saving_throw_without_proficiency():
    game = GameEngine(random.Random(1))
    hero = _hero(game)
    req = SavingThrowRequest("dexterity", 12, "test", "unit")
    result = perform_saving_throw(game, hero, req)
    assert result.proficient is False
    assert result.proficiency_bonus == 0
    assert result.success == (result.total >= 12)


def test_saving_throw_with_proficiency():
    game = GameEngine(random.Random(2))
    hero = _hero(game, cls="fighter")
    assert "strength" in hero.saving_throw_proficiencies
    req = SavingThrowRequest("strength", 8, "test", "unit")
    result = perform_saving_throw(game, hero, req)
    assert result.proficient is True
    assert result.proficiency_bonus == 2


@pytest.mark.parametrize(
    ("cls", "expected"),
    [
        ("fighter", {"strength", "constitution"}),
        ("rogue", {"dexterity", "intelligence"}),
        ("cleric", {"wisdom", "charisma"}),
        ("wizard", {"intelligence", "wisdom"}),
    ],
)
def test_mvp_class_save_proficiencies(cls, expected):
    profs = set(saving_throw_proficiencies(cls))
    assert profs == expected


def test_advantage_uses_higher_die():
    game = GameEngine(random.Random(0))
    hero = _hero(game)
    rolls = iter([4, 18])

    def fake_randint(a, b):
        return next(rolls, 10)

    game.rng.randint = fake_randint
    req = SavingThrowRequest("dexterity", 15, "test", "adv", advantage=True)
    result = perform_saving_throw(game, hero, req)
    assert result.d20_roll == 18
    assert result.second_d20 == 4


def test_disadvantage_uses_lower_die():
    game = GameEngine(random.Random(0))
    hero = _hero(game)
    rolls = iter([18, 3])

    def fake_randint(a, b):
        return next(rolls, 10)

    game.rng.randint = fake_randint
    req = SavingThrowRequest("dexterity", 10, "test", "dis", disadvantage=True)
    result = perform_saving_throw(game, hero, req)
    assert result.d20_roll == 3


def test_advantage_and_disadvantage_cancel():
    game = GameEngine(random.Random(0))
    hero = _hero(game)
    rolls = iter([20, 3])

    def fake_randint(a, b):
        return next(rolls, 10)

    game.rng.randint = fake_randint
    req = SavingThrowRequest("wisdom", 10, "test", "cancel", advantage=True, disadvantage=True)
    result = perform_saving_throw(game, hero, req)
    assert result.second_d20 is None
    assert result.d20_roll == 20


def test_halfling_lucky_once_on_natural_1():
    game = GameEngine(random.Random(0))
    hero = _hero(game, race="halfling")
    rolls = iter([1, 17])

    def fake_randint(a, b):
        return next(rolls, 12)

    game.rng.randint = fake_randint
    result = perform_saving_throw(
        game, hero, SavingThrowRequest("constitution", 8, "test", "lucky"),
    )
    assert result.d20_roll == 17
    assert "Halfling Lucky" in result.lucky_note


def test_natural_1_can_still_succeed():
    game = GameEngine(random.Random(0))
    hero = _hero(game, cls="fighter")
    hero.abilities["strength"] = 20
    rolls = iter([1])

    game.rng.randint = lambda a, b: 1
    result = perform_saving_throw(
        game, hero, SavingThrowRequest("strength", 8, "test", "nat1"),
    )
    assert result.natural_1
    assert result.success


def test_natural_20_can_still_fail():
    game = GameEngine(random.Random(0))
    hero = _hero(game)
    hero.abilities["wisdom"] = 8
    game.rng.randint = lambda a, b: 20
    result = perform_saving_throw(
        game, hero, SavingThrowRequest("wisdom", 25, "test", "nat20"),
    )
    assert result.natural_20
    assert not result.success


def test_invalid_dc_rejected():
    with pytest.raises(ValueError):
        validate_saving_throw_request(SavingThrowRequest("wisdom", 0, "x", "y"))
    with pytest.raises(ValueError):
        validate_saving_throw_request(SavingThrowRequest("wisdom", 99, "x", "y"))


def test_invalid_ability_rejected():
    with pytest.raises(ValueError):
        validate_saving_throw_request(SavingThrowRequest("luck", 10, "x", "y"))


def test_vault_hazard_explore_triggers_once():
    game = GameEngine(random.Random(42))
    hero = _hero(game)
    hero.location = "The Vault of Echoes"
    hero.quest_flags["vault_unlocked"] = True
    out = try_vault_hazard(game, hero, "look around")
    assert out is not None
    events, facts = out
    assert any("Saving throw" in line for line in events)
    assert hero.quest_flags[VAULT_HAZARD_FLAG]
    assert try_vault_hazard(game, hero, "look around") is None


def test_ghoul_on_hit_triggers_con_save():
    from app.engine.encounters import build_monster

    game = GameEngine(random.Random(5))
    hero = _hero(game)
    monster = build_monster("normal", "ghoul")
    monster.attack_bonus = 30
    hero.armor_class = 10
    hero.hp = 30
    events = game._enemy_turn(hero, monster)
    joined = " ".join(events)
    assert "hits you" in joined
    assert "Saving throw" in joined or "Constitution" in joined


def test_kobold_spell_save_on_hit():
    from app.engine.encounters import build_monster

    game = GameEngine(random.Random(6))
    hero = _hero(game)
    hero.hp = 40
    hero.armor_class = 10
    monster = build_monster("normal", "kobold")
    monster.attack_bonus = 25
    events = game._enemy_turn(hero, monster)
    assert any("Saving throw" in e for e in events)
    assert any("spit" in e.lower() or "froth" in e.lower() for e in events)
