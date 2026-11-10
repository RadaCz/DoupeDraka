import copy

import pytest

from app.engine.economy_balance import HEALING_POTION_PRICE_GP
from app.engine.intent import AMBIGUOUS, QUEST, REJECTED, SHOP, USE_ITEM, parse_action_intent
from app.engine.models import CharacterState
from app.engine.service import GameEngine


def _hero(**flags) -> CharacterState:
    game = GameEngine()
    hero = game.create_character(1, "Test", "human", "fighter")
    hero.quest_flags = dict(flags)
    hero.gold = 60
    hero.location = "The Goblin Market"
    return hero


def _snapshot(hero: CharacterState) -> tuple:
    return (
        hero.gold,
        copy.deepcopy(hero.quest_flags),
        list(hero.inventory),
        hero.hp,
        dict(hero.spell_slots),
    )


@pytest.mark.parametrize(
    "action",
    [
        "don't buy a potion",
        "don't use a potion",
        "nechci koupit lektvar",
        "nechci vrátit zvon",
        "nechci mluvit s Caldus o zvonu",
    ],
)
def test_negated_commands_are_rejected_intent(action):
    intent = parse_action_intent(action)
    assert intent.kind == REJECTED
    assert intent.needs_clarification


@pytest.mark.parametrize(
    "action",
    [
        "rest then attack the goblin",
        "cast fire bolt while traveling to The Sunken Corridor",
    ],
)
def test_conflicting_positive_intents_are_ambiguous(action):
    assert parse_action_intent(action).kind == AMBIGUOUS


def test_negated_shop_does_not_spend_gold():
    game = GameEngine()
    hero = _hero()
    before = _snapshot(hero)
    result, _ = game.resolve_action(hero, "don't buy a potion", None)
    assert result.state_changed is False
    assert result.costs_adventure_mana is False
    assert _snapshot(hero) == before


def test_negated_use_potion_does_not_consume_inventory():
    game = GameEngine()
    hero = _hero()
    hero.inventory.append("healing potion")
    hero.hp = hero.max_hp - 5
    before = _snapshot(hero)
    result, _ = game.resolve_action(hero, "don't use a potion", None)
    assert not result.state_changed
    assert _snapshot(hero) == before


def test_negated_caldus_talk_does_not_accept_quest():
    game = GameEngine()
    hero = _hero()
    hero.location = "The Shrine of the Forgotten"
    before = _snapshot(hero)
    result, _ = game.resolve_action(hero, "nechci mluvit s Caldus o shrine bell", None)
    assert not result.state_changed
    assert _snapshot(hero) == before
    assert not hero.quest_flags.get("bell_quest_accepted")


def test_negated_bell_return_does_not_complete_quest():
    game = GameEngine()
    hero = _hero()
    hero.location = "The Shrine of the Forgotten"
    hero.quest_flags = {"bell_found": True, "bell_acquired": True}
    hero.inventory.append("Shrine bell")
    before = _snapshot(hero)
    result, _ = game.resolve_action(hero, "nechci vrátit zvon Caldovi", None)
    assert not result.state_changed
    assert _snapshot(hero) == before
    assert not hero.quest_flags.get("bell_quest_complete")


def test_positive_shop_and_use_potion():
    assert parse_action_intent("buy a healing potion").kind == SHOP
    assert parse_action_intent("use potion").kind == USE_ITEM


def test_positive_quest_return_intent():
    intent = parse_action_intent("return the shrine bell to Caldus")
    assert intent.kind == QUEST
    assert intent.quest_step == "return_bell"


def test_valid_buy_and_use_change_state_when_appropriate():
    game = GameEngine()
    hero = _hero()
    buy, _ = game.resolve_action(hero, "buy a healing potion", None)
    assert buy.state_changed
    assert hero.gold == 60 - HEALING_POTION_PRICE_GP
    hero.hp = hero.max_hp - 4
    use, _ = game.resolve_action(hero, "use potion", None)
    assert use.state_changed
    assert hero.hp > hero.max_hp - 4


@pytest.mark.parametrize(
    "action",
    [
        "Caldus is standing beside the shrine bell",
        "Nib stole the bell",
        "I heard Caldus talking about the bell",
    ],
)
def test_narrative_mentions_do_not_trigger_quest_intent(action):
    intent = parse_action_intent(action)
    assert intent.kind != QUEST
    assert intent.quest_step != "accept_caldus"
    assert intent.quest_step != "ask_nib"


@pytest.mark.parametrize(
    ("action", "location", "flags"),
    [
        ("Caldus is standing beside the shrine bell", "The Shrine of the Forgotten", {}),
        ("Nib stole the bell", "The Goblin Market", {"bell_quest_accepted": True}),
        ("I heard Caldus talking about the bell", "The Shrine of the Forgotten", {}),
    ],
)
def test_narrative_mentions_do_not_change_quest_state(action, location, flags):
    game = GameEngine()
    hero = game.create_character(1, "Narrate", "human", "fighter")
    hero.location = location
    hero.quest_flags = dict(flags)
    before_flags = copy.deepcopy(hero.quest_flags)
    before_inventory = list(hero.inventory)
    game.resolve_action(hero, action, None)
    assert hero.quest_flags.get("bell_quest_accepted") == before_flags.get("bell_quest_accepted")
    assert hero.quest_flags.get("bell_acquired") == before_flags.get("bell_acquired")
    assert hero.quest_flags.get("bell_quest_complete") == before_flags.get("bell_quest_complete")
    assert [i for i in hero.inventory if "bell" in i.casefold()] == [
        i for i in before_inventory if "bell" in i.casefold()
    ]


def test_valid_quest_chain_still_works():
    game = GameEngine()
    hero = game.create_character(1, "Quest", "human", "fighter")
    hero.location = "The Shrine of the Forgotten"
    accept, _ = game.resolve_action(hero, "talk to Caldus about the shrine bell", None)
    assert accept.state_changed
    assert hero.quest_flags.get("bell_quest_accepted")
    hero.location = "The Goblin Market"
    find, _ = game.resolve_action(hero, "ask Nib about the shrine bell", None)
    assert find.state_changed
    hero.location = "The Shrine of the Forgotten"
    complete, _ = game.resolve_action(hero, "return the shrine bell to Caldus", None)
    assert complete.state_changed
    assert hero.quest_flags.get("bell_quest_complete")
