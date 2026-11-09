"""Inventory equip and potion use keep item_instances aligned with the engine."""

from app.engine.equipment import default_item_instances, equipped_weapon, item_attack_bonus, set_equipped_weapon
from app.engine.service import GameEngine


def test_equip_weapon_updates_instances_and_attack_bonus():
    game = GameEngine()
    hero = game.create_character(1, "Tank", "human", "fighter")
    hero.inventory = ["traveler's clothes", "shortsword", "longsword"]
    hero.item_instances = default_item_instances(hero.inventory)

    ok, msg = set_equipped_weapon(hero, "longsword")
    assert ok
    assert "longsword" in msg.casefold()
    assert equipped_weapon(hero).key == "longsword"
    assert any(entry.get("equipped") and "longsword" in entry.get("name", "").casefold() for entry in hero.item_instances)


def test_wizard_cannot_equip_martial_longsword():
    game = GameEngine()
    hero = game.create_character(1, "Lyra", "elf", "wizard")
    hero.inventory = ["dagger", "longsword"]
    hero.item_instances = default_item_instances(hero.inventory)

    ok, msg = set_equipped_weapon(hero, "longsword")
    assert not ok
    assert "training" in msg.casefold() or "cannot" in msg.casefold()


def test_equip_via_action_command():
    game = GameEngine()
    hero = game.create_character(1, "Tank", "human", "fighter")
    hero.inventory = ["shortsword", "mace"]
    hero.item_instances = default_item_instances(hero.inventory)

    result, _ = game.resolve_action(hero, "equip mace", None)
    assert result.state_changed
    assert equipped_weapon(hero).key == "mace"


def test_potion_use_refreshes_item_instances():
    game = GameEngine()
    hero = game.create_character(1, "Healer", "human", "cleric")
    hero.inventory.append("healing potion")
    hero.item_instances = default_item_instances(hero.inventory)
    hero.hp = 1

    result, _ = game.resolve_action(hero, "use potion", None)
    assert result.state_changed
    assert "healing potion" not in hero.inventory
    assert not any("potion" in entry.get("name", "").casefold() for entry in hero.item_instances)


def test_shop_shortsword_plus_one_stays_equipped_with_bonus():
    game = GameEngine()
    hero = game.create_character(1, "Buyer", "human", "fighter")
    hero.location = "The Goblin Market"
    hero.gold = 150
    hero.inventory = ["traveler's clothes"]
    hero.item_instances = default_item_instances(hero.inventory)

    result, _ = game.resolve_action(hero, "buy shortsword +1", None)
    assert result.state_changed
    assert item_attack_bonus(hero) == 1
