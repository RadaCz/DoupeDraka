import random

from app.engine.models import CharacterState
from app.engine.quests import (
    CHAPTER_ONE,
    resolve_main_quest_step,
    try_side_quest_explore,
    quest_catalog,
)
from app.engine.service import GameEngine


def test_quest_catalog_matches_chapter_one_steps():
    payload = quest_catalog()
    steps = payload["campaigns"][0]["steps"]
    assert payload["campaigns"][0]["id"] == CHAPTER_ONE.id
    assert [step["id"] for step in steps] == [step.id for step in CHAPTER_ONE.steps]
    assert payload["side_quests"][0]["id"] == "crypt_echo_relic"
    vault_step = next(step for step in CHAPTER_ONE.steps if step.id == "vault_hint_given")
    assert "Caldus" in vault_step.hint
    assert "Shrine of the Forgotten" in vault_step.location
    assert "Sunken Corridor" not in vault_step.hint


def test_crypt_relic_pays_once():
    game = GameEngine(random.Random(2))
    hero = game.create_character(1, "Arin", "human", "fighter")
    hero.location = "The Forgotten Crypt"
    hero.quest_flags = {}

    first = try_side_quest_explore(hero, "search the crypt", game._level_up)
    assert first is not None
    assert first.state_changed
    assert hero.quest_flags["crypt_relic_claimed"]
    assert hero.gold == 15
    assert hero.xp == 10

    second = try_side_quest_explore(hero, "search the crypt", game._level_up)
    assert second is not None
    assert not second.state_changed
    assert hero.gold == 15


def test_bell_quest_idempotent_completion():
    game = GameEngine(random.Random(1))

    def level_up(character: CharacterState):
        return game._level_up(character)

    hero = game.create_character(1, "Arin", "human", "cleric")
    hero.location = "The Shrine of the Forgotten"
    hero.quest_flags = {"bell_found": True, "bell_acquired": True}
    hero.inventory.append("Shrine bell")

    done = resolve_main_quest_step(hero, "return bell", "return_bell", level_up)
    assert done and done.state_changed
    assert hero.quest_flags["bell_quest_complete"]

    again = resolve_main_quest_step(hero, "return bell", "return_bell", level_up)
    assert again is not None and not again.state_changed
