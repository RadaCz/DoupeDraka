import asyncio
import json
import random

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.api import app
from app.db import Session, init_db
from app.db import decode_character_state
from app.engine.models import CharacterState, MonsterState
from app.engine.service import GameEngine
from app.engine.spells import LEVEL_TWO_SPELL_LISTS, MODELED_SPELL_EFFECTS, spell_level
from app.engine.reference import SPELLS


@pytest.fixture
def api_auth():
    client = TestClient(app)
    asyncio.run(init_db())
    client.post(
        "/auth/register",
        json={"username": "restprogression", "password": "password123"},
    )
    token = client.post(
        "/auth/login",
        json={"username": "restprogression", "password": "password123"},
    ).json()["access_token"]
    yield client, {"Authorization": f"Bearer {token}"}

    async def cleanup():
        async with Session() as session:
            for table in ("energy_transactions", "api_keys", "characters", "events", "users"):
                await session.execute(text(f"DELETE FROM {table}"))
            await session.commit()

    asyncio.run(cleanup())


def hero_for(class_name: str, **scores: int) -> CharacterState:
    abilities = {
        "strength": 10,
        "dexterity": 10,
        "constitution": 10,
        "intelligence": 10,
        "wisdom": 10,
        "charisma": 10,
    }
    abilities.update(scores)
    return GameEngine(random.Random(8)).create_character(
        1, "Arin", "human", class_name, abilities
    )


def test_long_rest_restores_hp_and_all_spell_slots_with_facts():
    game = GameEngine(random.Random(8))
    hero = hero_for("wizard")
    hero.hp -= 4
    hero.spell_slots.clear()

    result, _ = game.resolve_action(hero, "rest", None)

    assert hero.hp == hero.max_hp
    assert hero.spell_slots == hero.max_spell_slots == {1: 2}
    assert result.rest_facts == {
        "hp_restored": 4,
        "slots_restored": {1: 2},
        "slots_restored_total": 2,
    }
    assert result.state_changed
    assert not result.costs_adventure_mana


def test_long_rest_restores_slots_even_when_hp_is_full():
    game = GameEngine(random.Random(8))
    hero = hero_for("wizard")
    hero.spell_slots.clear()

    result, _ = game.resolve_action(hero, "rest", None)

    assert hero.hp == hero.max_hp
    assert hero.spell_slots == {1: 2}
    assert result.rest_facts["hp_restored"] == 0
    assert result.rest_facts["slots_restored_total"] == 2


def test_long_rest_at_full_resources_is_a_free_noop():
    result, _ = GameEngine(random.Random(8)).resolve_action(hero_for("wizard"), "rest", None)

    assert not result.state_changed
    assert not result.costs_adventure_mana
    assert not result.rest_facts
    assert "already at full health" in result.events[0]


def test_long_rest_is_refused_during_combat_without_healing_or_restoring_slots():
    game = GameEngine(random.Random(8))
    hero = hero_for("wizard")
    hero.in_combat = True
    hero.hp -= 3
    hero.spell_slots.clear()
    enemy = MonsterState()

    result, returned_enemy = game.resolve_action(hero, "rest", enemy)

    assert returned_enemy is enemy
    assert hero.in_combat
    assert hero.hp == hero.max_hp - 3
    assert hero.spell_slots == {}
    assert not result.state_changed
    assert any("cannot rest" in event for event in result.events)


def test_wizard_level_up_adds_hp_slot_and_two_new_spells():
    game = GameEngine(random.Random(8))
    game.rng.randint = lambda low, high: high
    hero = hero_for("wizard", constitution=14)
    old_max_hp = hero.max_hp
    hero.hp = 1
    hero.xp = 100

    events, facts = game._level_up(hero)

    assert hero.level == 2
    assert hero.max_hp == old_max_hp + 8
    assert hero.hp == 9
    assert hero.max_spell_slots == {1: 3}
    assert hero.spell_slots == {1: 3}
    assert len(facts["new_spells"]) == 2
    assert set(facts["new_spells"]) <= set(hero.known_spells)
    assert facts["new_level"] == 2
    assert "LEVEL UP!" in events[0]


def test_level_up_increases_capacity_without_restoring_spent_slots():
    game = GameEngine(random.Random(8))
    hero = hero_for("wizard")
    hero.spell_slots.clear()
    hero.xp = 100

    game._level_up(hero)

    assert hero.max_spell_slots == {1: 3}
    assert hero.spell_slots == {1: 1}


def test_paladin_level_two_gains_first_slots_and_prepared_spells():
    game = GameEngine(random.Random(8))
    hero = hero_for("paladin", charisma=14)
    assert hero.spell_slots == {}
    hero.xp = 100

    _, facts = game._level_up(hero)

    assert hero.level == 2
    assert hero.spell_slots == hero.max_spell_slots == {1: 2}
    assert hero.prepared_spells
    assert facts["new_spells"] == hero.prepared_spells


def test_level_up_only_advances_one_level_per_resolved_turn():
    game = GameEngine(random.Random(8))
    game.rng.randint = lambda low, high: high
    hero = hero_for("fighter", strength=16)
    enemy = MonsterState(hp=1, max_hp=1, reward_xp=250)

    result, _ = game.resolve_action(hero, "attack", enemy)

    assert hero.level == 2
    assert hero.xp == 150
    assert result.level_up_facts["new_level"] == 2


