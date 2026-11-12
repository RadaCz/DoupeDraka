"""Sprint 33 — Shield reaction window and reactive spellcasting."""

from __future__ import annotations

import random

from app.engine.combat_action_economy import FLAG_REACTION_USED
from app.engine.equipment import refresh_armor_class
from app.engine.models import MonsterState
from app.engine.reactive_spells import has_pending_reaction
from app.engine.service import GameEngine
from tests.test_spells import create_hero


def _wizard_with_shield() -> tuple[GameEngine, object]:
    game = GameEngine(random.Random(7))
    hero = create_hero("wizard", dexterity=10)
    if "Shield" not in hero.known_spells:
        hero.known_spells.append("Shield")
    return game, hero


def test_enemy_hit_opens_reaction_window_for_wizard():
    game, hero = _wizard_with_shield()
    hero.in_combat = True
    refresh_armor_class(hero)
    hero.armor_class = 12
    monster = MonsterState(
        name="Orc",
        hp=20,
        max_hp=20,
        armor_class=12,
        attack_bonus=3,
        damage="1d6+2",
        template_key="goblin",
    )
    events = game._resolve_enemy_hit_on_player(
        hero,
        monster,
        "goblin",
        label="attack",
        melee=True,
        natural=17,
        attack_total=20,
        attack_advantage=False,
        attack_disadvantage=False,
    )
    assert has_pending_reaction(hero)
    assert hero.combat_turn == "reaction"
    assert any("reaction" in e.lower() for e in events)


def test_shield_raises_ac_and_can_flip_hit_to_miss():
    game, hero = _wizard_with_shield()
    hero.in_combat = True
    hero.combat_turn = "reaction"
    refresh_armor_class(hero)
    hero.combat_reaction_pending = {
        "kind": "shield_vs_attack",
        "monster_name": "Orc",
        "monster_key": "goblin",
        "label": "attack",
        "melee": True,
        "natural": 12,
        "attack_total": 12,
        "critical": False,
        "damage_dice": "1d6",
        "damage_bonus": 2,
    }
    monster = MonsterState(name="Orc", hp=20, max_hp=20, armor_class=12, attack_bonus=3, damage="1d6+2")
    hp_before = hero.hp
    result, _ = game.resolve_action(hero, "cast Shield", monster)
    assert result.state_changed
    assert hero.hp == hp_before
    assert not has_pending_reaction(hero)
    assert hero.spell_slots.get(1, 0) == 1
    assert not hero.shield_active
    assert hero.combat_turn == "player"
    joined = " ".join(result.events).lower()
    assert "miss" in joined


def test_decline_reaction_applies_damage():
    game, hero = _wizard_with_shield()
    hero.in_combat = True
    hero.combat_turn = "reaction"
    hero.armor_class = 10
    hero.hp = 20
    hero.max_hp = 20
    hero.combat_reaction_pending = {
        "kind": "shield_vs_attack",
        "monster_name": "Orc",
        "monster_key": "goblin",
        "label": "attack",
        "melee": True,
        "natural": 18,
        "attack_total": 22,
        "critical": False,
        "damage_dice": "1d6",
        "damage_bonus": 2,
    }
    monster = MonsterState(name="Orc", hp=20, max_hp=20, armor_class=12, attack_bonus=3, damage="1d6+2")
    result, _ = game.resolve_action(hero, "decline reaction", monster)
    assert result.state_changed
    assert hero.hp < 20
    assert not has_pending_reaction(hero)
    assert not hero.combat_flags.get(FLAG_REACTION_USED)


def test_fighter_cannot_cast_shield_even_if_list_hacked():
    game = GameEngine(random.Random(1))
    hero = create_hero("fighter")
    hero.known_spells = ["Shield"]
    hero.in_combat = True
    hero.combat_turn = "reaction"
    hero.combat_reaction_pending = {"kind": "shield_vs_attack"}
    monster = MonsterState(hp=10, max_hp=10, armor_class=10)
    before = dict(hero.spell_slots)
    result, _ = game.resolve_action(hero, "cast Shield", monster)
    assert not result.state_changed
    assert hero.spell_slots == before


def test_shield_outside_reaction_window_refuses_slot():
    game, hero = _wizard_with_shield()
    hero.in_combat = True
    hero.combat_turn = "player"
    before = dict(hero.spell_slots)
    result, _ = game.resolve_action(hero, "cast Shield", None)
    assert not result.state_changed
    assert hero.spell_slots == before
    assert "reaction" in result.events[0].lower()


def test_shield_buff_cleared_on_player_turn_start():
    game, hero = _wizard_with_shield()
    hero.shield_active = True
    refresh_armor_class(hero)
    ac_with = hero.armor_class
    from app.engine.class_features import mark_player_turn_start

    mark_player_turn_start(hero)
    assert not hero.shield_active
    assert hero.armor_class < ac_with
