"""Sprint 20 — every MVP race/class pair must create a playable level-1 hero."""

import pytest

from app.engine.character_creation import default_creation_choices
from app.engine.service import GameEngine

MVP_RACES = ("human", "elf", "dwarf", "halfling")
MVP_CLASSES = ("fighter", "rogue", "cleric", "wizard")


@pytest.mark.parametrize("race", MVP_RACES)
@pytest.mark.parametrize("character_class", MVP_CLASSES)
def test_mvp_race_class_creates_valid_hero(race: str, character_class: str):
    game = GameEngine()
    choices = default_creation_choices(character_class)
    hero = game.create_character(
        1,
        f"{race}-{character_class}",
        race,
        character_class,
        background=choices.background,
        class_skills=choices.class_skills,
        equipment_package=choices.equipment_package,
        cantrips=choices.cantrips,
        level_one_spells=choices.level_one_spells,
    )
    assert hero.level == 1
    assert hero.location == "The Whispering Cellar"
    assert hero.hp > 0 and hero.hp <= hero.max_hp
    assert hero.armor_class >= 8
    assert hero.abilities
    assert len(hero.saving_throw_proficiencies) == 2
    assert hero.speed >= 25
    if character_class in ("wizard", "cleric"):
        assert hero.max_spell_slots.get(1, 0) > 0
        assert hero.known_spells or hero.prepared_spells or hero.spell_slots.get(1, 0) > 0
    if character_class == "rogue":
        assert len(hero.skill_proficiencies) >= 4