def test_scorching_ray_resolves_three_attacks_and_spends_one_level_two_slot():
    game = GameEngine(random.Random(8))
    game.rng.randint = lambda low, high: high
    hero = hero_for("wizard")
    hero.level = 3
    hero.known_spells.append("Scorching Ray")
    hero.max_spell_slots = {1: 4, 2: 2}
    hero.spell_slots = {2: 1}
    enemy = MonsterState(hp=1000, max_hp=1000)

    result, returned_enemy = game.resolve_action(hero, "cast Scorching Ray at goblin", enemy)

    attacks = result.spell_facts["effect"]["attacks"]
    assert len(attacks) == 3
    assert all(attack["hit"] for attack in attacks)
    assert enemy.hp < 1000
    assert returned_enemy is enemy
    assert hero.spell_slots == {}
    assert result.spell_facts["slot_level"] == 2


def test_misty_step_escapes_combat_and_consumes_one_slot():
    game = GameEngine(random.Random(8))
    hero = hero_for("wizard")
    hero.level = 3
    hero.in_combat = True
    hero.known_spells.append("Misty Step")
    hero.max_spell_slots = {1: 4, 2: 2}
    hero.spell_slots = {2: 1}

    result, enemy = game.resolve_action(hero, "cast Misty Step", MonsterState())

    assert enemy is None
    assert not hero.in_combat
    assert result.combat_over
    assert result.spell_facts["effect"]["escaped_combat"]
    assert result.spell_facts["slot_consumed"]
    assert hero.spell_slots == {}


def test_misty_step_outside_combat_has_no_effect_and_spends_no_slot():
    game = GameEngine(random.Random(8))
    hero = hero_for("wizard")
    hero.level = 3
    hero.known_spells.append("Misty Step")
    hero.max_spell_slots = {1: 4, 2: 2}
    hero.spell_slots = {2: 1}

    result, _ = game.resolve_action(hero, "cast Misty Step", None)

    assert not result.state_changed
    assert hero.spell_slots == {2: 1}
    assert not result.spell_facts["slot_consumed"]
    assert "no modeled destination" in result.events[0]


def test_invisibility_sets_condition_and_ends_on_attack():
    game = GameEngine(random.Random(8))
    hero = hero_for("wizard")
    hero.level = 3
    hero.known_spells.append("Invisibility")
    hero.max_spell_slots = {1: 4, 2: 2}
    hero.spell_slots = {2: 1}

    result, _ = game.resolve_action(hero, "cast Invisibility", None)
    assert hero.invisible
    assert result.spell_facts["effect"]["condition"] == "invisible"
    assert hero.spell_slots == {}

    game.rng.randint = lambda low, high: high
    game.resolve_action(hero, "attack", MonsterState(hp=1000, max_hp=1000))
    assert not hero.invisible


def test_second_level_spell_is_not_accessible_before_level_three():
    game = GameEngine(random.Random(8))
    hero = hero_for("wizard")
    hero.level = 2
    before_slots = dict(hero.spell_slots)

    result, enemy = game.resolve_action(
        hero, "cast Scorching Ray at goblin", MonsterState(hp=100, max_hp=100)
    )

    assert enemy is not None
    assert not result.state_changed
    assert hero.spell_slots == before_slots
    assert "not learned or prepared" in result.events[0]


def test_modelled_level_two_spells_are_available_to_their_srd_classes():
    catalog_names = {spell["name"]: int(spell["level"]) for spell in SPELLS}
    expected = {"Scorching Ray", "Misty Step", "Invisibility"}
    listed = {spell for spells in LEVEL_TWO_SPELL_LISTS.values() for spell in spells}

    assert expected <= listed
    for spell in expected:
        assert catalog_names[spell] == 2
        assert spell_level(spell) == 2
        assert spell in MODELED_SPELL_EFFECTS


def test_old_character_payload_uses_defaults_for_all_new_fields():
    old_payload = {
        "id": "legacy",
        "owner_id": 1,
        "name": "Arin",
        "race": "human",
        "character_class": "wizard",
        "abilities": {},
    }

    restored = CharacterState(**decode_character_state(json.dumps(old_payload)))

    assert restored.spell_slots == {}
    assert restored.max_spell_slots == {}
    assert restored.known_spells == []
    assert restored.prepared_spells == []
    assert restored.spellcasting_ability == ""
    assert not restored.invisible


def test_spellcaster_rest_is_free_even_when_adventure_mana_is_empty(api_auth):
    from sqlalchemy import select

    from app.db import CharacterRecord, User, decode_state, encode_character_state

    client, auth = api_auth
    created = client.post(
        "/characters",
        json={"name": "Arin", "race": "human", "character_class": "wizard"},
        headers=auth,
    )
    assert created.status_code == 201
    character = created.json()

    async def exhaust_resources():
        async with Session() as session:
            user = await session.scalar(select(User).where(User.username == "restprogression"))
            record = await session.get(CharacterRecord, character["id"])
            assert user is not None and record is not None
            user.energy_tenths = 0
            state = decode_state(record.payload)
            state["hp"] -= 2
            state["spell_slots"] = {}
            record.payload = encode_character_state(state)
            await session.commit()

    asyncio.run(exhaust_resources())

    response = client.post(
        f"/characters/{character['id']}/actions",
        json={"action": "rest"},
        headers=auth,
    )

    assert response.status_code == 200
    body = response.json()
    assert body["energy_tenths"] == 0
    assert body["rest_facts"]["hp_restored"] == 2
    assert body["rest_facts"]["slots_restored_total"] == 2
    assert body["character"]["hp"] == body["character"]["max_hp"]
    assert body["character"]["spell_slots"] == {"1": 2}
