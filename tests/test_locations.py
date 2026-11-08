import random

import pytest

from app.engine.locations import LOCATIONS, is_travel_action, travel_allowed, travel_destination
from app.engine.models import CharacterState
from app.engine.service import GameEngine


def test_location_graph_is_connected():
    assert set(LOCATIONS) == {
        "The Whispering Cellar",
        "The Sunken Corridor",
        "The Shrine of the Forgotten",
        "The Goblin Market",
        "The Vault of Echoes",
        "The Bell Warden's Pit",
        "The Forgotten Crypt",
        "The Bandit Camp",
        "The Underground River",
    }
    for name, location in LOCATIONS.items():
        for destination in location.connections:
            assert destination in LOCATIONS
            assert name in LOCATIONS[destination].connections


@pytest.mark.parametrize(
    ("action", "expected"),
    [
        ("travel to The Sunken Corridor", "The Sunken Corridor"),
        ("go to the shrine of the forgotten", None),
        ("cestuj do The Sunken Corridor", "The Sunken Corridor"),
        ("attack the goblin", None),
    ],
)
def test_travel_destination_parsing(action, expected):
    assert travel_destination("The Whispering Cellar", action) == expected
    if expected:
        assert is_travel_action(action)


def test_vault_route_requires_story_unlock():
    assert not travel_allowed("The Vault of Echoes", {})
    assert travel_allowed("The Vault of Echoes", {"vault_unlocked": True})


def test_bell_quest_branch_resolves_in_order():
    game = GameEngine(random.Random(3))
    hero = game.create_character(1, "Arin", "human", "fighter", abilities={
        "strength": 14, "dexterity": 12, "constitution": 12,
        "intelligence": 10, "wisdom": 10, "charisma": 10,
    })
    hero.location = "The Shrine of the Forgotten"
    hero.quest_flags = {}

    accept, _ = game.resolve_action(hero, "talk to Caldus about the shrine bell", None)
    assert hero.quest_flags.get("bell_quest_accepted")
    assert accept.state_changed

    hero.location = "The Goblin Market"
    find, _ = game.resolve_action(hero, "ask Nib about the shrine bell", None)
    assert hero.quest_flags.get("bell_found")
    assert hero.quest_flags.get("bell_acquired")
    assert "Shrine bell" in hero.inventory

    hero.location = "The Shrine of the Forgotten"
    complete, _ = game.resolve_action(hero, "return the shrine bell to Caldus", None)
    assert hero.quest_flags.get("bell_quest_complete")
    assert hero.xp >= 30
    assert complete.state_changed
