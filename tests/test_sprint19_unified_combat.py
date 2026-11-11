"""Sprint 19 — unified saves, spell saves, and conditions."""

from __future__ import annotations

import random

from app.engine.conditions import has_condition, monster_has_condition
from app.engine.encounters import build_monster
from app.engine.models import MonsterState
from app.engine.saving_throws import (
    SavingThrowRequest,
    perform_monster_saving_throw,
    perform_saving_throw,
    spell_save_dc,
)
from app.engine.service import GameEngine


def _wizard(game: GameEngine):
    return game.create_character(1, "Caster", "human", "wizard")


def test_spell_save_dc_matches_srd_formula():
    game = GameEngine(random.Random(2))
    hero = _wizard(game)
    assert spell_save_dc(hero) == 8 + 2 + 3  # INT 16 -> +3


def test_monster_save_uses_modifier_not_proficiency():
    game = GameEngine(random.Random(3))
    monster = MonsterState(name="Kobold", saving_throws={"dexterity": 2})
    game.rng.randint = lambda a, b: 15
    req = SavingThrowRequest("dexterity", 12, "spell", "burning_hands")
    result = perform_monster_saving_throw(game, monster, req)
    assert result.actor_type == "monster"
    assert result.proficient is False
    assert result.total == 17
    assert result.success


def test_burning_hands_half_damage_on_success():
    game = GameEngine(random.Random(4))
    hero = _wizard(game)
    game.rng.randint = lambda a, b: 18 if b == 20 else 4
    monster = MonsterState(hp=40, max_hp=40, saving_throws={"dexterity": 2})
    result, monster = game.resolve_action(hero, "cast Burning Hands", monster)
    assert result.spell_facts["save_result"]["succeeded"]
    assert result.spell_facts["effect"]["damage"] > 0
    assert monster.hp < 40


def test_sacred_flame_no_damage_when_save_succeeds():
    game = GameEngine(random.Random(5))
    hero = game.create_character(
        1, "Cleric", "human", "cleric",
        {"strength": 10, "dexterity": 10, "constitution": 10, "intelligence": 10, "wisdom": 16, "charisma": 10},
    )
    game.rng.randint = lambda a, b: 18 if b == 20 else 4
    monster = MonsterState(hp=30, max_hp=30, saving_throws={"dexterity": 0})
    result, monster = game.resolve_action(hero, "cast Sacred Flame", monster)
    assert result.spell_facts["save_result"]["succeeded"]
    assert result.spell_facts["effect"]["damage"] == 0
    assert monster.hp == 30


def test_ghoul_paralysis_on_failed_save_not_bonus_damage():
    from app.engine.combat_effects import ENEMY_SAVE_ABILITIES, resolve_save_effect

    game = GameEngine(random.Random(6))
    hero = game.create_character(
        1, "Scout", "human", "rogue",
        {"strength": 10, "dexterity": 16, "constitution": 8, "intelligence": 14, "wisdom": 10, "charisma": 10},
    )
    game.rng.randint = lambda a, b: 3 if a == 1 and b == 20 else 4
    definition = ENEMY_SAVE_ABILITIES["ghoul"]
    _, damage, events = resolve_save_effect(game, hero, definition)
    joined = " ".join(events)
    assert damage == 0
    assert "paralyzed" in joined.lower()
    assert has_condition(hero, "paralyzed")


def test_paralyzed_player_cannot_attack():
    game = GameEngine(random.Random(7))
    hero = game.create_character(1, "Hero", "human", "fighter")
    hero.in_combat = True
    hero.combat_turn = "player"
    hero.location = "The Whispering Cellar"
    from app.engine.conditions import apply_player_condition

    apply_player_condition(
        hero,
        "paralyzed",
        "test",
        applied_at_round=1,
        repeat_save_ability="constitution",
        repeat_save_dc=10,
    )
    monster = build_monster("normal", "goblin")
    result, _ = game.resolve_action(hero, "attack goblin", monster)
    assert result.state_changed
    assert any("paralyzed" in e.casefold() for e in result.events)
    assert any("end of your turn" in e.casefold() for e in result.events)


def test_repeat_save_runs_end_of_player_turn_not_before_action():
    game = GameEngine(random.Random(71))
    hero = game.create_character(1, "Hero", "human", "fighter")
    hero.in_combat = True
    hero.combat_turn = "player"
    hero.location = "The Whispering Cellar"
    from app.engine.conditions import apply_player_condition, clear_condition

    apply_player_condition(
        hero,
        "paralyzed",
        "test",
        applied_at_round=1,
        repeat_save_ability="constitution",
        repeat_save_dc=10,
    )
    game.rng.randint = lambda a, b: 18 if b == 20 else 10
    monster = build_monster("normal", "goblin")
    result, _ = game.resolve_action(hero, "attack goblin", monster)
  # repeat save should succeed at end of turn before enemy swing
    assert not has_condition(hero, "paralyzed")
    assert any("effect ends" in e.casefold() for e in result.events)


def test_melee_hit_vs_paralyzed_player_is_critical():
    game = GameEngine(random.Random(72))
    hero = game.create_character(1, "Hero", "human", "fighter")
    hero.armor_class = 14
    hero.hp = 30
    hero.in_combat = True
    from app.engine.conditions import apply_player_condition

    apply_player_condition(hero, "paralyzed", "ghoul", applied_at_round=1)
    monster = build_monster("normal", "ghoul")
    game.rng.randint = lambda a, b: 15 if b == 20 else 4
    events, _ = game._enemy_turn(hero, monster)
    joined = " ".join(events).casefold()
    assert "critical" in joined
    assert hero.hp < 30 - 8  # 1d8+2 doubled exceeds single normal hit max-ish


def test_mockery_disadvantage_consumed_on_attack():
    game = GameEngine(random.Random(8))
    hero = _wizard(game)
    monster = build_monster("normal", "goblin")
    monster.attack_bonus = 10
    from app.engine.conditions import apply_monster_condition

    apply_monster_condition(monster, "disadvantage_next_attack", "mockery", applied_at_round=1)
    hero.armor_class = 18
    hero.in_combat = True
    game.rng.randint = lambda a, b: 12
    events, _ = game._enemy_turn(hero, monster)
    assert not monster_has_condition(monster, "disadvantage_next_attack")
