import random

from app.engine.equipment import attack_modifier, equipped_weapon
from app.engine.models import MonsterState
from app.engine.service import GameEngine


def test_attack_uses_weapon_die_and_proficiency():
    game = GameEngine(random.Random(99))
    hero = game.create_character(1, "Arin", "human", "fighter", abilities={
        "strength": 16, "dexterity": 12, "constitution": 14,
        "intelligence": 10, "wisdom": 10, "charisma": 10,
    })
    weapon = equipped_weapon(hero)
    assert weapon.damage == "1d6"  # shortsword in starting inventory
    assert attack_modifier(hero, weapon) == 5  # +2 prof +3 STR
    monster = MonsterState(hp=20, max_hp=20, armor_class=10)
    game.rng.randint = lambda a, b: 15
    events = game.attack(hero, monster)
    assert any("1d6" in event for event in events)


def test_initiative_can_put_enemy_first():
    game = GameEngine(random.Random(1))
    hero = game.create_character(1, "Arin", "human", "fighter", abilities={
        "strength": 14, "dexterity": 8, "constitution": 12,
        "intelligence": 10, "wisdom": 10, "charisma": 10,
    })
    hero.in_combat = False
    monster = MonsterState(name="Kobold", hp=5, max_hp=5, armor_class=12)
  # Force low player initiative, high enemy
    calls = iter([1, 18, 18, 10, 10, 10, 10, 5, 8])
    game.rng.randint = lambda a, b: next(calls)
    result, active = game.resolve_action(hero, "attack the kobold", None)
    assert any("Initiative" in event for event in result.events)
    assert any("acts first" in event or "Enemy" in event or "hits" in event.lower() for event in result.events)
