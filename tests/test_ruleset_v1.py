import pytest

from app.engine.ruleset_v1 import (
    MVP_CLASSES,
    MVP_RACES,
    class_mvp_playable,
    race_mvp_playable,
    validate_mvp_creation,
)
from app.engine.reference import class_list, race_list
from app.engine.service import GameEngine


def test_mvp_race_and_class_sets():
    assert MVP_RACES == frozenset({"human", "elf", "dwarf", "halfling"})
    assert MVP_CLASSES == frozenset({"fighter", "rogue", "cleric", "wizard"})


def test_reference_lists_expose_mvp_playable_flags():
    races = {item["key"]: item["mvp_playable"] for item in race_list()}
    classes = {item["key"]: item["mvp_playable"] for item in class_list()}
    assert races["human"] is True
    assert races["tiefling"] is False
    assert classes["wizard"] is True
    assert classes["bard"] is False


def test_engine_allows_non_mvp_for_unit_tests():
    game = GameEngine(__import__("random").Random(1))
    hero = game.create_character(1, "X", "tiefling", "bard")
    assert hero.race == "tiefling"


def test_helpers():
    assert race_mvp_playable("elf")
    assert not class_mvp_playable("paladin")
    with pytest.raises(ValueError):
        validate_mvp_creation("dragonborn", "wizard")
