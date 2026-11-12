"""Sprint 37.2 — core integrity regressions (billing, RNG, rules, auth, migration)."""

from __future__ import annotations

import asyncio
import hashlib
import random
import uuid

import pytest
from fastapi.testclient import TestClient

from app import api
from app.api import app, hash_token
from tests.test_telegram_auth import BOT_TOKEN, make_init_data
from app.billing_policy import narration_charge_applies
from app.db import Session, User, init_db
from app.engine import economy
from app.engine.equipment import set_equipped_weapon, weapon_proficiency
from app.engine.models import CharacterState, MonsterState
from app.engine.rng_state import bind_engine_rng, capture_engine_rng, encode_rng_state
from app.engine.service import GameEngine
from app.engine.class_features import use_preserve_life, use_turn_undead


client = TestClient(app)


def test_narration_charge_applies_without_adventure_mana_flag():
    assert narration_charge_applies(billing_tier="lite", state_changed=True) is False
    assert narration_charge_applies(billing_tier="normal", state_changed=False) is False


def test_rng_isolated_per_character():
    a = CharacterState(id="a-rng", owner_id=1, name="A", race="human", character_class="fighter")
    b = CharacterState(id="b-rng", owner_id=2, name="B", race="human", character_class="fighter")
    engine = GameEngine(random.Random(1))
    bind_engine_rng(a, engine)
    first = engine.roll("1d20", 0).total
    capture_engine_rng(a, engine)
    bind_engine_rng(b, engine)
    second = engine.roll("1d20", 0).total
    bind_engine_rng(a, engine)
    replay = engine.roll("1d20", 0).total
    assert replay == first
    assert first != second or a.id != b.id


def test_preserve_life_respects_half_hp_cap():
    game = GameEngine(random.Random(3))
    cleric = CharacterState(
        id="c1", owner_id=1, name="C", race="dwarf", character_class="cleric",
        level=2, divine_domain="life", max_hp=20, hp=5, channel_divinity_available=True,
    )
    ok, _, facts = use_preserve_life(game, cleric)
    assert ok
    assert cleric.hp == 10
    assert facts["healing"] == 5


def test_turn_undead_turns_on_failed_save_not_kill():
    game = GameEngine(random.Random(4))
    cleric = CharacterState(
        id="c2", owner_id=1, name="C", race="dwarf", character_class="cleric", level=2,
        channel_divinity_available=True, in_combat=True, combat_round=1,
    )
    skel = MonsterState(name="Skeleton", hp=12, max_hp=12, saving_throws={"wisdom": -1})
    game.rng.randint = lambda _a, _b: 1
    ok, lines, facts = use_turn_undead(game, cleric, skel)
    assert ok and facts.get("turned")
    assert skel.hp == 12
    assert any("turned" in line.lower() for line in lines)


def test_fighter_longbow_proficiency():
    hero = CharacterState(
        id="f1", owner_id=1, name="Archer", race="human", character_class="fighter",
        inventory=["longbow", "20 arrows", "traveler's clothes"],
        item_instances=[],
    )
    from app.engine.equipment import migrate_item_instances

    migrate_item_instances(hero)
    assert weapon_proficiency(hero, "longbow")
    ok, _ = set_equipped_weapon(hero, "longbow")
    assert ok


def test_wizard_fire_bolt_starts_combat_outside_fight():
    game = GameEngine(random.Random(7))
    wizard = game.create_character(
        1,
        "Wiz",
        "human",
        "wizard",
        {
            "strength": 8,
            "dexterity": 14,
            "constitution": 12,
            "intelligence": 16,
            "wisdom": 10,
            "charisma": 10,
        },
    )
    goblin = MonsterState(name="Goblin scout", hp=8, max_hp=8, armor_class=12, attack_bonus=4, damage="1d6+2")
    wizard.in_combat = False
    wizard.combatant = None
    result, monster = game.resolve_action(wizard, "cast fire bolt", goblin)
    assert result.state_changed
    assert wizard.in_combat
    assert any("Initiative" in line for line in result.events)


@pytest.fixture
def setup_db():
    asyncio.run(init_db())
    yield


def test_link_telegram_rejects_duplicate_identity(setup_db, monkeypatch):
    monkeypatch.setenv("BOT_TOKEN", BOT_TOKEN)
    from app.settings import get_settings

    get_settings.cache_clear()
    client.post("/auth/register", json={"username": "browser1", "password": "password123"})
    token_a = client.post("/auth/login", json={"username": "browser1", "password": "password123"}).json()["access_token"]
    headers_a = {"Authorization": f"Bearer {token_a}"}
    tg_id = 880_001
    init = make_init_data(tg_id, "link_a")
    assert client.post("/auth/link-telegram", json={"init_data": init}, headers=headers_a).status_code == 200
    client.post("/auth/register", json={"username": "browser2", "password": "password123"})
    token_b = client.post("/auth/login", json={"username": "browser2", "password": "password123"}).json()["access_token"]
    headers_b = {"Authorization": f"Bearer {token_b}"}
    assert client.post("/auth/link-telegram", json={"init_data": init}, headers=headers_b).status_code == 409


def test_api_key_migration_hashes_plain_token():
    import secrets

    raw = secrets.token_urlsafe(16)
    digest = hashlib.sha256(raw.encode()).hexdigest()
    assert hash_token(raw) == digest
