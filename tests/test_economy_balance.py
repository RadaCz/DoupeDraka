"""Sprint 3 — gold pacing, shop, rest rules."""

import random

import pytest
from app.engine.economy_balance import (
    HEALING_POTION_PRICE_GP,
    SHORTSWORD_PLUS_ONE_PRICE_GP,
    gold_scavenge_flag,
)
from app.engine.models import RollResult
from app.engine.service import GameEngine
from app.engine.shop import SHOP_LISTINGS


@pytest.fixture
def game():
    return GameEngine(random.Random(4))


def _hero(game: GameEngine, location: str = "The Whispering Cellar"):
    hero = game.create_character(1, "Merchant", "human", "fighter")
    hero.location = location
    hero.quest_flags = {}
    return hero


def test_explore_gold_one_time_per_location(game):
    hero = _hero(game)
    game.roll = lambda dice, modifier=0, critical=False: RollResult(dice, (3,), modifier, 3 + modifier)
    starting_gold = hero.gold
    first, _ = game.resolve_action(hero, "look around", None)
    assert hero.gold == starting_gold + 3
    assert first.state_changed
    second, _ = game.resolve_action(hero, "look around", None)
    assert hero.gold == starting_gold + 3
    assert not second.state_changed
    assert any("no loose coin" in event.casefold() for event in second.events)


def test_explore_gold_farm_simulation_cap(game):
    hero = _hero(game)
    starting_gold = hero.gold
    total_gold = hero.gold
    for _ in range(30):
        game.roll = lambda dice, modifier=0, critical=False: RollResult(
            dice, (3,) if dice == "1d6" else (2,), modifier, 5,
        )
        result, _ = game.resolve_action(hero, "search the area", None)
        total_gold = hero.gold
        if not result.state_changed and hero.quest_flags.get(gold_scavenge_flag(hero.location)):
            break
    assert total_gold <= starting_gold + 4


def test_bell_return_gold_idempotent(game):
    from app.engine.quests import resolve_main_quest_step

    hero = _hero(game, "The Shrine of the Forgotten")
    hero.quest_flags["bell_acquired"] = True
    hero.inventory.append("Shrine bell")
    first = resolve_main_quest_step(hero, "return bell", "return_bell", game._level_up)
    gold_after = hero.gold
    second = resolve_main_quest_step(hero, "return bell", "return_bell", game._level_up)
    assert first and first.state_changed
    assert second and not second.state_changed
    assert hero.gold == gold_after


def test_shop_prices_and_affordability(game):
    potion = next(item for item in SHOP_LISTINGS if item.key == "healing_potion")
    assert potion.price_gp == HEALING_POTION_PRICE_GP
    blade = next(item for item in SHOP_LISTINGS if item.key == "shortsword_plus_1")
    assert blade.price_gp == SHORTSWORD_PLUS_ONE_PRICE_GP


def test_shop_rejects_insufficient_gold(game):
    hero = _hero(game, "The Goblin Market")
    hero.gold = HEALING_POTION_PRICE_GP - 1
    result, _ = game.resolve_action(hero, "buy healing potion", None)
    assert not result.state_changed
    assert hero.gold == HEALING_POTION_PRICE_GP - 1


def test_purchase_preserves_equipped_weapon(game):
    from app.engine.equipment import default_item_instances, equipped_weapon, set_equipped_weapon

    hero = _hero(game, "The Goblin Market")
    hero.inventory = ["shortsword", "mace"]
    hero.item_instances = default_item_instances(hero.inventory, hero)
    set_equipped_weapon(hero, "mace")
    hero.gold = HEALING_POTION_PRICE_GP + 20
    result, _ = game.resolve_action(hero, "buy healing potion", None)
    assert result.state_changed
    assert equipped_weapon(hero).key == "mace"


def test_potion_consumes_supply(game):
    from app.engine.equipment import default_item_instances

    hero = _hero(game)
    hero.inventory = ["healing potion"]
    hero.item_instances = default_item_instances(hero.inventory, hero)
    hero.hp = 2
    result, _ = game.resolve_action(hero, "use potion", None)
    assert result.state_changed
    assert "potion" not in " ".join(hero.inventory).casefold()


def test_long_rest_blocked_in_dangerous_location(game):
    hero = _hero(game, "The Vault of Echoes")
    hero.hp = 3
    result, _ = game.resolve_action(hero, "rest", None)
    assert not result.state_changed
    assert hero.hp == 3


def test_long_rest_in_safe_hub(game):
    hero = _hero(game, "The Shrine of the Forgotten")
    hero.hp = 4
    result, _ = game.resolve_action(hero, "rest", None)
    assert result.state_changed
    assert hero.hp == hero.max_hp


def test_short_rest_once_until_long_rest(game):
    hero = _hero(game)
    hero.hp = 5
    first, _ = game.resolve_action(hero, "short rest", None)
    assert first.state_changed
    second, _ = game.resolve_action(hero, "short rest", None)
    assert not second.state_changed
    long, _ = game.resolve_action(hero, "rest", None)
    assert long.state_changed
    hero.hp = max(1, hero.max_hp - 3)
    third, _ = game.resolve_action(hero, "short rest", None)
    assert third.state_changed


@pytest.mark.parametrize("cls", ["fighter", "rogue", "cleric", "wizard"])
def test_class_can_afford_potion_after_bell_quest(game, cls):
    from app.engine.quests import resolve_main_quest_step

    hero = game.create_character(1, "Hero", "human", cls)
    starting_gold = hero.gold
    hero.location = "The Shrine of the Forgotten"
    hero.quest_flags["bell_acquired"] = True
    hero.inventory.append("Shrine bell")
    resolve_main_quest_step(hero, "return bell", "return_bell", game._level_up)
    from app.engine.economy_balance import CHAPTER_BOSS_GOLD_GP, CRYPT_RELIC_GOLD_GP, QUEST_BELL_RETURN_GOLD_GP

    assert hero.gold == starting_gold + QUEST_BELL_RETURN_GOLD_GP
    hero.gold += CRYPT_RELIC_GOLD_GP + CHAPTER_BOSS_GOLD_GP
    assert hero.gold >= HEALING_POTION_PRICE_GP


def test_duplicate_buy_rejected_in_engine(game):
    hero = _hero(game, "The Goblin Market")
    hero.gold = HEALING_POTION_PRICE_GP
    first, _ = game.resolve_action(hero, "buy healing potion", None)
    assert first.state_changed
    second, _ = game.resolve_action(hero, "buy healing potion", None)
    assert not second.state_changed
    assert hero.inventory.count("healing potion") == 1
