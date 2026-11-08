"""Racial ability increases apply once at creation for MVP races."""

import pytest

from app.engine.catalog import ABILITY_ORDER, apply_racial_ability_increases, standard_abilities
from app.engine.reference import RACE_SPECS
from app.engine.service import GameEngine
from app.heroes import HEROES


def _base_scores(character_class: str) -> dict[str, int]:
    return dict(standard_abilities(character_class))


def test_apply_racial_increases_elf_dexterity():
    base = _base_scores("wizard")
    adjusted = apply_racial_ability_increases("elf", base)
    assert adjusted["dexterity"] == base["dexterity"] + RACE_SPECS["elf"].ability_increase["dexterity"]


def test_apply_racial_increases_human_all_abilities():
    base = _base_scores("fighter")
    adjusted = apply_racial_ability_increases("human", base)
    for ability in ABILITY_ORDER:
        assert adjusted[ability] == base[ability] + 1


def test_create_character_applies_mvp_race_bonuses():
    game = GameEngine()
    cases = {
        "dwarf": "constitution",
        "halfling": "dexterity",
        "elf": "dexterity",
        "human": "strength",
    }
    for race, bumped in cases.items():
        base = _base_scores("fighter")
        hero = game.create_character(1, f"Hero-{race}", race, "fighter", base)
        bonus = RACE_SPECS[race].ability_increase.get(bumped, 1 if race == "human" else 0)
        assert hero.abilities[bumped] == base[bumped] + bonus, race


@pytest.mark.parametrize("key", ["tank", "skirmisher", "support", "healer"])
def test_preset_heroes_include_racial_bonuses_once(key):
    game = GameEngine()
    hero = HEROES[key]
    character = game.create_character(1, hero.name, hero.race, hero.character_class, hero.abilities)
    for ability, bonus in RACE_SPECS[hero.race].ability_increase.items():
        assert character.abilities[ability] == hero.abilities[ability] + bonus, key
    if hero.race == "human":
        for ability in ABILITY_ORDER:
            assert character.abilities[ability] == hero.abilities[ability] + 1, key


def test_loaded_character_does_not_reapply_races():
    """Race bonuses are creation-only; this test documents expected stored scores."""
    game = GameEngine()
    base = _base_scores("rogue")
    hero = game.create_character(1, "Skirmisher", "halfling", "rogue", base)
    dex_after_create = hero.abilities["dexterity"]
    hero.abilities = dict(hero.abilities)
    result, _ = game.resolve_action(hero, "explore the room", None)
    assert hero.abilities["dexterity"] == dex_after_create
    assert result.state_changed or result.events
