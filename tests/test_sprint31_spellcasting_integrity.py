"""Sprint 31 — spellcasting rules integrity (SRD 5.1 MVP)."""

from __future__ import annotations

import random

import pytest

from app.engine.models import MonsterState
from app.engine.saving_throws import spell_save_dc
from app.engine.service import GameEngine
from tests.test_spells import create_hero, force_high_rolls


def test_spell_save_dc_wizard_intelligence():
    hero = create_hero("wizard", intelligence=16)
    assert spell_save_dc(hero) == 13  # 8 + 2 prof + 3 INT


def test_spell_save_dc_cleric_wisdom():
    hero = create_hero("cleric", wisdom=14)  # human +1 → WIS 15, mod +2
    assert spell_save_dc(hero) == 12  # 8 + 2 prof + 2 WIS


def test_spell_attack_bonus_matches_proficiency_plus_ability():
    game = GameEngine(random.Random(1))
    hero = create_hero("wizard", intelligence=18)
    assert game._spell_attack_bonus(hero) == 6


def test_fighter_cannot_cast_even_with_hacked_spell_list():
    game = GameEngine(random.Random(1))
    hero = create_hero("fighter")
    hero.known_spells = ["Fire Bolt"]
    before_slots = dict(hero.spell_slots)
    monster = MonsterState(hp=20, max_hp=20, armor_class=10)
    result, _ = game.resolve_action(hero, "cast Fire Bolt", monster)
    assert not result.state_changed
    assert not result.spell_facts["slot_consumed"]
    assert hero.spell_slots == before_slots
    assert "cannot cast spells" in result.events[0].lower()


def test_rogue_cannot_cast():
    game = GameEngine(random.Random(1))
    hero = create_hero("rogue")
    hero.known_spells = ["Magic Missile"]
    result, _ = game.resolve_action(hero, "cast Magic Missile at goblin", None)
    assert not result.state_changed
    assert not result.spell_facts["slot_consumed"]


def test_short_rest_does_not_restore_spell_slots():
    game = GameEngine(random.Random(1))
    force_high_rolls(game)
    hero = create_hero("wizard")
    assert hero.spell_slots == {1: 2}
    game.resolve_action(hero, "cast Magic Missile at goblin", MonsterState(hp=50, max_hp=50, armor_class=12))
    assert hero.spell_slots == {1: 1}
    hero.in_combat = False
    hero.hp = hero.max_hp - 4
    from app.engine.economy_balance import clear_short_rest_gate

    clear_short_rest_gate(hero)
    result, _ = game.resolve_action(hero, "take a breather", None)
    assert result.state_changed
    assert hero.spell_slots == {1: 1}


def test_denied_combat_cast_does_not_consume_slot():
    game = GameEngine(random.Random(1))
    hero = create_hero("cleric")
    hero.in_combat = True
    hero.combat_turn = "enemy"
    hero.prepared_spells = ["Sacred Flame"]
    slots_before = dict(hero.spell_slots)
    result, _ = game.resolve_action(hero, "cast Sacred Flame", MonsterState(hp=10, max_hp=10, armor_class=10))
    assert not result.state_changed
    assert hero.spell_slots == slots_before


@pytest.mark.parametrize("spell", ["Shield"])
def test_unmodeled_cleric_starter_does_not_spend_slot(spell: str):
    game = GameEngine(random.Random(1))
    hero = create_hero("cleric", wisdom=16)
    if spell not in hero.prepared_spells:
        hero.prepared_spells.append(spell)
    before = dict(hero.spell_slots)
    result, _ = game.resolve_action(hero, f"cast {spell}", None)
    assert not result.state_changed
    assert hero.spell_slots == before
    assert result.spell_facts["effect"]["type"] == "not_modeled"
