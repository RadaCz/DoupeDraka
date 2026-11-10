"""Sprint 2 — persistent NPC talk, exploration discoveries, quest idempotency."""

import asyncio
import random
import uuid
from dataclasses import asdict

import pytest
from fastapi.testclient import TestClient

from app.api import app
from app.db import Session, decode_character_state, encode_character_state, init_db
from app.engine.discoveries import clue_flag, location_slug, track_flag
from app.engine.models import RollResult
from app.engine.service import GameEngine


@pytest.fixture
def game():
    return GameEngine(random.Random(7))


def _hero(game: GameEngine, location: str = "The Shrine of the Forgotten"):
    hero = game.create_character(1, "Walker", "human", "fighter")
    hero.location = location
    hero.quest_flags = {}
    return hero


def test_caldus_talk_does_not_grant_quest_without_quest_intent(game):
    hero = _hero(game)
    result, _ = game.resolve_action(hero, "talk to Caldus", None)
    assert not hero.quest_flags.get("bell_quest_accepted")
    assert not result.state_changed
    assert "bell" in result.events[0].casefold()


def test_caldus_repeat_talk_after_accept_is_idempotent(game):
    hero = _hero(game)
    hero.quest_flags["bell_quest_accepted"] = True
    first, _ = game.resolve_action(hero, "talk to Caldus", None)
    second, _ = game.resolve_action(hero, "talk to Caldus", None)
    assert not first.state_changed
    assert not second.state_changed
    assert hero.quest_flags.get("bell_quest_accepted")


def test_nib_talk_blocked_without_quest_and_responds_to_rumor(game):
    hero = _hero(game, "The Goblin Market")
    blocked, _ = game.resolve_action(hero, "talk to Nib", None)
    assert not blocked.state_changed
    hero.quest_flags["bell_market_rumor"] = True
    again, _ = game.resolve_action(hero, "talk to Nib", None)
    assert not again.state_changed
    assert "caldus" in again.events[0].casefold()


def test_mara_talk_sets_persistent_warning_once(game):
    hero = _hero(game, "The Sunken Corridor")
    first, _ = game.resolve_action(hero, "talk to Mara", None)
    assert first.state_changed
    assert hero.quest_flags.get("mara_warned")
    second, _ = game.resolve_action(hero, "talk to Mara", None)
    assert not second.state_changed


def test_explore_track_discovery_persists_and_repeats_without_reward(game):
    hero = _hero(game, "The Whispering Cellar")
    game.roll = lambda dice, modifier=0, critical=False: RollResult(dice, (2,), modifier, 2 + modifier)
    first, _ = game.resolve_action(hero, "look around", None)
    slug = location_slug(hero.location)
    assert hero.quest_flags.get(track_flag(slug))
    assert first.state_changed
    assert any("new discovery" in event.casefold() for event in first.events)
    second, _ = game.resolve_action(hero, "look around", None)
    assert not second.state_changed
    assert any("already logged" in event.casefold() for event in second.events)


def test_inspect_offering_bowl_one_time(game):
    hero = _hero(game)
    first, _ = game.resolve_action(hero, "inspect the offering bowl", None)
    assert first.state_changed
    assert hero.quest_flags.get(clue_flag(location_slug(hero.location)))
    second, _ = game.resolve_action(hero, "inspect the offering bowl", None)
    assert not second.state_changed


def test_nib_bell_requires_caldus_quest_not_name_bypass(game):
    hero = _hero(game, "The Goblin Market")
    hero.quest_flags["bell_market_rumor"] = True
    denied, _ = game.resolve_action(hero, "ask Nib about the shrine bell", None)
    assert not denied.state_changed
    assert not hero.quest_flags.get("bell_acquired")


def test_quest_flags_survive_encode_cycle(game):
    hero = _hero(game, "The Sunken Corridor")
    game.resolve_action(hero, "talk to Mara", None)
    payload = encode_character_state(asdict(hero))
    restored = decode_character_state(payload)
    assert restored["quest_flags"].get("mara_warned")


client = TestClient(app)


@pytest.fixture
def api_db():
    asyncio.run(init_db())
    yield
    async def cleanup():
        async with Session() as session:
            from sqlalchemy import text
            for table in ("action_receipts", "energy_transactions", "api_keys", "events", "characters", "users"):
                await session.execute(text(f"DELETE FROM {table}"))
            await session.commit()
    asyncio.run(cleanup())


def test_idempotent_action_does_not_duplicate_discovery(api_db):
    client.post("/auth/register", json={"username": "consq", "password": "password123"})
    token = client.post("/auth/login", json={"username": "consq", "password": "password123"}).json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    char = client.post(
        "/characters",
        headers={**headers, "Content-Type": "application/json"},
        json={"name": "Persist", "race": "human", "character_class": "fighter"},
    ).json()
    cid = char["id"]
    key = uuid.uuid4().hex
    action_headers = {**headers, "Idempotency-Key": key}
    first = client.post(f"/characters/{cid}/actions", json={"action": "talk to Caldus"}, headers=action_headers)
    second = client.post(f"/characters/{cid}/actions", json={"action": "talk to Caldus"}, headers=action_headers)
    assert first.status_code == 200
    assert second.status_code == 200
    body = client.get(f"/characters/{cid}", headers=headers).json()
    assert not body["quest_flags"].get("bell_quest_accepted")


def test_offline_narration_still_lists_engine_events(game):
    from app.ai.offline import narrate_offline
    from app.ai.base import NarrationContext

    hero = _hero(game, "The Sunken Corridor")
    result, _ = game.resolve_action(hero, "talk to Mara", None)
    ctx = NarrationContext(
        action="talk to Mara",
        events=tuple(result.events),
        location=hero.location,
        memories=(),
        scene_kind="talk",
        language="en",
    )
    prose = narrate_offline(ctx)
    assert prose
    assert hero.quest_flags.get("mara_warned")
