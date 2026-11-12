"""Sprint 32 — concentration, core cleric/wizard spells, bonus-action rule."""

from __future__ import annotations

import random

from app.engine.concentration import EFFECT_BLESS, concentration_active
from app.engine.equipment import compute_armor_class, refresh_armor_class
from app.engine.models import MonsterState
from app.engine.service import GameEngine
from tests.test_spells import create_hero, force_high_rolls


def test_bless_rolls_and_sets_concentration():
    game = GameEngine(random.Random(1))
    force_high_rolls(game)
    hero = create_hero("cleric", wisdom=16)
    result, _ = game.resolve_action(hero, "cast Bless", None)
    assert result.state_changed
    assert concentration_active(hero)
    assert hero.concentration_effect == EFFECT_BLESS
    assert hero.concentration_bonus >= 1
    assert hero.spell_slots == {1: 1}


def test_shield_of_faith_raises_ac():
    game = GameEngine(random.Random(1))
    hero = create_hero("cleric")
    if "Shield of Faith" not in hero.prepared_spells:
        hero.prepared_spells.append("Shield of Faith")
    base = refresh_armor_class(hero)
    result, _ = game.resolve_action(hero, "cast Shield of Faith", None)
    assert result.state_changed
    assert hero.armor_class == base + 2


def test_mage_armor_sets_thirteen_plus_dex():
    game = GameEngine(random.Random(1))
    hero = create_hero("wizard", dexterity=14)
    if "Mage Armor" not in hero.known_spells:
        hero.known_spells.append("Mage Armor")
    result, _ = game.resolve_action(hero, "cast Mage Armor", None)
    assert result.state_changed
    assert hero.mage_armor_active
    assert hero.armor_class == 13 + 2


def test_mage_armor_ignored_when_wearing_armor():
    game = GameEngine(random.Random(1))
    hero = create_hero("wizard", dexterity=14)
    hero.mage_armor_active = True
    hero.item_instances = [{"name": "chain mail", "equipped_slot": "armor"}]
    ac = compute_armor_class(hero)
    assert ac != 13 + 2


def test_new_concentration_replaces_old():
    game = GameEngine(random.Random(1))
    hero = create_hero("cleric")
    hero.prepared_spells = list(set(hero.prepared_spells) | {"Bless", "Shield of Faith"})
    game.resolve_action(hero, "cast Bless", None)
    game.resolve_action(hero, "cast Shield of Faith", None)
    assert hero.concentration_spell == "Shield of Faith"


def test_healing_word_then_cantrip_allowed_in_combat():
    game = GameEngine(random.Random(1))
    force_high_rolls(game)
    hero = create_hero("cleric")
    hero.in_combat = True
    hero.combat_turn = "player"
    hero.max_hp = 30
    hero.hp = 10
    from app.engine.class_features import mark_player_turn_start

    mark_player_turn_start(hero)
    hero.prepared_spells = list(hero.prepared_spells) + ["Healing Word", "Sacred Flame"]
    monster = MonsterState(hp=20, max_hp=20, armor_class=10)
    hw, _ = game.resolve_action(hero, "cast Healing Word", monster)
    assert hw.state_changed
    sf, _ = game.resolve_action(hero, "cast Sacred Flame", monster)
    assert sf.state_changed


def test_healing_word_blocks_leveled_action_spell_same_turn():
    game = GameEngine(random.Random(1))
    hero = create_hero("cleric")
    hero.in_combat = True
    hero.combat_turn = "player"
    hero.hp = 5
    hero.max_hp = 20
    from app.engine.class_features import mark_player_turn_start

    mark_player_turn_start(hero)
    hero.prepared_spells = list(set(hero.prepared_spells) | {"Healing Word", "Cure Wounds"})
    monster = MonsterState(hp=20, max_hp=20, armor_class=10)
    game.resolve_action(hero, "cast Healing Word", monster)
    slots_after_hw = dict(hero.spell_slots)
    cure, _ = game.resolve_action(hero, "cast Cure Wounds", monster)
    assert not cure.state_changed
    assert hero.spell_slots == slots_after_hw


def test_concentration_save_dc_ten_on_small_damage():
    game = GameEngine(random.Random(0))
    game.rng.randint = lambda a, b: 15
    hero = create_hero("cleric")
    game.resolve_action(hero, "cast Bless", None)
    hero.hp = 20
    hero.max_hp = 20
    lines = game._enemy_melee_strike(
        hero,
        MonsterState(hp=10, max_hp=10, attack_bonus=10, damage="1d6"),
        "claw",
        attack_advantage=False,
        attack_disadvantage=False,
    )
    assert any("Concentration check" in line for line in lines)
    assert any("DC 10" in line for line in lines)
