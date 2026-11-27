"""Univerzální Sprint (Dash) za Action — docs/COMBAT_RULES_APPROVED.md §1."""

from __future__ import annotations

import random
import uuid

import pytest
from fastapi.testclient import TestClient

from app.api import app
from app.db import init_db
from app.engine.class_features import (
    grant_dash_movement_ft,
    mark_player_turn_start,
    use_cunning_dash,
    use_dash_action,
)
from app.engine.combat_action_economy import spend_action, spend_bonus_action
from app.engine.models import MonsterState
from app.engine.service import GameEngine
from tests.test_spells import create_hero

client = TestClient(app)


@pytest.fixture
def setup_db():
    import asyncio

    asyncio.run(init_db())
    yield


def _combat_hero(game: GameEngine, klass: str, *, level: int = 1):
    hero = game.create_character(1, f"Sprint-{klass}", "human", klass)
    hero.level = level
    hero.speed = 30
    hero.in_combat = True
    hero.combat_turn = "player"
    hero.combat_round = 1
    hero.combat_flags = {
        "action_used": False,
        "bonus_action_used": False,
        "reaction_used": False,
    }
    mark_player_turn_start(hero)
    hero.combat_movement_remaining_ft = 10
    monster = MonsterState(
        name="Goblin scout",
        hp=20,
        max_hp=20,
        armor_class=13,
        attack_bonus=4,
        damage="1d6+2",
        template_key="goblin",
    )
    hero.combatant = {
        "name": monster.name,
        "hp": monster.hp,
        "max_hp": monster.max_hp,
        "armor_class": monster.armor_class,
    }
    return hero, monster


def test_grant_dash_movement_adds_to_remaining_budget():
    game = GameEngine(random.Random(7))
    hero, _ = _combat_hero(game, "fighter")
    before = hero.combat_movement_remaining_ft
    granted = grant_dash_movement_ft(hero)
    assert granted == 30
    assert hero.combat_movement_remaining_ft == before + 30


def test_use_dash_action_spends_action_once():
    game = GameEngine(random.Random(8))
    hero, _ = _combat_hero(game, "cleric", level=1)
    ok, _, facts = use_dash_action(hero)
    assert ok
    assert hero.combat_flags["action_used"]
    assert facts["movement_granted_ft"] == 30
    assert hero.combat_movement_remaining_ft == 40
    assert not use_dash_action(hero)[0]


@pytest.mark.parametrize("klass", ["fighter", "cleric", "wizard"])
def test_universal_sprint_action_adds_speed(klass: str):
    game = GameEngine(random.Random(9))
    hero, monster = _combat_hero(game, klass, level=1 if klass != "wizard" else 1)
    before = hero.combat_movement_remaining_ft
    result, _ = game.resolve_action(hero, "sprint", monster)
    assert result.state_changed
    assert hero.combat_flags["action_used"]
    assert hero.combat_movement_remaining_ft == before + hero.speed


def test_rogue_sprint_uses_action_not_bonus():
    game = GameEngine(random.Random(13))
    hero, monster = _combat_hero(game, "rogue", level=2)
    assert not hero.combat_flags.get("bonus_action_used")
    result, _ = game.resolve_action(hero, "sprint", monster)
    assert result.state_changed
    assert hero.combat_flags["action_used"]
    assert not hero.combat_flags.get("bonus_action_used")


def test_rogue_cunning_then_sprint_action_same_turn():
    game = GameEngine(random.Random(10))
    hero, monster = _combat_hero(game, "rogue", level=2)
    before = hero.combat_movement_remaining_ft
    bonus, _ = game.resolve_action(hero, "dash", monster)
    assert bonus.state_changed
    assert hero.combat_flags["bonus_action_used"]
    assert not hero.combat_flags.get("action_used")
    mid = hero.combat_movement_remaining_ft
    assert mid == before + hero.speed

    action, _ = game.resolve_action(hero, "sprint", monster)
    assert action.state_changed
    assert hero.combat_flags["action_used"]
    assert hero.combat_movement_remaining_ft == mid + hero.speed


