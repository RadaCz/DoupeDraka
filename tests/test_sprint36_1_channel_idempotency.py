"""Sprint 36.1 — Channel Divinity idempotency, legacy payloads, rest gates."""

import uuid
from dataclasses import asdict

import pytest
from fastapi.testclient import TestClient

from app.api import app
from app.db import CharacterRecord, Session, decode_character_state, encode_character_state
from app.engine.class_features import use_preserve_life
from app.engine.equipment import load_character_state
from app.engine.models import CharacterState
from app.engine.service import GameEngine


client = TestClient(app)


@pytest.fixture
def setup_db():
    from app.db import init_db
    import asyncio
    asyncio.run(init_db())


def _cleric_l2() -> tuple[GameEngine, CharacterState]:
    game = GameEngine()
    hero = game.create_character(
        1,
        "CD",
        "dwarf",
        "cleric",
        {
            "strength": 14,
            "dexterity": 10,
            "constitution": 13,
            "intelligence": 8,
            "wisdom": 16,
            "charisma": 12,
        },
    )
    hero.level = 2
    hero.divine_domain = "life"
    hero.channel_divinity_available = True
    hero.hp = 8
    hero.max_hp = 24
    return game, hero


def test_legacy_payload_defaults_channel_divinity_unset():
    hero = CharacterState(
        id="legacy-cd",
        owner_id=1,
        name="Legacy",
        race="human",
        character_class="cleric",
        level=2,
    )
    payload = encode_character_state({k: v for k, v in asdict(hero).items() if k != "channel_divinity_available"})
    restored = CharacterState(**decode_character_state(payload))
    assert restored.channel_divinity_available is False
    from app.engine.class_features import reconcile_level_gated_features
    reconcile_level_gated_features(restored)
    assert restored.channel_divinity_available is True


def test_preserve_life_idempotent_via_action_receipt(setup_db):
    client.post("/auth/register", json={"username": "cdidem", "password": "password123"})
    token = client.post("/auth/login", json={"username": "cdidem", "password": "password123"}).json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    char_id = client.post(
        "/characters",
        json={"name": "Cleric", "race": "dwarf", "character_class": "cleric", "divine_domain": "life"},
        headers=headers,
    ).json()["id"]
    import asyncio

    async def seed():
        async with Session() as session:
            record = await session.get(CharacterRecord, char_id)
            hero = load_character_state(decode_character_state(record.payload))
            hero.level = 2
            hero.divine_domain = "life"
            hero.channel_divinity_available = True
            hero.hp = 6
            hero.max_hp = 24
            record.payload = encode_character_state(asdict(hero))
            await session.commit()

    asyncio.run(seed())
    key = str(uuid.uuid4())
    idem_headers = {**headers, "Idempotency-Key": key}
    first = client.post(f"/characters/{char_id}/actions", json={"action": "preserve life"}, headers=idem_headers)
    second = client.post(f"/characters/{char_id}/actions", json={"action": "preserve life"}, headers=idem_headers)
    assert first.status_code == 200 and second.status_code == 200
    assert first.json()["events"] == second.json()["events"]
    hp1 = first.json().get("character", {}).get("hp")
    hp2 = second.json().get("character", {}).get("hp")
    assert hp1 == hp2
    assert first.json().get("character", {}).get("channel_divinity_available") is False


def test_channel_restored_only_on_short_rest():
    game, hero = _cleric_l2()
    hero.channel_divinity_available = False
    hero.location = "The Whispering Cellar"
    game.resolve_action(hero, "explore", None)
    assert not hero.channel_divinity_available
    game.resolve_action(hero, "short rest", None)
    assert hero.channel_divinity_available


def test_preserve_life_spends_once_per_combat_action():
    game, hero = _cleric_l2()
    ok1, _, _ = use_preserve_life(game, hero)
    assert ok1
    ok2, _, _ = use_preserve_life(game, hero)
    assert not ok2
