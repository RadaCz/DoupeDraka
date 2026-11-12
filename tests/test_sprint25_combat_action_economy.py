"""Sprint 25 — unified combat action / bonus / reaction economy."""

import random
from dataclasses import asdict

from app.db import decode_character_state, encode_character_state
from app.engine.class_features import mark_player_turn_start
from app.engine.models import CharacterState
from app.engine.combat_action_economy import (
    economy_snapshot,
    has_legitimate_bonus_action,
    reset_player_turn_economy,
    should_advance_enemy_after_player_activity,
    spend_action,
    spend_bonus_action,
)
from app.engine.models import MonsterState
from app.engine.service import GameEngine

from tests.test_spells import create_hero, force_high_rolls


def _player_combat(hero, monster: MonsterState | None = None):
    hero.in_combat = True
    hero.combat_turn = "player"
    hero.combat_round = 1
    mark_player_turn_start(hero)
    return monster or MonsterState(name="Goblin", hp=30, max_hp=30, armor_class=12)


def _durable_monster() -> MonsterState:
    return MonsterState(name="Goblin", hp=80, max_hp=80, armor_class=18)


def test_turn_start_resets_action_pools():
    hero = create_hero("fighter")
    hero.in_combat = True
    hero.combat_turn = "player"
    hero.combat_flags = {
        **hero.combat_flags,
        "action_used": True,
        "bonus_action_used": True,
        "reaction_used": True,
    }
    mark_player_turn_start(hero)
    snap = economy_snapshot(hero)
    assert snap["action_available"] is True
    assert snap["bonus_available"] is True
    assert snap["reaction_available"] is True


def test_cannot_spend_action_or_bonus_twice():
    hero = create_hero("rogue")
    _player_combat(hero)
    assert spend_action(hero)[0]
    assert not spend_action(hero)[0]
    hero.combat_flags["action_used"] = False
    assert spend_bonus_action(hero)[0]
    assert not spend_bonus_action(hero)[0]


def test_healing_word_uses_bonus_without_ending_turn():
    game = GameEngine(random.Random(7))
    force_high_rolls(game)
    bard = create_hero("bard", charisma=16)
    bard.prepared_spells = ["Healing Word"]
    bard.known_spells = ["Healing Word"]
    bard.spell_slots = {1: 1}
    bard.hp = 8
    bard.max_hp = 20
    monster = _player_combat(bard)
    result, m = game.resolve_action(bard, "cast Healing Word", monster)
    assert result.state_changed
    assert result.spell_facts["effect"]["action_cost"] == "bonus"
    assert bard.combat_flags.get("bonus_action_used")
    assert not bard.combat_flags.get("action_used")
    assert bard.combat_turn == "player"
    assert m is monster and m.hp == 30


def test_healing_word_rejected_when_bonus_spent():
    game = GameEngine(random.Random(7))
    bard = create_hero("bard", charisma=16)
    bard.prepared_spells = ["Healing Word"]
    bard.known_spells = ["Healing Word"]
    bard.spell_slots = {1: 1}
    bard.hp = 8
    monster = _player_combat(bard)
    spend_bonus_action(bard)
    result, _ = game.resolve_action(bard, "cast Healing Word", monster)
    assert not result.state_changed
    assert bard.spell_slots == {1: 1}


def test_second_wind_bonus_then_attack_same_turn():
    game = GameEngine(random.Random(9))
    game.rng.randint = lambda low, high: high
    fighter = create_hero("fighter", constitution=14)
    fighter.hp = 8
    fighter.second_wind_available = True
    monster = _player_combat(fighter)
    result_sw, _ = game.resolve_action(fighter, "second wind", monster)
    assert result_sw.state_changed
    assert fighter.combat_turn == "player"
    assert fighter.combat_flags.get("bonus_action_used")
    assert not fighter.combat_flags.get("action_used")
    result_atk, _ = game.resolve_action(fighter, "attack Goblin", monster)
    assert result_atk.state_changed
    assert any("Attack" in line for line in result_atk.events)


def test_arcane_recovery_blocked_in_combat():
    wizard = create_hero("wizard", intelligence=16)
    wizard.arcane_recovery_available = True
    wizard.arcane_recovery_ready = True
    wizard.spell_slots = {1: 0}
    _player_combat(wizard)
    from app.engine.class_features import use_arcane_recovery

    ok, lines, _ = use_arcane_recovery(wizard)
    assert not ok
    assert any("combat" in line.casefold() for line in lines)


def test_combat_economy_flags_survive_encode_roundtrip():
    hero = create_hero("cleric")
    _player_combat(hero)
    spend_bonus_action(hero)
    hero.combat_flags["action_used"] = True
    payload = encode_character_state(asdict(hero))
    restored = CharacterState(**decode_character_state(payload))
    assert restored.combat_flags.get("bonus_action_used")
    assert restored.combat_flags.get("action_used")