def test_rogue_sprint_reject_when_action_spent_no_extra_movement():
    game = GameEngine(random.Random(11))
    hero, monster = _combat_hero(game, "rogue", level=2)
    spend_bonus_action(hero)
    spend_action(hero)
    before = hero.combat_movement_remaining_ft
    result, _ = game.resolve_action(hero, "sprint", monster)
    assert not result.state_changed
    assert hero.combat_movement_remaining_ft == before


def test_sprint_api_idempotent_idempotency_key(setup_db):
    client.post("/auth/register", json={"username": "sprintidem", "password": "password123"})
    token = client.post("/auth/login", json={"username": "sprintidem", "password": "password123"}).json()[
        "access_token"
    ]
    headers = {"Authorization": f"Bearer {token}"}
    char_id = client.post(
        "/characters",
        json={"name": "Sprinter", "race": "human", "character_class": "fighter"},
        headers=headers,
    ).json()["id"]

    from app.db import Session, CharacterRecord, decode_character_state, encode_character_state
    from app.engine.equipment import load_character_state
    import asyncio

    async def seed_combat():
        async with Session() as session:
            record = await session.get(CharacterRecord, char_id)
            hero = load_character_state(decode_character_state(record.payload))
            hero.in_combat = True
            hero.combat_turn = "player"
            hero.combat_movement_remaining_ft = 25
            hero.combat_flags = {"action_used": False, "bonus_action_used": False, "reaction_used": False}
            hero.combatant = {"name": "Goblin", "hp": 12, "max_hp": 12, "armor_class": 12}
            from dataclasses import asdict

            record.payload = encode_character_state(asdict(hero))
            await session.commit()

    asyncio.run(seed_combat())
    key = str(uuid.uuid4())
    idem_headers = {**headers, "Idempotency-Key": key}
    first = client.post(f"/characters/{char_id}/actions", json={"action": "sprint"}, headers=idem_headers)
    second = client.post(f"/characters/{char_id}/actions", json={"action": "sprint"}, headers=idem_headers)
    assert first.status_code == 200 and second.status_code == 200
    move_a = first.json()["character"]["combat_movement_remaining_ft"]
    move_b = second.json()["character"]["combat_movement_remaining_ft"]
    assert move_a == move_b
    assert first.json()["events"] == second.json()["events"]


def test_rogue_bonus_dash_api(setup_db):
    client.post("/auth/register", json={"username": "roguedash", "password": "password123"})
    token = client.post("/auth/login", json={"username": "roguedash", "password": "password123"}).json()[
        "access_token"
    ]
    headers = {"Authorization": f"Bearer {token}"}
    char_id = client.post(
        "/characters",
        json={
            "name": "Rogue",
            "race": "human",
            "character_class": "rogue",
            "abilities": {
                "strength": 10,
                "dexterity": 16,
                "constitution": 12,
                "intelligence": 10,
                "wisdom": 10,
                "charisma": 10,
            },
        },
        headers=headers,
    ).json()["id"]

    from app.db import Session, CharacterRecord, decode_character_state, encode_character_state
    from app.engine.equipment import load_character_state
    import asyncio

    async def seed_combat():
        async with Session() as session:
            record = await session.get(CharacterRecord, char_id)
            hero = load_character_state(decode_character_state(record.payload))
            hero.level = 2
            hero.in_combat = True
            hero.combat_turn = "player"
            hero.combat_movement_remaining_ft = 30
            hero.combat_flags = {"action_used": False, "bonus_action_used": False, "reaction_used": False}
            hero.combatant = {"name": "Goblin", "hp": 12, "max_hp": 12, "armor_class": 12}
            from dataclasses import asdict

            record.payload = encode_character_state(asdict(hero))
            await session.commit()

    asyncio.run(seed_combat())
    body = client.post(f"/characters/{char_id}/actions", json={"action": "dash"}, headers=headers).json()
    assert body["character"]["combat_flags"]["bonus_action_used"] is True
    assert not body["character"]["combat_flags"].get("action_used")


def test_cunning_dash_still_bonus_only_for_rogue():
    game = GameEngine(random.Random(12))
    hero = create_hero("fighter")
    hero.in_combat = True
    hero.combat_movement_remaining_ft = 30
    assert not use_cunning_dash(hero)[0]