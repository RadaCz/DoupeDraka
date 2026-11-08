from app.engine.service import GameEngine


def test_vault_route_locked_until_caldus_hint():
    game = GameEngine()
    hero = game.create_character(1, "Trail", "human", "fighter")
    hero.location = "The Sunken Corridor"
    hero.quest_flags = {}
    result = game._travel(hero, "travel to The Vault of Echoes")
    assert not result.state_changed
    assert "sealed" in result.events[0].casefold() or "caldus" in result.events[0].casefold()


def test_vault_opens_after_vault_unlocked():
    game = GameEngine()
    hero = game.create_character(1, "Trail", "human", "fighter")
    hero.location = "The Sunken Corridor"
    hero.quest_flags = {"vault_unlocked": True, "vault_hint_given": True}
    result = game._travel(hero, "travel to The Vault of Echoes")
    assert result.state_changed
    assert hero.location == "The Vault of Echoes"


def test_bell_acquired_persists_after_delivery():
    game = GameEngine()
    hero = game.create_character(1, "Bell", "human", "fighter")
    hero.location = "The Shrine of the Forgotten"
    hero.quest_flags = {"bell_found": True, "bell_acquired": True}
    hero.inventory.append("Shrine bell")
    result, _ = game.resolve_action(hero, "return the shrine bell to Caldus", None)
    assert result.state_changed
    assert hero.quest_flags["bell_quest_complete"]
    assert hero.quest_flags.get("bell_acquired")
    assert hero.quest_flags.get("bell_found")


def test_negated_attack_does_not_start_combat():
    game = GameEngine()
    hero = game.create_character(1, "Peace", "human", "fighter")
    hero.location = "The Shrine of the Forgotten"
    hero.quest_flags = {"bell_quest_accepted": True}
    result, monster = game.resolve_action(hero, "Nechci zaútočit, chci mluvit s Caldus", None)
    assert monster is None
    assert not hero.in_combat
    assert not any("Initiative" in event for event in result.events)