def test_attack_then_second_wind_same_player_round():
    game = GameEngine(random.Random(11))
    game.rng.randint = lambda _low, high: min(14, high)
    fighter = create_hero("fighter", constitution=14)
    fighter.hp = 18
    fighter.second_wind_available = True
    monster = _player_combat(fighter)
    result_atk, _ = game.resolve_action(fighter, "attack Goblin", monster)
    assert result_atk.state_changed
    assert fighter.combat_round == 1
    assert fighter.combat_turn == "player"
    assert fighter.combat_flags.get("action_used")
    assert not fighter.combat_flags.get("bonus_action_used")
    assert has_legitimate_bonus_action(fighter)
    assert not should_advance_enemy_after_player_activity(fighter)
    result_sw, _ = game.resolve_action(fighter, "second wind", monster)
    assert result_sw.state_changed
    assert fighter.combat_flags.get("bonus_action_used")
    assert should_advance_enemy_after_player_activity(fighter)


def test_rogue_hide_then_attack_same_round():
    game = GameEngine(random.Random(3))
    rogue = create_hero("rogue", dexterity=16)
    rogue.level = 2
    rogue.hp = 40
    rogue.max_hp = 40
    monster = _player_combat(rogue, _durable_monster())
    game.rng.randint = lambda _low, high: min(12, high)
    hide_result, _ = game.resolve_action(rogue, "hide", monster)
    assert hide_result.state_changed
    assert rogue.combat_flags.get("bonus_action_used")
    assert not should_advance_enemy_after_player_activity(rogue)
    assert rogue.combat_round == 1
    attack_result, _ = game.resolve_action(rogue, "attack Goblin", monster)
    assert attack_result.state_changed
    assert rogue.in_combat
    assert any("misses" in line.casefold() or "hits you" in line.casefold() for line in attack_result.events)


def test_cleric_healing_word_then_sacred_flame():
    game = GameEngine(random.Random(4))
    force_high_rolls(game)
    cleric = create_hero("cleric", wisdom=16)
    cleric.prepared_spells = ["Healing Word", "Sacred Flame"]
    cleric.known_spells = ["Healing Word", "Sacred Flame"]
    cleric.spell_slots = {1: 1}
    cleric.hp = 6
    cleric.max_hp = 30
    monster = _player_combat(cleric, _durable_monster())
    hw, _ = game.resolve_action(cleric, "cast Healing Word", monster)
    assert hw.state_changed
    assert cleric.combat_flags.get("bonus_action_used")
    assert not cleric.combat_flags.get("action_used")
    assert cleric.combat_turn == "player"
    assert cleric.combat_round == 1
    sf, _ = game.resolve_action(cleric, "cast Sacred Flame", monster)
    assert sf.state_changed
    assert cleric.in_combat
    assert any("misses" in line.casefold() or "hits you" in line.casefold() for line in sf.events)


def test_action_only_advances_when_no_bonus_offer():
    game = GameEngine(random.Random(2))
    wizard = create_hero("wizard", intelligence=16)
    wizard.hp = 30
    wizard.max_hp = 30
    monster = _player_combat(wizard, _durable_monster())
    game.rng.randint = lambda _low, high: min(10, high)
    assert not has_legitimate_bonus_action(wizard)
    wizard.prepared_spells = ["Fire Bolt"]
    wizard.known_spells = ["Fire Bolt"]
    result, _ = game.resolve_action(wizard, "cast Fire Bolt", monster)
    assert result.state_changed
    assert wizard.in_combat
    assert any("misses" in line.casefold() or "hits you" in line.casefold() for line in result.events)


def test_end_turn_closes_partial_action_pool():
    game = GameEngine(random.Random(5))
    game.rng.randint = lambda _low, high: min(14, high)
    fighter = create_hero("fighter", constitution=14)
    fighter.hp = 10
    fighter.second_wind_available = True
    monster = _player_combat(fighter)
    game.resolve_action(fighter, "attack Goblin", monster)
    assert fighter.combat_turn == "player"
    end, _ = game.resolve_action(fighter, "end turn", monster)
    assert end.state_changed
    assert any("end your turn" in line.casefold() for line in end.events)
    assert any("misses" in line.casefold() or "hits" in line.casefold() for line in end.events)
    assert fighter.combat_round >= 2


def test_denied_second_wind_does_not_consume_bonus():
    game = GameEngine(random.Random(1))
    bard = create_hero("bard")
    monster = _player_combat(bard)
    result, _ = game.resolve_action(bard, "second wind", monster)
    assert not result.state_changed
    assert not bard.combat_flags.get("bonus_action_used")


def test_denied_spell_does_not_consume_slot():
    game = GameEngine(random.Random(3))
    cleric = create_hero("cleric", wisdom=16)
    cleric.prepared_spells = ["Sacred Flame"]
    cleric.known_spells = ["Sacred Flame"]
    cleric.spell_slots = {1: 1}
    monster = _player_combat(cleric)
    spend_action(cleric)
    result, _ = game.resolve_action(cleric, "cast Sacred Flame", monster)
    assert not result.state_changed
    assert cleric.spell_slots == {1: 1}
