"""Sprint 30 — reaction rules integrity (extends Sprint 29)."""

from __future__ import annotations

import random
import uuid

import pytest
from fastapi.testclient import TestClient

from app.api import app
from app.db import init_db
from app.engine.combat_positioning import MELEE_REACH_FT
from app.engine.combat_reactions import FLAG_ENEMY_REACTION_USED
from app.engine.models import MonsterState
from app.engine.service import GameEngine

client = TestClient(app)


@pytest.fixture
def setup_db():
    import asyncio

    asyncio.run(init_db())
    yield


def _melee(game: GameEngine):
    hero = game.create_character(1, "T", "human", "fighter")
    hero.in_combat = True
    hero.combat_turn = "player"
    hero.combat_distance_ft = MELEE_REACH_FT
    hero.combat_movement_remaining_ft = 30
    hero.combat_flags = {}
    monster = MonsterState(
        name="Goblin", hp=1, max_hp=12, armor_class=10, attack_bonus=2, damage="1d6", template_key="goblin",
    )
    hero.combatant = {"name": "Goblin", "hp": 1, "max_hp": 12, "armor_class": 10}
    return hero, monster


def test_invalid_retreat_does_not_spend_enemy_reaction():
    game = GameEngine(random.Random(30))
    hero, monster = _melee(game)
    hero.combat_movement_remaining_ft = 2
    result, _ = game.resolve_action(hero, "step back 30 ft", monster)
    assert not result.state_changed
    assert not hero.combat_flags.get(FLAG_ENEMY_REACTION_USED)
    assert hero.combat_distance_ft == MELEE_REACH_FT


def test_player_opportunity_attack_can_end_combat():
    game = GameEngine(random.Random(0))
    game.rng.randint = lambda a, b: 20
    hero, monster = _melee(game)
    hero.combat_turn = "enemy"
    before = hero.combat_distance_ft
    from app.engine.combat_positioning import enemy_retreat_from_melee, monster_profile

    enemy_retreat_from_melee(hero, monster_profile("goblin"), target_ft=30)
    assert MELEE_REACH_FT < hero.combat_distance_ft
    events, _ = game._player_opportunity_attack_on_enemy(hero, monster)
    assert monster.hp <= 0 or any("defeated" in e.casefold() for e in events)
    if monster.hp <= 0:
        assert not hero.in_combat


def test_voluntary_movement_contract_constant():
    from app.engine.combat_reactions import VOLUNTARY_MOVEMENT_OA

    assert VOLUNTARY_MOVEMENT_OA is True


def test_idempotent_opportunity_attack_not_reapplied_on_replay_key(setup_db):
    """Same idempotency key via /actions must not re-run OA (re-uses Sprint 15 receipt pattern)."""
    client.post("/auth/register", json={"username": "oaidem", "password": "password123"})
    token = client.post("/auth/login", json={"username": "oaidem", "password": "password123"}).json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    char_id = client.post(
        "/characters",
        json={"name": "Idem", "race": "human", "character_class": "fighter"},
        headers=headers,
    ).json()["id"]
    key = str(uuid.uuid4())
    idem_headers = {**headers, "Idempotency-Key": key}
    from app.db import Session, CharacterRecord, decode_character_state, encode_character_state
    from app.engine.equipment import load_character_state

    import asyncio

    async def seed_melee():
        async with Session() as session:
            record = await session.get(CharacterRecord, char_id)
            hero = load_character_state(decode_character_state(record.payload))
            hero.in_combat = True
            hero.combat_turn = "player"
            hero.combat_distance_ft = MELEE_REACH_FT
            hero.combat_movement_remaining_ft = 30
            hero.combat_flags = {}
            hero.combatant = {"name": "Goblin", "hp": 12, "max_hp": 12, "armor_class": 12}
            from dataclasses import asdict

            record.payload = encode_character_state(asdict(hero))
            await session.commit()

    asyncio.run(seed_melee())
    first = client.post(f"/characters/{char_id}/actions", json={"action": "step back 10 ft"}, headers=idem_headers)
    second = client.post(f"/characters/{char_id}/actions", json={"action": "step back 10 ft"}, headers=idem_headers)
    assert first.status_code == 200 and second.status_code == 200
    assert first.json()["events"] == second.json()["events"]
    flags = first.json().get("character", {}).get("combat_flags", {})
    spent = flags.get(FLAG_ENEMY_REACTION_USED)
    assert spent == second.json().get("character", {}).get("combat_flags", {}).get(FLAG_ENEMY_REACTION_USED)
