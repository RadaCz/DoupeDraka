"""Sprint 37.3 — API-level billing, RNG persistence, and billing-policy regressions."""

from __future__ import annotations

import asyncio
import uuid
from concurrent.futures import ThreadPoolExecutor, wait

import pytest
from sqlalchemy import select

from app.db import CharacterRecord, Session, User, decode_character_state
from app.engine import economy
from tests.test_api_systems import _mock_online_gateway
from tests.test_concurrency import auth, client, setup_db  # noqa: F401

pytestmark = pytest.mark.integration


def _character(auth_headers) -> dict:
    from tests.test_concurrency import _character

    return _character(auth_headers)


def _paid_provider_stack(monkeypatch):
    _mock_online_gateway(monkeypatch)
    monkeypatch.setattr("app.ai.registry.has_external_paid_narration_provider", lambda _s: True)


def test_lite_never_requires_paid_provider(auth, monkeypatch):
    _paid_provider_stack(monkeypatch)
    assert client.post("/economy/tier", json={"tier": "lite"}, headers=auth).status_code == 200
    character = _character(auth)
    before = asyncio.run(_user_energy())
    response = client.post(
        f"/characters/{character['id']}/actions",
        json={"action": "attack the goblin"},
        headers={**auth, "Idempotency-Key": uuid.uuid4().hex},
    )
    assert response.status_code == 200, response.text
    assert asyncio.run(_user_energy()) == before


def test_normal_zero_credits_rejects_before_rng_consume(auth, monkeypatch):
    _paid_provider_stack(monkeypatch)
    assert client.post("/economy/tier", json={"tier": "normal"}, headers=auth).status_code == 200
    character = _character(auth)
    asyncio.run(_set_energy(0))

    async def read_rng():
        async with Session() as session:
            row = await session.get(CharacterRecord, character["id"])
            payload = decode_character_state(row.payload)
            return payload.get("rng_state")

    rng_before = asyncio.run(read_rng())
    response = client.post(
        f"/characters/{character['id']}/actions",
        json={"action": "attack the goblin"},
        headers={**auth, "Idempotency-Key": uuid.uuid4().hex},
    )
    assert response.status_code == 402
    assert asyncio.run(read_rng()) == rng_before


def test_no_op_action_never_debits_normal(auth, monkeypatch):
    _paid_provider_stack(monkeypatch)
    assert client.post("/economy/tier", json={"tier": "normal"}, headers=auth).status_code == 200
    character = _character(auth)
    before = asyncio.run(_user_energy())
    response = client.post(
        f"/characters/{character['id']}/actions",
        json={"action": "flibbertigibbet nonsense xyzzy"},
        headers={**auth, "Idempotency-Key": uuid.uuid4().hex},
    )
    assert response.status_code == 200
    assert not response.json()["events"] or response.json().get("character")
    assert asyncio.run(_user_energy()) == before


def test_idempotent_replay_does_not_advance_rng_or_debit_twice(auth, monkeypatch):
    _paid_provider_stack(monkeypatch)
    assert client.post("/economy/tier", json={"tier": "normal"}, headers=auth).status_code == 200
    asyncio.run(_set_energy(economy.turn_cost("normal") * 3))
    character = _character(auth)
    key = uuid.uuid4().hex
    headers = {**auth, "Idempotency-Key": key}

    async def rng_snapshot():
        async with Session() as session:
            row = await session.get(CharacterRecord, character["id"])
            return decode_character_state(row.payload).get("rng_state")

    first = client.post(
        f"/characters/{character['id']}/actions",
        json={"action": "attack the goblin"},
        headers=headers,
    )
    assert first.status_code == 200
    after_first_rng = asyncio.run(rng_snapshot())
    energy_after_first = asyncio.run(_user_energy())

    replay = client.post(
        f"/characters/{character['id']}/actions",
        json={"action": "attack the goblin"},
        headers=headers,
    )
    assert replay.status_code == 200
    assert replay.json()["events"] == first.json()["events"]
    assert asyncio.run(rng_snapshot()) == after_first_rng
    assert asyncio.run(_user_energy()) == energy_after_first


def test_two_characters_isolated_rng_states(auth, monkeypatch):
    """Committed turns must persist independent rng_state blobs per hero."""
    character_a = _character(auth)
    character_b = _character(auth)
    key_a = uuid.uuid4().hex
    key_b = uuid.uuid4().hex

    client.post(
        f"/characters/{character_a['id']}/actions",
        json={"action": "attack the goblin"},
        headers={**auth, "Idempotency-Key": key_a},
    )
    client.post(
        f"/characters/{character_b['id']}/actions",
        json={"action": "attack the goblin"},
        headers={**auth, "Idempotency-Key": key_b},
    )

    rng_a, rng_b = asyncio.run(_rng_pair(character_a["id"], character_b["id"]))
    assert rng_a and rng_b
    assert rng_a != rng_b


async def _rng_pair(a_id: str, b_id: str):
    async with Session() as session:
        ra = await session.get(CharacterRecord, a_id)
        rb = await session.get(CharacterRecord, b_id)
        sa = decode_character_state(ra.payload).get("rng_state")
        sb = decode_character_state(rb.payload).get("rng_state")
        return sa, sb


async def _user_energy() -> int:
    async with Session() as session:
        user = await session.scalar(select(User).where(User.username == "atomic"))
        return user.energy_tenths


async def _set_energy(tenths: int) -> None:
    async with Session() as session:
        user = await session.scalar(select(User).where(User.username == "atomic"))
        user.energy_tenths = tenths
        await session.commit()


def test_concurrent_different_idempotency_keys_both_commit_once(auth):
    character = _character(auth)
    path = f"/characters/{character['id']}/actions"
    body = {"action": "look around"}

    def post():
        return client.post(
            path,
            json=body,
            headers={**auth, "Idempotency-Key": uuid.uuid4().hex},
        )

    with ThreadPoolExecutor(max_workers=2) as pool:
        futures = [pool.submit(post), pool.submit(post)]
        wait(futures)
        assert all(f.result().status_code == 200 for f in futures)

    async def version():
        async with Session() as session:
            row = await session.get(CharacterRecord, character["id"])
            return row.version

    assert asyncio.run(version()) == 2
