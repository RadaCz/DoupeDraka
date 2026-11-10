import random

import pytest

from app.engine.economy_balance import HEALING_POTION_PRICE_GP, SHORTSWORD_PLUS_ONE_PRICE_GP
from app.engine.encounters import build_monster, filter_encounter_pool
from app.engine.equipment import default_item_instances, item_attack_bonus
from app.engine.locations import LOCATIONS, travel_destination
from app.engine.service import GameEngine
from app.engine.shop import match_shop_listing


def test_new_monsters_build_with_srd_style_stats():
    skeleton = build_monster("normal", "skeleton")
    assert skeleton.hp == 13
    assert skeleton.armor_class == 13
    orc = build_monster("normal", "orc")
    assert orc.hp == 15
    captain = build_monster("normal", "bandit_captain")
    assert captain.armor_class == 15


@pytest.mark.parametrize(
    ("level", "key", "allowed"),
    [
        (1, "skeleton", True),
        (1, "orc", False),
        (2, "orc", True),
        (2, "bandit_captain", False),
        (3, "bandit_captain", True),
    ],
)
def test_encounter_pool_respects_level_tiers(level, key, allowed):
    pool = ("skeleton", "orc", "bandit_captain")
    eligible = filter_encounter_pool(pool, level)
    assert (key in eligible) is allowed


def test_random_encounter_only_rolls_eligible_tiers():
    game = GameEngine(random.Random(0))
    hero = game.create_character(1, "Scout", "human", "fighter")
    hero.location = "The Bandit Camp"
    seen: set[str] = set()
    for seed in range(80):
        game.rng = random.Random(seed)
        monster = game._random_encounter(hero)
        seen.add(monster.name)
    assert "Orc marauder" not in seen
    assert "Bandit captain" not in seen
    assert seen  # at least bandits / wolves


def test_shop_rejects_insufficient_gold():
    game = GameEngine()
    hero = game.create_character(1, "Buyer", "human", "fighter")
    hero.location = "The Goblin Market"
    hero.gold = 10
    result, _ = game.resolve_action(hero, "buy healing potion", None)
    assert not result.state_changed
    assert f"{HEALING_POTION_PRICE_GP} gp" in result.events[0]
    assert hero.gold == 10


def test_shop_purchase_updates_gold_and_inventory():
    game = GameEngine()
    hero = game.create_character(1, "Buyer", "human", "fighter")
    hero.location = "The Goblin Market"
    hero.gold = 60
    result, _ = game.resolve_action(hero, "buy a healing potion", None)
    assert result.state_changed
    assert hero.gold == 60 - HEALING_POTION_PRICE_GP
    assert "healing potion" in hero.inventory


def test_shop_shortsword_plus_one_grants_attack_bonus():
    game = GameEngine()
    hero = game.create_character(1, "Buyer", "human", "fighter")
    hero.inventory = ["traveler's clothes"]
    hero.item_instances = default_item_instances(hero.inventory)
    hero.location = "The Goblin Market"
    hero.gold = 150
    result, _ = game.resolve_action(hero, "buy shortsword +1", None)
    assert result.state_changed
    assert hero.gold == 150 - SHORTSWORD_PLUS_ONE_PRICE_GP
    assert item_attack_bonus(hero) == 1


def test_travel_to_new_locations():
    game = GameEngine()
    hero = game.create_character(1, "Walker", "human", "fighter")
    hero.location = "The Sunken Corridor"
    hero.quest_flags = {}
    assert travel_destination(hero.location, "travel to The Underground River") == "The Underground River"
    move, _ = game._travel(hero, "travel to The Underground River")
    assert move.state_changed
    assert hero.location == "The Underground River"
    assert any("Black water" in event for event in move.events)

    hero.location = "The Goblin Market"
    camp, _ = game._travel(hero, "travel to The Bandit Camp")
    assert camp.state_changed
    assert hero.location == "The Bandit Camp"

    hero.location = "The Vault of Echoes"
    hero.quest_flags = {"vault_unlocked": True, "vault_first_descent_story_awarded": True}
    crypt, _ = game._travel(hero, "travel to The Forgotten Crypt")
    assert crypt.state_changed
    assert hero.location == "The Forgotten Crypt"


def test_location_graph_includes_expansion():
    assert len(LOCATIONS) == 9
    for name in (
        "The Forgotten Crypt",
        "The Bandit Camp",
        "The Underground River",
    ):
        assert name in LOCATIONS


def test_match_shop_listing_aliases():
    assert match_shop_listing("buy potion").key == "healing_potion"
    assert match_shop_listing("kup shortsword +1").key == "shortsword_plus_1"
