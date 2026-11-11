"""Sprint 15 — story-paced XP, vault first descent, idempotency."""

import random
import uuid

import pytest
from fastapi.testclient import TestClient

from app.api import app
from app.engine.chapter_one_progression import (
    FLAG_VAULT_DESCENT_SPAWNED,
    FLAG_VAULT_DESCENT_STORY_XP,
    FLAG_VAULT_ROUTE_XP,
    VAULT_FIRST_DESCENT_STORY_XP,
    VAULT_ROUTE_REVEAL_XP,
)
from app.engine.models import MonsterState
from app.engine.quests import resolve_main_quest_step
from app.engine.service import GameEngine
from app.db import init_db
from tools.simulate_story_main_path import CLASSES, SEEDS, simulate_main_path

client = TestClient(app)


@pytest.fixture
def setup_db():
    import asyncio

    asyncio.run(init_db())
    yield


def _level_up(game, hero):
    return game._level_up(hero)


def test_vault_route_xp_idempotent():
    game = GameEngine(random.Random(1))
    hero = game.create_character(1, "A", "human", "fighter")
    hero.location = "The Shrine of the Forgotten"
    hero.quest_flags = {"bell_quest_complete": True}
    first = resolve_main_quest_step(hero, "talk", "accept_caldus", game._level_up)
    assert first and first.state_changed
    assert hero.quest_flags[FLAG_VAULT_ROUTE_XP]
    xp_after_first = hero.xp
    second = resolve_main_quest_step(hero, "talk", "accept_caldus", game._level_up)
    assert second and not second.state_changed
    assert hero.xp == xp_after_first


def test_vault_first_descent_only_on_vault_entry():
    game = GameEngine(random.Random(99))
    hero = game.create_character(1, "Route", "human", "fighter")
    hero.location = "The Shrine of the Forgotten"
    hero.quest_flags = {"vault_unlocked": True, "vault_hint_given": True}
    _, monster = game._travel(hero, "travel to The Sunken Corridor")
    assert monster is None
    assert not hero.in_combat
    assert not hero.quest_flags.get(FLAG_VAULT_DESCENT_SPAWNED)
    _, monster = game._travel(hero, "travel to The Vault of Echoes")
    assert monster is not None
    assert hero.in_combat
    assert hero.quest_flags.get(FLAG_VAULT_DESCENT_SPAWNED)


def test_vault_first_descent_story_xp_once():
    game = GameEngine(random.Random(7))
    hero = game.create_character(1, "B", "human", "fighter")
    hero.quest_flags = {
        "vault_unlocked": True,
        "vault_first_descent_spawned": True,
        "_vault_descent_cleared_kill": True,
    }
    hero.location = "The Vault of Echoes"
    from app.engine.chapter_one_progression import award_vault_first_descent_story_xp

    events1, _, ok1 = award_vault_first_descent_story_xp(hero, game._level_up)
    assert ok1 and events1
    assert hero.quest_flags[FLAG_VAULT_DESCENT_STORY_XP]
    xp = hero.xp
    events2, _, ok2 = award_vault_first_descent_story_xp(hero, game._level_up)
    assert not ok2 and not events2
    assert hero.xp == xp


@pytest.mark.parametrize("character_class", CLASSES)
@pytest.mark.parametrize("seed", SEEDS)
def test_main_story_reaches_level_3_without_search(character_class, seed):
    row = simulate_main_path(character_class, seed, include_crypt=False)
    assert row["vault_story_awarded"]
    assert row["vault_route_xp"]
    assert row["level"] >= 3, row


def test_main_story_optional_crypt_still_level_3():
    row = simulate_main_path("fighter", 42, include_crypt=True)
    assert row["level"] >= 3


def test_xp_budget_main_path_fighter():
    """30 bell + 50 vault + 35 kobold + 85 descent = 200 XP → level 3."""
    game = GameEngine(random.Random(42))
    hero = game.create_character(1, "Budget", "human", "fighter")
    hero.location = "The Shrine of the Forgotten"
    hero.quest_flags = {"bell_found": True, "bell_acquired": True}
    hero.inventory.append("Shrine bell")
    resolve_main_quest_step(hero, "return", "return_bell", game._level_up)
    assert hero.xp == 30
    hero.quest_flags["bell_quest_complete"] = True
    resolve_main_quest_step(hero, "talk", "accept_caldus", game._level_up)
    assert hero.xp == 80
    hero.location = "The Sunken Corridor"
    hero.quest_flags["vault_unlocked"] = True
    hero.quest_flags["vault_hint_given"] = True
    _, monster = game._travel(hero, "travel to The Vault of Echoes")
    while monster and monster.hp > 0:
        _, monster = game.resolve_action(hero, f"attack {monster.name}", monster)
    assert hero.quest_flags[FLAG_VAULT_DESCENT_STORY_XP]
    assert hero.level >= 3


def test_crypt_triggers_level_up_when_enough_xp():
    game = GameEngine(random.Random(3))
    hero = game.create_character(1, "C", "human", "wizard")
    hero.location = "The Forgotten Crypt"
    from app.engine.quests import try_side_quest_explore

    try_side_quest_explore(hero, "search crypt", game._level_up)
    assert hero.quest_flags["crypt_relic_claimed"]
    assert hero.xp == 10


def test_bell_warden_gate_unchanged():
    game = GameEngine(random.Random(1))
    hero = game.create_character(1, "Low", "human", "fighter")
    hero.level = 2
    hero.quest_flags = {"vault_unlocked": True}
    hero.location = "The Bell Warden's Pit"
    result, _ = game.resolve_action(hero, "attack the Bell Warden", None)
    assert not result.state_changed
    assert any("level 3" in e.casefold() or "reach at least level" in e.casefold() for e in result.events)


def test_stream_idempotency_no_double_state(setup_db):
    client.post("/auth/register", json={"username": "s15prog", "password": "password123"})
    token = client.post(
        "/auth/login", json={"username": "s15prog", "password": "password123"},
    ).json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    created = client.post(
        "/characters",
        headers=headers,
        json={"name": "Idem", "race": "human", "character_class": "fighter"},
    ).json()
    cid = created["id"]
    idem = uuid.uuid4().hex
    action = "travel to The Whispering Cellar"
    client.post(
        f"/characters/{cid}/actions/stream",
        headers={**headers, "Idempotency-Key": idem},
        json={"action": action},
    )
    before = client.get(f"/characters/{cid}", headers=headers).json()
    client.post(
        f"/characters/{cid}/actions/stream",
        headers={**headers, "Idempotency-Key": idem},
        json={"action": action},
    )
    after = client.get(f"/characters/{cid}", headers=headers).json()
    assert after["xp"] == before["xp"]
    assert after["level"] == before["level"]
    assert after["quest_flags"] == before["quest_flags"]
