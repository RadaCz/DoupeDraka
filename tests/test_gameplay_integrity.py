"""Sprint 1 — engine rule enforcement (boss gating, levels, equipment, advantage)."""

import random

import pytest

from app.engine.encounters import (
    MONSTERS,
    filter_encounter_pool,
    monster_allowed_for_character,
)
from app.engine.equipment import STARTING_INVENTORY_BY_CLASS, equipped_weapon, set_equipped_weapon, weapon_proficiency
from app.engine.models import MonsterState, RollResult
from app.engine.ruleset_v1 import MAX_MVP_LEVEL
from app.engine.service import GameEngine, XP_THRESHOLD


def _fighter():
    game = GameEngine(random.Random(3))
    hero = game.create_character(1, "Tank", "human", "fighter")
    hero.location = "The Whispering Cellar"
    return game, hero


def test_cannot_attack_bell_warden_outside_pit():
    game, hero = _fighter()
    hero.level = 3
    hero.quest_flags = {"vault_unlocked": True}
    hero.location = "The Whispering Cellar"
    result, monster = game.resolve_action(hero, "attack the Bell Warden", None)
    assert not result.state_changed
    assert monster is None
    assert not hero.quest_flags.get("chapter_one_complete")


def test_cannot_complete_chapter_by_named_attack_in_cellar():
    game, hero = _fighter()
    hero.level = 5
    hero.quest_flags = {"vault_unlocked": True}
    hero.location = "The Whispering Cellar"
    game.rng.randint = lambda a, b: 18
    result, monster = game.resolve_action(hero, "attack bell warden", None)
    assert not result.state_changed or not hero.quest_flags.get("chapter_one_complete")
    assert not hero.quest_flags.get("chapter_one_complete")


def test_bell_warden_blocked_below_tier_level():
    game, hero = _fighter()
    hero.level = 2
    hero.quest_flags = {"vault_unlocked": True}
    hero.location = "The Bell Warden's Pit"
    assert not monster_allowed_for_character(hero, "bell_warden")
    result, monster = game.resolve_action(hero, "attack the Bell Warden", None)
    assert not result.state_changed
    assert monster is None
    assert any("level 2" in event for event in result.events)
    assert any("at least level 3" in event for event in result.events)
    assert not any("is here for you to fight" in event for event in result.events)


def test_bell_warden_attack_allowed_at_required_level():
    game, hero = _fighter()
    hero.level = 3
    hero.quest_flags = {"vault_unlocked": True}
    hero.location = "The Bell Warden's Pit"
    assert monster_allowed_for_character(hero, "bell_warden")
    result, monster = game.resolve_action(hero, "attack the Bell Warden", None)
    assert result.state_changed
    assert any("Initiative" in event and "Bell Warden" in event for event in result.events)
    assert not any("beyond your current experience" in event for event in result.events)
    assert not any("is here for you to fight" in event for event in result.events)


def test_bell_warden_wrong_location_explains_pit_not_missing():
    game, hero = _fighter()
    hero.level = 5
    hero.quest_flags = {"vault_unlocked": True}
    hero.location = "The Whispering Cellar"
    result, monster = game.resolve_action(hero, "attack the Bell Warden", None)
    assert not result.state_changed
    assert monster is None
    assert any("Bell Warden's Pit" in event for event in result.events)
    assert not any("is here for you to fight" in event for event in result.events)


def test_encounter_pool_fallback_never_bypasses_level():
    pool = ("bandit_captain", "ogre", "bell_warden")
    eligible = filter_encounter_pool(pool, 1)
    assert "bandit_captain" not in eligible
    assert "ogre" not in eligible
    assert "bell_warden" not in eligible
    assert all(MONSTERS[key].tier == 1 for key in eligible)


def test_random_encounter_never_exceeds_level_tier():
    game = GameEngine(random.Random(0))
    hero = game.create_character(1, "Scout", "human", "fighter")
    hero.location = "The Bell Warden's Pit"
    hero.quest_flags = {"vault_unlocked": True}
    for seed in range(40):
        game.rng = random.Random(seed)
        monster = game._random_encounter(hero)
        key = next(k for k, t in MONSTERS.items() if t.name == monster.name)
        assert key != "bell_warden"
        assert MONSTERS[key].tier <= 1


def test_max_mvp_level_cannot_be_exceeded():
    game = GameEngine(random.Random(1))
    hero = game.create_character(1, "Grinder", "human", "fighter")
    hero.level = MAX_MVP_LEVEL
    hero.xp = XP_THRESHOLD - 1
    before_hp = hero.max_hp
    game._grant_xp(hero, 500)
    assert hero.level == MAX_MVP_LEVEL
    assert hero.xp <= XP_THRESHOLD - 1
    assert hero.max_hp == before_hp


