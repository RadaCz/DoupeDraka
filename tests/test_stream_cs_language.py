"""Czech narration stream must not leak unvalidated English SSE deltas."""

import asyncio
import json
import re
import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.api import app
from app.db import ActionReceipt, EventRecord, Session, decode_state, init_db
from tests.test_concurrency import _character

client = TestClient(app)


@pytest.fixture
def setup_db():
    asyncio.run(init_db())
    yield
    async def cleanup():
        async with Session() as session:
            from sqlalchemy import text
            for table in ("action_receipts", "energy_transactions", "api_keys", "events", "characters", "users"):
                await session.execute(text(f"DELETE FROM {table}"))
            await session.commit()
    asyncio.run(cleanup())


@pytest.fixture
def auth(setup_db):
    client.post("/auth/register", json={"username": "csstream", "password": "password123"})
    token = client.post(
        "/auth/login", json={"username": "csstream", "password": "password123"}
    ).json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def _cs_character(auth):
    response = client.post(
        "/characters",
        headers={**auth, "Content-Type": "application/json"},
        json={"name": "Cs Stream", "race": "human", "character_class": "fighter", "language": "cs"},
    )
    assert response.status_code == 201
    return response.json()


def test_en_stream_still_emits_deltas(auth, monkeypatch, setup_db):
    character = _character(auth)
    key = uuid.uuid4().hex

    class _Gateway:
        providers = ("mock",)
        has_online_providers = True

    for target in ("app.api.narration_gateway_for", "app.ai.registry.narration_gateway_for"):
        monkeypatch.setattr(target, lambda _settings: _Gateway())
    monkeypatch.setattr("app.ai.registry.has_external_paid_narration_provider", lambda _settings: True)
    assert client.post("/economy/tier", json={"tier": "normal"}, headers=auth).status_code == 200

    async def chunks(_self, context, **_kwargs):
        yield "The "
        yield "stone shifts."

    monkeypatch.setattr("app.narrator.Narrator.stream", chunks)
    headers = {**auth, "Idempotency-Key": key}
    path = f"/characters/{character['id']}/actions/stream"
    body = client.post(path, json={"action": "look around"}, headers=headers).text

    assert "event: delta" in body
    assert '"text":"The "' in body
    complete = json.loads(re.search(r"event: complete\ndata: (.*)", body).group(1))
    assert complete["narration"] == "The stone shifts."


def test_cs_stream_never_emits_english_deltas(auth, monkeypatch, setup_db):
    character = _cs_character(auth)
    key = uuid.uuid4().hex

    class _Gateway:
        providers = ("mock",)
        has_online_providers = True

    for target in ("app.api.narration_gateway_for", "app.ai.registry.narration_gateway_for"):
        monkeypatch.setattr(target, lambda _settings: _Gateway())
    monkeypatch.setattr("app.ai.registry.has_external_paid_narration_provider", lambda _settings: True)
    assert client.post("/economy/tier", json={"tier": "normal"}, headers=auth).status_code == 200

    async def english_chunks(_self, context, **_kwargs):
        yield "You take a moment to catch your breath. "
        yield "No new threat appears."

    monkeypatch.setattr("app.narrator.Narrator.stream", english_chunks)
    headers = {**auth, "Idempotency-Key": key}
    path = f"/characters/{character['id']}/actions/stream"
    body = client.post(path, json={"action": "look around"}, headers=headers).text

    assert "event: delta" not in body
    complete = json.loads(re.search(r"event: complete\ndata: (.*)", body).group(1))
    assert "catch your breath" not in complete["narration"].lower()
    assert complete["narration"]


async def _read_persisted(character_id: str, receipt_key: str):
    async with Session() as session:
        events = (await session.scalars(
            select(EventRecord).where(EventRecord.character_id == character_id)
        )).all()
        receipt = await session.get(ActionReceipt, receipt_key)
        return events[0].result if events else "", decode_state(receipt.response)["narration"]


def test_cs_stream_complete_matches_persisted_journal(auth, monkeypatch, setup_db):
    character = _cs_character(auth)
    key = uuid.uuid4().hex

    class _Gateway:
        providers = ("mock",)
        has_online_providers = True

    for target in ("app.api.narration_gateway_for", "app.ai.registry.narration_gateway_for"):
        monkeypatch.setattr(target, lambda _settings: _Gateway())
    monkeypatch.setattr("app.ai.registry.has_external_paid_narration_provider", lambda _settings: True)
    assert client.post("/economy/tier", json={"tier": "normal"}, headers=auth).status_code == 200

    async def english_chunks(_self, context, **_kwargs):
        yield "The corridor stays quiet and cold."

    monkeypatch.setattr("app.narrator.Narrator.stream", english_chunks)
    headers = {**auth, "Idempotency-Key": key}
    path = f"/characters/{character['id']}/actions/stream"
    body = client.post(path, json={"action": "look around"}, headers=headers).text

    complete = json.loads(re.search(r"event: complete\ndata: (.*)", body).group(1))
    final = complete["narration"]
    journal, receipt_narration = asyncio.run(_read_persisted(character["id"], key))
    assert final == receipt_narration
    assert journal.startswith(final.split("\n\n")[0])
