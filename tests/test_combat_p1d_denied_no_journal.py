"""Combat P1d (audit N5): rejected combat actions must not journal or bump turn_count."""

from __future__ import annotations

import asyncio
from dataclasses import asdict

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select

from app.api import app
from app.db import CharacterRecord, EventRecord, Session, decode_character_state, encode_character_state, init_db
from app.engine.combat_action_economy import spend_action
from app.engine.combat_positioning import MELEE_REACH_FT
from app.engine.equipment import load_character_state
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


def _auth_headers(username: str = "p1d"):
    client.post("/auth/register", json={"username": username, "password": "password123"})
    token = client.post("/auth/login", json={"username": username, "password": "password123"}).json()[
        "access_token"
    ]
    return {"Authorization": f"Bearer {token}"}


def _new_character(headers: dict) -> str:
    return client.post(
        "/characters",
        json={"name": "P1d", "race": "human", "character_class": "fighter"},
        headers=headers,
    ).json()["id"]


async def _count_events(character_id: str) -> int:
    async with Session() as session:
        return int(
            await session.scalar(
                select(func.count()).select_from(EventRecord).where(EventRecord.character_id == character_id)
            )
            or 0
        )


async def _turn_count(character_id: str) -> int:
    async with Session() as session:
        record = await session.get(CharacterRecord, character_id)
        assert record is not None
        hero = load_character_state(decode_character_state(record.payload))
        return hero.turn_count


def _seed_hero(character_id: str, mutate) -> None:
    async def _run():
        async with Session() as session:
            record = await session.get(CharacterRecord, character_id)
            hero = load_character_state(decode_character_state(record.payload))
            mutate(hero)
            record.payload = encode_character_state(asdict(hero))
            await session.commit()

    asyncio.run(_run())


def _combat_seed(hero, *, distance_ft: int = MELEE_REACH_FT, combat_turn: str = "player") -> None:
    hero.in_combat = True
    hero.combat_turn = combat_turn
    hero.combat_round = 1
    hero.combat_distance_ft = distance_ft
    hero.combat_movement_remaining_ft = 30
    hero.combat_flags = {}
    hero.combatant = {"name": "Goblin", "hp": 30, "max_hp": 30, "armor_class": 12}


def _assert_denial_persisted(
    headers: dict,
    character_id: str,
    action: str,
    *,
    events_before: int,
    turns_before: int,
) -> None:
    response = client.post(f"/characters/{character_id}/actions", json={"action": action}, headers=headers)
    assert response.status_code == 200
    body = response.json()
    assert body.get("events"), "API must still return denial lines"
    assert asyncio.run(_count_events(character_id)) == events_before
    assert asyncio.run(_turn_count(character_id)) == turns_before
    assert response.json()["character"].get("turn_count", asyncio.run(_turn_count(character_id))) == turns_before