@pytest.mark.parametrize(
    ("cls", "expected_weapon"),
    [
        ("fighter", "shortsword"),
        ("rogue", "shortsword"),
        ("cleric", "mace"),
        ("wizard", "dagger"),
    ],
)
def test_new_character_starting_inventory_and_equip(cls, expected_weapon):
    game = GameEngine(random.Random(0))
    hero = game.create_character(1, "Hero", "human", cls)
    for item in STARTING_INVENTORY_BY_CLASS[cls]:
        assert item in hero.inventory
    assert equipped_weapon(hero).key == expected_weapon
    assert weapon_proficiency(hero, equipped_weapon(hero).key)


def test_wizard_starting_gear_not_martial_sword():
    game = GameEngine(random.Random(0))
    hero = game.create_character(1, "Lyra", "elf", "wizard")
    assert "shortsword" not in hero.inventory
    assert equipped_weapon(hero).key == "dagger"


def test_nonproficient_weapon_cannot_equip():
    game = GameEngine(random.Random(0))
    hero = game.create_character(1, "Lyra", "elf", "wizard")
    hero.inventory.append("longsword")
    from app.engine.equipment import sync_item_instances

    sync_item_instances(hero)
    ok, message = set_equipped_weapon(hero, "longsword")
    assert not ok
    assert equipped_weapon(hero).key != "longsword" or "training" in message.casefold()


def test_potion_use_preserves_equipped_weapon():
    game, hero = _fighter()
    hero.inventory = ["shortsword", "mace", "healing potion"]
    from app.engine.equipment import default_item_instances

    hero.item_instances = default_item_instances(hero.inventory, hero)
    set_equipped_weapon(hero, "mace")
    hero.hp = 2
    assert equipped_weapon(hero).key == "mace"
    result, _ = game.resolve_action(hero, "use potion", None)
    assert result.state_changed
    assert equipped_weapon(hero).key == "mace"
    assert any(entry.get("equipped") and "mace" in entry.get("name", "").casefold() for entry in hero.item_instances)


def test_shop_purchase_preserves_equipped_weapon():
    game, hero = _fighter()
    hero.location = "The Goblin Market"
    hero.gold = 200
    hero.inventory = ["shortsword", "mace"]
    from app.engine.equipment import default_item_instances

    hero.item_instances = default_item_instances(hero.inventory, hero)
    set_equipped_weapon(hero, "mace")
    result, _ = game.resolve_action(hero, "buy healing potion", None)
    assert result.state_changed
    assert equipped_weapon(hero).key == "mace"


def test_disadvantage_natural_twenty_on_wrong_die_not_auto_hit(monkeypatch):
    game = GameEngine(random.Random(0))
    hero = game.create_character(1, "Dodger", "human", "fighter")
    monster = MonsterState(name="Goblin scout", hp=10, max_hp=10, armor_class=30, attack_bonus=5, damage="1d4")

    def fake_roll(dice: str, modifier: int = 0, critical: bool = False) -> RollResult:
        if dice == "2d20":
            return RollResult("2d20", (20, 5), modifier, 25 + modifier, False)
        return game.roll(dice, modifier, critical)

    monkeypatch.setattr(game, "roll", fake_roll)
    events, _ = game._enemy_turn(hero, monster, disadvantage=True)
    assert any("miss" in event.lower() for event in events)
    assert hero.hp == hero.max_hp


def test_disadvantage_five_twenty_uses_lower_die(monkeypatch):
    game = GameEngine(random.Random(0))
    hero = game.create_character(1, "Dodger", "human", "fighter")
    monster = MonsterState(name="Goblin scout", hp=10, max_hp=10, armor_class=30, attack_bonus=0, damage="1d4")
    seen: list[int] = []

    def fake_roll(dice: str, modifier: int = 0, critical: bool = False) -> RollResult:
        if dice == "2d20":
            seen.append(1)
            return RollResult("2d20", (5, 20), modifier, 25, False)
        return RollResult(dice, (3,), modifier, 3 + modifier, critical)

    monkeypatch.setattr(game, "roll", fake_roll)
    events, _ = game._enemy_turn(hero, monster, disadvantage=True)
    assert seen
    assert any("miss" in event.lower() for event in events)


def test_advantage_style_player_crit_uses_natural_twenty():
    game = GameEngine(random.Random(0))
    hero = game.create_character(1, "Striker", "human", "fighter", abilities={
        "strength": 18, "dexterity": 10, "constitution": 14,
        "intelligence": 10, "wisdom": 10, "charisma": 8,
    })
    monster = MonsterState(name="Goblin scout", hp=50, max_hp=50, armor_class=25, attack_bonus=0, damage="1d4")
    game.rng.randint = lambda a, b: 20 if a == 1 and b == 20 else 1
    events = game.attack(hero, monster)
    assert any("hit" in event.casefold() for event in events)


def test_bare_attack_without_enemy_rejected():
    game, hero = _fighter()
    result, monster = game.resolve_action(hero, "attack", None)
    assert not result.state_changed
    assert monster is None
