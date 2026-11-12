"""Sprint 34 — inventory, equipment, and consumables gameplay."""

from __future__ import annotations

import json
import random

from app.db import decode_character_state
from app.engine.combat_action_economy import FLAG_ACTION_USED
from app.engine.equipment import (
    compute_armor_class,
    default_item_instances,
    refresh_armor_class,
    set_equipped_armor,
    sync_item_instances,
    unequip_shield,
)
from app.engine.intent import DECLINE_REACTION, USE_ITEM, parse_action_intent
from app.engine.models import MonsterState
from app.engine.reactive_spells import has_pending_reaction
from app.engine.service import GameEngine
from app.engine.spells import MODELED_SPELL_EFFECTS


def test_potion_heals_2d4_plus_2_srd():
    game = GameEngine(random.Random(3))
    game.rng.randint = lambda a, b: 3
    hero = game.create_character(1, "P", "human", "cleric")
    hero.inventory.append("healing potion")
    sync_item_instances(hero)
    hero.hp = 5
    hero.max_hp = 20
    result, _ = game.resolve_action(hero, "use potion", None)
    assert result.state_changed
    assert hero.hp == 5 + 3 + 3 + 2


def test_potion_in_combat_spends_action():
    game = GameEngine(random.Random(1))
    hero = game.create_character(1, "F", "human", "fighter")
    hero.inventory.append("healing potion")
    sync_item_instances(hero)
    hero.in_combat = True
    hero.combat_turn = "player"
    hero.hp = 5
    monster = MonsterState(hp=10, max_hp=10, armor_class=12)
    result, _ = game.resolve_action(hero, "use potion", monster)
    assert result.state_changed
    assert hero.combat_flags.get(FLAG_ACTION_USED)


def test_potion_at_full_hp_denied():
    game = GameEngine()
    hero = game.create_character(1, "F", "human", "fighter")
    hero.inventory.append("healing potion")
    before = list(hero.inventory)
    result, _ = game.resolve_action(hero, "use potion", None)
    assert not result.state_changed
    assert hero.inventory == before


def test_second_potion_use_without_stock_fails():
    game = GameEngine(random.Random(1))
    hero = game.create_character(1, "F", "human", "fighter")
    hero.inventory.append("healing potion")
    sync_item_instances(hero)
    hero.hp = 1
    first, _ = game.resolve_action(hero, "use potion", None)
    assert first.state_changed
    second, _ = game.resolve_action(hero, "use potion", None)
    assert not second.state_changed


def test_unequip_keeps_item_in_inventory():
    game = GameEngine()
    hero = game.create_character(1, "Tank", "human", "fighter")
    assert "shield" in [i.casefold() for i in hero.inventory]
    result, _ = game.resolve_action(hero, "unequip shield", None)
    assert result.state_changed
    assert any("shield" in i.casefold() for i in hero.inventory)


def test_sync_preserves_instance_id_for_remaining_items():
    hero = GameEngine().create_character(1, "X", "human", "fighter")
    hero.inventory.append("healing potion")
    sync_item_instances(hero)
    weapon_id = next(e["instance_id"] for e in hero.item_instances if "shortsword" in e["name"].casefold())
    hero.inventory.remove("healing potion")
    sync_item_instances(hero)
    new_weapon_id = next(e["instance_id"] for e in hero.item_instances if "shortsword" in e["name"].casefold())
    assert new_weapon_id == weapon_id


def test_equip_denied_during_pending_reaction():
    game = GameEngine()
    hero = game.create_character(1, "W", "human", "wizard")
    hero.in_combat = True
    hero.combat_reaction_pending = {"kind": "shield_vs_attack"}
    hero.combat_turn = "reaction"
    before_ac = hero.armor_class
    result, _ = game.resolve_action(hero, "equip dagger", MonsterState(hp=10, max_hp=10))
    assert not result.state_changed
    assert hero.armor_class == before_ac


def test_potion_denied_during_pending_reaction():
    game = GameEngine(random.Random(1))
    hero = game.create_character(1, "W", "human", "wizard")
    hero.inventory.append("healing potion")
    hero.in_combat = True
    hero.combat_turn = "reaction"
    hero.combat_reaction_pending = {"kind": "shield_vs_attack"}
    hero.hp = 5
    before = list(hero.inventory)
    result, _ = game.resolve_action(hero, "use potion", MonsterState(hp=10, max_hp=10))
    assert parse_action_intent("use potion").kind == USE_ITEM
    assert not result.state_changed
    assert hero.inventory == before


def test_mage_armor_and_worn_armor_use_armor_not_mage():
    game = GameEngine()
    hero = game.create_character(1, "W", "human", "wizard", None)
    hero.abilities["dexterity"] = 14
    hero.mage_armor_active = True
    hero.item_instances = [{"name": "chain mail", "equipped_slot": "armor", "instance_id": "a1", "definition_id": "chain_mail", "item_kind": "armor"}]
    ac = compute_armor_class(hero)
    assert ac == 12
    assert ac != 13 + 2


def test_pending_reaction_payload_survives_json_roundtrip():
    game = GameEngine()
    hero = game.create_character(1, "W", "human", "wizard")
    hero.combat_reaction_pending = {
        "kind": "shield_vs_attack",
        "natural": 15,
        "attack_total": 18,
    }
    hero.combat_turn = "reaction"
    payload = json.dumps(hero, default=lambda o: o.__dict__)
    from app.engine.equipment import load_character_state

    restored = load_character_state(json.loads(payload))
    assert has_pending_reaction(restored)
    assert restored.combat_reaction_pending["attack_total"] == 18


def test_decline_reaction_intent_parsed():
    assert parse_action_intent("decline reaction").kind == DECLINE_REACTION


def test_shield_still_not_in_combat_spell_picker_path():
    game = GameEngine()
    hero = game.create_character(1, "W", "human", "wizard")
    hero.in_combat = True
    hero.combat_turn = "player"
    before = dict(hero.spell_slots)
    result, _ = game.resolve_action(hero, "cast Shield", None)
    assert not result.state_changed
    assert hero.spell_slots == before
    assert "Shield" in MODELED_SPELL_EFFECTS
