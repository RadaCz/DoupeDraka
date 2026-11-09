"""End-to-end chapter-one quest path through the engine (no UI shortcuts)."""

from app.engine.locations import travel_allowed
from app.engine.service import GameEngine


def _shrine_hero():
    game = GameEngine()
    hero = game.create_character(1, "Pilgrim", "human", "cleric")
    hero.location = "The Shrine of the Forgotten"
    hero.quest_flags = {}
    return game, hero


def test_chapter_one_bell_quest_unlocks_vault():
    game, hero = _shrine_hero()
    accept, _ = game.resolve_action(hero, "talk to Caldus about the shrine bell", None)
    assert accept.state_changed
    assert hero.quest_flags.get("bell_quest_accepted")

    hero.location = "The Goblin Market"
    nib, _ = game.resolve_action(hero, "ask Nib about the shrine bell", None)
    assert nib.state_changed
    assert hero.quest_flags.get("bell_acquired") or hero.quest_flags.get("bell_found")
    assert any("bell" in item.casefold() for item in hero.inventory)

    hero.location = "The Shrine of the Forgotten"
    hand_in, _ = game.resolve_action(hero, "return the shrine bell to Caldus", None)
    assert hand_in.state_changed
    assert hero.quest_flags.get("bell_quest_complete")

    follow_up, _ = game.resolve_action(hero, "talk to Caldus about the shrine bell", None)
    assert follow_up.state_changed or hero.quest_flags.get("vault_hint_given")

    assert hero.quest_flags.get("vault_unlocked")
    assert travel_allowed("The Vault of Echoes", hero.quest_flags)


def test_potion_and_equip_remain_deterministic_mid_quest():
    game = GameEngine()
    hero = game.create_character(1, "Fighter", "human", "fighter")
    hero.inventory = ["shortsword", "healing potion"]
    from app.engine.equipment import default_item_instances, equipped_weapon

    hero.item_instances = default_item_instances(hero.inventory)
    hero.hp = 3
    drink, _ = game.resolve_action(hero, "use potion", None)
    assert drink.state_changed
    assert hero.hp > 3
    assert "potion" not in " ".join(hero.inventory).casefold()

    equip, _ = game.resolve_action(hero, "equip shortsword", None)
    assert equip.state_changed
    assert equipped_weapon(hero).key == "shortsword"