@pytest.mark.integration
def test_denied_combat_actions_do_not_journal_or_increment_turn_count(api_db):
    headers = _auth_headers()
    character_id = _new_character(headers)

    assert asyncio.run(_count_events(character_id)) == 0
    assert asyncio.run(_turn_count(character_id)) == 0

    # Out of melee range
    _seed_hero(
        character_id,
        lambda h: _combat_seed(h, distance_ft=120),
    )
    events = asyncio.run(_count_events(character_id))
    turns = asyncio.run(_turn_count(character_id))
    _assert_denial_persisted(headers, character_id, "attack goblin", events_before=events, turns_before=turns)

    # Not player's turn
    _seed_hero(
        character_id,
        lambda h: _combat_seed(h, combat_turn="enemy"),
    )
    events = asyncio.run(_count_events(character_id))
    turns = asyncio.run(_turn_count(character_id))
    _assert_denial_persisted(headers, character_id, "attack goblin", events_before=events, turns_before=turns)

    # Spell cast denied (no level-1 slot)
    wizard_id = client.post(
        "/characters",
        json={"name": "Caster", "race": "human", "character_class": "wizard"},
        headers=headers,
    ).json()["id"]

    def wizard_no_slots(hero):
        _combat_seed(hero)
        hero.spell_slots = {1: 0}
        hero.prepared_spells = ["Magic Missile"]
        hero.known_spells = ["Magic Missile"]

    _seed_hero(wizard_id, wizard_no_slots)
    events = asyncio.run(_count_events(wizard_id))
    turns = asyncio.run(_turn_count(wizard_id))
    _assert_denial_persisted(
        headers, wizard_id, "cast Magic Missile", events_before=events, turns_before=turns
    )

    # Offensive spell beyond SRD range (P0a) — denial must not journal (P1d)
    wizard_range_id = client.post(
        "/characters",
        json={"name": "Range", "race": "human", "character_class": "wizard"},
        headers=headers,
    ).json()["id"]

    def wizard_out_of_spell_range(hero):
        _combat_seed(hero, distance_ft=121)
        hero.spell_slots = {1: 2}
        hero.known_spells = ["Fire Bolt"]
        hero.prepared_spells = ["Fire Bolt"]

    _seed_hero(wizard_range_id, wizard_out_of_spell_range)
    events = asyncio.run(_count_events(wizard_range_id))
    turns = asyncio.run(_turn_count(wizard_range_id))
    _assert_denial_persisted(
        headers, wizard_range_id, "cast Fire Bolt", events_before=events, turns_before=turns
    )

    # Flee denied when action already spent
    def flee_setup(hero):
        _combat_seed(hero)
        spend_action(hero)

    _seed_hero(character_id, flee_setup)
    events = asyncio.run(_count_events(character_id))
    turns = asyncio.run(_turn_count(character_id))
    _assert_denial_persisted(headers, character_id, "flee", events_before=events, turns_before=turns)

    def sprint_setup(hero):
        _combat_seed(hero)
        spend_action(hero)

    _seed_hero(character_id, sprint_setup)
    events = asyncio.run(_count_events(character_id))
    turns = asyncio.run(_turn_count(character_id))
    _assert_denial_persisted(headers, character_id, "sprint", events_before=events, turns_before=turns)

    _seed_hero(
        character_id,
        lambda h: (
            setattr(h, "in_combat", False),
            setattr(h, "combat_turn", "player"),
        ),
    )
    events = asyncio.run(_count_events(character_id))
    turns = asyncio.run(_turn_count(character_id))
    _assert_denial_persisted(headers, character_id, "sprint", events_before=events, turns_before=turns)


@pytest.mark.integration
def test_non_combat_no_state_change_still_journals(api_db):
    """Narrative / unknown commands are not combat rejections — they journal even without state_changed."""
    headers = _auth_headers("p1d-narr")
    character_id = _new_character(headers)
    response = client.post(
        f"/characters/{character_id}/actions",
        json={"action": "listen for movement"},
        headers=headers,
    )
    assert response.status_code == 200
    body = response.json()
    joined = " ".join(body.get("events", [])).casefold()
    assert "does not understand" in joined or "try travel" in joined
    assert asyncio.run(_count_events(character_id)) == 1
    assert asyncio.run(_turn_count(character_id)) == 1


@pytest.mark.integration
def test_successful_combat_attack_still_journals_and_increments_turn_count(api_db):
    headers = _auth_headers("p1d-ok")
    character_id = _new_character(headers)
    _seed_hero(character_id, lambda h: _combat_seed(h))
    before_events = asyncio.run(_count_events(character_id))
    before_turns = asyncio.run(_turn_count(character_id))
    response = client.post(
        f"/characters/{character_id}/actions",
        json={"action": "attack goblin"},
        headers=headers,
    )
    assert response.status_code == 200
    assert asyncio.run(_count_events(character_id)) == before_events + 1
    assert asyncio.run(_turn_count(character_id)) == before_turns + 1
    assert any("attack" in line.casefold() for line in response.json().get("events", []))