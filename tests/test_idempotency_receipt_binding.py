"""Idempotency receipts must bind owner, character, and action fingerprint."""

import asyncio
import uuid

import pytest
from fastapi.testclient import TestClient

from app.api import app
from app.db import init_db

client = TestClient(app)

TABLES = ("action_receipts", "energy_transactions", "api_keys", "events", "characters", "users")


@pytest.fixture
def setup_db():
    asyncio.run(init_db())
    yield
    import sqlalchemy
    from app.db import Session

    async def cleanup():
        async with Session() as session:
            for table in TABLES:
                await session.execute(sqlalchemy.text(f"DELETE FROM {table}"))
            await session.commit()

    asyncio.run(cleanup())


@pytest.fixture
def auth(setup_db):
    client.post("/auth/register", json={"username": "idem_bind", "password": "password123"})
    token = client.post(
        "/auth/login", json={"username": "idem_bind", "password": "password123"}
    ).json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def _character(auth_headers) -> dict:
    response = client.post("/characters/presets/tank", headers=auth_headers)
    assert response.status_code == 201, response.text
    return response.json()


def test_same_key_same_character_same_action_replays(auth):
    character = _character(auth)
    key = uuid.uuid4().hex
    headers = {**auth, "Idempotency-Key": key}
    body = {"action": "look around"}

    first = client.post(f"/characters/{character['id']}/actions", json=body, headers=headers)
    second = client.post(f"/characters/{character['id']}/actions", json=body, headers=headers)
    assert first.status_code == 200
    assert second.status_code == 200
    assert second.json()["events"] == first.json()["events"]


def test_same_key_different_action_rejects(auth):
    character = _character(auth)
    key = uuid.uuid4().hex
    headers = {**auth, "Idempotency-Key": key}

    first = client.post(
        f"/characters/{character['id']}/actions",
        json={"action": "look around"},
        headers=headers,
    )
    assert first.status_code == 200

    conflict = client.post(
        f"/characters/{character['id']}/actions",
        json={"action": "attack the goblin"},
        headers=headers,
    )
    assert conflict.status_code == 409
    assert "different action" in conflict.json()["detail"].lower()


def test_same_key_different_character_same_user_rejects(auth):
    char_a = _character(auth)
    char_b = _character(auth)
    key = uuid.uuid4().hex
    headers = {**auth, "Idempotency-Key": key}
    body = {"action": "look around"}

    assert client.post(f"/characters/{char_a['id']}/actions", json=body, headers=headers).status_code == 200
    conflict = client.post(f"/characters/{char_b['id']}/actions", json=body, headers=headers)
    assert conflict.status_code == 409
    assert "another character" in conflict.json()["detail"].lower()


def test_same_key_other_user_rejects(setup_db):
    client.post("/auth/register", json={"username": "idem_a", "password": "password123"})
    client.post("/auth/register", json={"username": "idem_b", "password": "password123"})
    token_a = client.post("/auth/login", json={"username": "idem_a", "password": "password123"}).json()[
        "access_token"
    ]
    token_b = client.post("/auth/login", json={"username": "idem_b", "password": "password123"}).json()[
        "access_token"
    ]
    auth_a = {"Authorization": f"Bearer {token_a}"}
    auth_b = {"Authorization": f"Bearer {token_b}"}
    character = _character(auth_a)
    key = uuid.uuid4().hex
    body = {"action": "look around"}

    assert client.post(
        f"/characters/{character['id']}/actions",
        json=body,
        headers={**auth_a, "Idempotency-Key": key},
    ).status_code == 200

    conflict = client.post(
        f"/characters/{character['id']}/actions",
        json=body,
        headers={**auth_b, "Idempotency-Key": key},
    )
    assert conflict.status_code == 409
    assert "another account" in conflict.json()["detail"].lower()
