"""Sprint 16 — character creation v2 (SRD 5.1 MVP)."""

import random

import pytest

from app.engine.catalog import STANDARD_ARRAY, apply_racial_ability_increases
from app.engine.character_creation import (
    MVP_BACKGROUNDS,
    assemble_skill_proficiencies,
    default_class_skills,
    default_creation_choices,
    resolve_creation_options,
    validate_standard_array,
)
from app.engine.service import GameEngine


def _scores(**overrides: int) -> dict[str, int]:
    base = {
        "strength": 15,
        "dexterity": 14,
        "constitution": 13,
        "intelligence": 12,
        "wisdom": 10,
        "charisma": 8,
    }
    base.update(overrides)
    return base


def test_standard_array_validation():
    validate_standard_array(_scores())
    with pytest.raises(ValueError):
        validate_standard_array(_scores(strength=16))


def test_custom_fighter_creation_persists_choices():
    game = GameEngine(random.Random(1))
    choices = default_creation_choices("fighter")
    hero = game.create_character(
        1,
        "Bran",
        "dwarf",
        "fighter",
        _scores(strength=15, constitution=14, dexterity=13, intelligence=12, wisdom=10, charisma=8),
        background="soldier",
        class_skills=["Perception", "Survival"],
        equipment_package="guardian",
    )
    assert hero.background == "soldier"
    assert "Athletics" in hero.skill_proficiencies
    assert "Insight" not in hero.skill_proficiencies or "Athletics" in hero.skill_proficiencies
    assert hero.speed == 25
    assert hero.saving_throw_proficiencies == ["strength", "constitution"]
    assert hero.gold >= 10


def test_elf_gains_perception_proficiency():
    skills = assemble_skill_proficiencies("elf", "wizard", "sage", ["Arcana", "Investigation"])
    assert "Perception" in skills


def test_wizard_spell_picks_applied():
    game = GameEngine(random.Random(2))
    hero = game.create_character(
        1,
        "Lyra",
        "elf",
        "wizard",
        _scores(intelligence=15, dexterity=14, constitution=13, wisdom=12, charisma=10, strength=8),
        cantrips=["Fire Bolt", "Mage Hand", "Light"],
        level_one_spells=["Magic Missile", "Shield", "Detect Magic"],
    )
    assert set(hero.known_spells) == {"Fire Bolt", "Mage Hand", "Light", "Magic Missile", "Shield", "Detect Magic"}


def test_skill_check_uses_proficiency():
    game = GameEngine(random.Random(3))
    hero = game.create_character(1, "Scout", "human", "rogue")
    hero.skill_proficiencies = ["Stealth"]
    mod_plain = game.skill_modifier(hero, "Acrobatics")
    mod_prof = game.skill_modifier(hero, "Stealth")
    assert mod_prof == mod_plain + 2


def test_skill_check_roll_reflects_proficiency():
    game = GameEngine(random.Random(4))
    hero = game.create_character(1, "Seeker", "human", "wizard")
    hero.skill_proficiencies = ["Investigation"]
    game.rng.randint = lambda a, b: 15
    roll, success, _ = game.skill_check(hero, "Investigation", 5)
    assert success
    assert roll.total >= 5


def test_halfling_lucky_rerolls_attack_one():
    game = GameEngine(random.Random(5))
    hero = game.create_character(1, "Lucky", "halfling", "rogue")
    from app.engine.models import MonsterState

    monster = MonsterState(name="Target", hp=10, max_hp=10, armor_class=10)
    rolls = iter([1, 18, 6, 4, 3])

    def fake_randint(a, b):
        return next(rolls, 6)

    game.rng.randint = fake_randint
    events = game.attack(hero, monster)
    joined = " ".join(events)
    assert "Halfling Lucky" in joined


def test_halfling_lucky_rerolls_ability_and_saving_throws():
    game = GameEngine(random.Random(7))
    hero = game.create_character(1, "Lucky", "halfling", "fighter")
    rolls = iter([1, 16])

    def fake_randint(a, b):
        return next(rolls, 10)

    game.rng.randint = fake_randint
    check, _success, note = game.ability_check(hero, "strength", 8)
    assert "Halfling Lucky" in note
    assert check.values[0] == 16

    rolls = iter([1, 14])
    game.rng.randint = fake_randint
    save, _success, save_note = game.saving_throw(hero, "constitution", 8)
    assert "Halfling Lucky" in save_note
    assert save.values[0] == 14


@pytest.mark.parametrize(
    ("background_key", "expected_gold"),
    [
        ("acolyte", 15),
        ("criminal", 15),
        ("folk_hero", 10),
        ("sage", 10),
        ("soldier", 10),
        ("hermit", 5),
    ],
)
def test_background_starting_gold(background_key, expected_gold):
    game = GameEngine(random.Random(8))
    hero = game.create_character(
        1,
        "Bg",
        "human",
        "fighter",
        _scores(),
        background=background_key,
        class_skills=default_class_skills("fighter", background_key),
    )
    assert hero.background == background_key
    assert hero.gold >= expected_gold
    for skill in MVP_BACKGROUNDS[background_key]["skill_proficiencies"]:
        assert skill in hero.skill_proficiencies


def test_legacy_create_without_options_still_valid():
    game = GameEngine(random.Random(6))
    hero = game.create_character(1, "Old", "human", "fighter")
    assert hero.abilities
    assert hero.max_hp >= 1
    assert hero.background == default_creation_choices("fighter").background


def test_racial_abilities_applied_after_standard_array():
    scores = apply_racial_ability_increases("dwarf", _scores(constitution=15))
    assert scores["constitution"] == 17


def test_rogue_creation_skill_count_and_saves():
    game = GameEngine(random.Random(9))
    hero = game.create_character(
        1,
        "Trix",
        "halfling",
        "rogue",
        _scores(dexterity=15, charisma=14, constitution=13, intelligence=12, wisdom=10, strength=8),
        background="criminal",
        class_skills=["Sleight of Hand", "Perception", "Investigation", "Acrobatics"],
        equipment_package="scout",
    )
    assert hero.saving_throw_proficiencies == ["dexterity", "intelligence"]
    assert "Stealth" in hero.skill_proficiencies
    assert hero.speed == 25


def test_cleric_creation_prepares_spells_and_wisdom_saves():
    game = GameEngine(random.Random(10))
    choices = default_creation_choices("cleric")
    hero = game.create_character(
        1,
        "Sanvi",
        "human",
        "cleric",
        _scores(wisdom=15, constitution=14, strength=13, charisma=12, intelligence=10, dexterity=8),
        background=choices.background,
        class_skills=choices.class_skills,
        equipment_package=choices.equipment_package,
        cantrips=choices.cantrips,
        level_one_spells=choices.level_one_spells,
    )
    assert hero.saving_throw_proficiencies == ["wisdom", "charisma"]
    assert hero.max_spell_slots.get(1, 0) >= 2
    assert hero.prepared_spells or hero.known_spells
