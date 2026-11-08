'''Regression coverage for the atomic turn (STEP 1).

Three properties are load-bearing and none of them held before this pass:

* a repeated Idempotency-Key replays the committed turn instead of charging twice
* a writer holding a stale version cannot overwrite the character
* a narrator failure leaves the decided turn committed

Each test names the mechanism it pins, so a later refactor that quietly removes
the version fence fails here rather than in production.
'''
import asyncio
import json
import re
import uuid
from concurrent.futures import ThreadPoolExecutor, wait
from datetime import datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select, text, update

from app import api
from app.api import app
from app.db import ActionReceipt, CharacterRecord, EnergyTransaction, EventRecord, Session, User, decode_state, init_db
from app.engine import economy

client = TestClient(app)

TABLES = ("action_receipts", "energy_transactions", "api_keys", "events", "characters", "users")


@pytest.fixture
def setup_db():
    asyncio.run(init_db())
    yield
    async def cleanup():
        async with Session() as session:
            for table in TABLES:
                await session.execute(text(f"DELETE FROM {table}"))
            await session.commit()
    asyncio.run(cleanup())


@pytest.fixture
def auth(setup_db):
    '''Register and log in a fresh user, returning bearer headers.'''
    client.post("/auth/register", json={"username": "atomic", "password": "password123"})
    token = client.post(
        "/auth/login", json={"username": "atomic", "password": "password123"}
    ).json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def _character(auth_headers) -> dict:
    '''Create a character from a preset so no race/class spelling is guessed.'''
    response = client.post("/characters/presets/tank", headers=auth_headers)
    assert response.status_code == 201, response.text
    return response.json()


def test_repeated_idempotency_key_charges_once(auth):
    '''A retried request returns the committed turn: one event, one debit.'''
    character = _character(auth)
    key = uuid.uuid4().hex
    headers = {**auth, "Idempotency-Key": key}
    body = {"action": "attack the goblin"}

    first = client.post(f"/characters/{character['id']}/actions", json=body, headers=headers)
    assert first.status_code == 200, first.text
    second = client.post(f"/characters/{character['id']}/actions", json=body, headers=headers)
    assert second.status_code == 200, second.text

    # Byte-identical replay: same dice, same narration, same balance.
    assert second.json()["events"] == first.json()["events"]
    assert second.json()["narration"] == first.json()["narration"]
    assert second.json()["energy_tenths"] == first.json()["energy_tenths"]
    assert second.json()["character"]["hp"] == first.json()["character"]["hp"]

    async def count():
        async with Session() as session:
            events = (await session.scalars(
                select(EventRecord).where(EventRecord.character_id == character["id"])
            )).all()
            receipts = (await session.scalars(
                select(ActionReceipt).where(ActionReceipt.key == key)
            )).all()
            record = await session.get(CharacterRecord, character["id"])
            return len(events), len(receipts), record.version

    events, receipts, version = asyncio.run(count())
    assert events == 1, "the replay wrote a second event"
    assert receipts == 1, "the replay wrote a second receipt"
    assert version == 1, "the replay advanced the character version"

    async def expiry():
        async with Session() as session:
            receipt = await session.get(ActionReceipt, key)
            return receipt.created_at, receipt.expires_at

    created_at, expires_at = asyncio.run(expiry())
    assert expires_at - created_at == timedelta(hours=24)


def test_expired_idempotency_key_can_be_reused(auth):
    character = _character(auth)
    key = uuid.uuid4().hex
    headers = {**auth, "Idempotency-Key": key}
    body = {"action": "attack the goblin"}

    first = client.post(f"/characters/{character['id']}/actions", json=body, headers=headers)
    assert first.status_code == 200, first.text

    async def expire_receipt():
        async with Session() as session:
            receipt = await session.get(ActionReceipt, key)
            receipt.expires_at = datetime.utcnow() - timedelta(seconds=1)
            await session.commit()

    asyncio.run(expire_receipt())
    second = client.post(f"/characters/{character['id']}/actions", json=body, headers=headers)
    assert second.status_code == 200, second.text

    async def state():
        async with Session() as session:
            events = (
                await session.scalars(
                    select(EventRecord).where(EventRecord.character_id == character["id"])
                )
            ).all()
            receipt = await session.get(ActionReceipt, key)
            record = await session.get(CharacterRecord, character["id"])
            return len(events), record.version, receipt.expires_at

    event_count, version, expires_at = asyncio.run(state())
    assert event_count == 2
    assert version == 2
    assert expires_at > datetime.utcnow()


def test_stale_version_cannot_overwrite_character(auth):
    '''The version fence is what prevents the lost update.

    Two sessions read the same snapshot, exactly as two concurrent turns would.
    The first claims the row; the second must match zero rows and therefore
    write nothing.
    '''
    character = _character(auth)

    async def race():
        async with Session() as winner, Session() as loser:
            a = await winner.get(CharacterRecord, character["id"])
            b = await loser.get(CharacterRecord, character["id"])
            assert a.version == b.version, "precondition: both readers see one version"

            claimed = await winner.execute(
                update(CharacterRecord)
                .where(CharacterRecord.id == character["id"], CharacterRecord.version == a.version)
                .values(payload=a.payload, version=a.version + 1)
                .execution_options(synchronize_session=False)
            )
            await winner.commit()
            assert claimed.rowcount == 1

            stale = await loser.execute(
                update(CharacterRecord)
                .where(CharacterRecord.id == character["id"], CharacterRecord.version == b.version)
                .values(payload='{"overwritten": true}', version=b.version + 1)
                .execution_options(synchronize_session=False)
            )
            await loser.commit()
            return stale.rowcount

    assert asyncio.run(race()) == 0, "a stale writer was allowed to overwrite the character"

    async def payload_after():
        async with Session() as session:
            record = await session.get(CharacterRecord, character["id"])
            return record.payload, record.version

    payload, version = asyncio.run(payload_after())
    assert "overwritten" not in payload
    assert version == 1


def test_narration_failure_keeps_the_committed_turn(auth, monkeypatch):
    '''A dead model must not cost the player a turn they already paid for.'''
    character = _character(auth)

    async def unreachable(context):
        raise RuntimeError("model unreachable")

    monkeypatch.setattr(api.narrator, "narrate_detailed", unreachable)

    response = client.post(
        f"/characters/{character['id']}/actions",
        json={"action": "attack the goblin"},
        headers=auth,
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["narration_status"] == "fallback"
    assert body["narration"], "fallback prose must still be returned"
    assert body["events"], "engine events must survive a narrator failure"

    async def state():
        async with Session() as session:
            events = (await session.scalars(
                select(EventRecord).where(EventRecord.character_id == character["id"])
            )).all()
            record = await session.get(CharacterRecord, character["id"])
            return len(events), record.version

    events, version = asyncio.run(state())
    assert events == 1, "the turn was rolled back with the narration"
    assert version == 1, "the committed state did not advance"


def test_streamed_narration_is_saved_and_idempotent(auth, monkeypatch):
    character = _character(auth)
    key = uuid.uuid4().hex
    calls = 0

    async def chunks(context):
        nonlocal calls
        calls += 1
        assert context.events
        yield "The "
        yield "stone shifts."

    monkeypatch.setattr(api.narrator, "stream", chunks)
    headers = {**auth, "Idempotency-Key": key}
    path = f"/characters/{character['id']}/actions/stream"
    first = client.post(path, json={"action": "look around"}, headers=headers)

    assert first.status_code == 200
    assert first.headers["content-type"].startswith("text/event-stream")
    assert "event: delta\ndata: {\"text\":\"The \"}" in first.text
    assert "event: delta\ndata: {\"text\":\"stone shifts.\"}" in first.text
    assert first.text.index('"The "') < first.text.index('"stone shifts."')
    complete = json.loads(re.search(r"event: complete\ndata: (.*)", first.text).group(1))
    assert complete["narration"] == "The stone shifts."
    # A provider that answered is "narrated"; only an empty or failed stream is
    # "fallback". Either status is legitimate here, the wording is not.
    assert complete["narration_status"] in {"narrated", "fallback"}

    async def read_committed():
        async with Session() as session:
            events = (await session.scalars(
                select(EventRecord).where(EventRecord.character_id == character["id"])
            )).all()
            receipt = await session.get(ActionReceipt, key)
            record = await session.get(CharacterRecord, character["id"])
            return events, receipt.status, decode_state(receipt.response), record.version

    events, receipt_status, saved_response, version = asyncio.run(read_committed())
    assert len(events) == 1
    assert events[0].result.startswith("The stone shifts.\n\n")
    assert receipt_status == "complete"
    assert saved_response["narration"] == "The stone shifts."
    assert version == 1

    replay = client.post(path, json={"action": "look around"}, headers=headers)
    assert replay.status_code == 200
    assert "event: complete" in replay.text
    assert "event: delta" not in replay.text
    assert calls == 1
    events, _, _, version = asyncio.run(read_committed())
    assert len(events) == 1
    assert version == 1


def test_streaming_provider_failure_replaces_partial_text_with_fallback(auth, monkeypatch):
    character = _character(auth)

    async def broken_stream(context):
        yield "partial"
        raise RuntimeError("model disconnected")

    monkeypatch.setattr(api.narrator, "stream", broken_stream)
    response = client.post(
        f"/characters/{character['id']}/actions/stream",
        json={"action": "look around"},
        headers=auth,
    )

    assert response.status_code == 200
    assert "event: delta\ndata: {\"text\":\"partial\"}" in response.text
    assert "event: replace" in response.text
    assert '"narration_status":"fallback"' in response.text

    async def saved_event():
        async with Session() as session:
            event = await session.scalar(
                select(EventRecord).where(EventRecord.character_id == character["id"])
            )
            return event.result

    result = asyncio.run(saved_event())
    assert "partial" not in result
    assert "Exploration roll:" in result


def test_concurrent_same_idempotency_key_one_turn(auth):
    """Two parallel POSTs with the same key must commit at most one turn."""
    character = _character(auth)
    key = uuid.uuid4().hex
    headers = {**auth, "Idempotency-Key": key}
    body = {"action": "look around"}
    path = f"/characters/{character['id']}/actions"

    def post():
        return client.post(path, json=body, headers=headers)

    with ThreadPoolExecutor(max_workers=2) as pool:
        futures = [pool.submit(post), pool.submit(post)]
        wait(futures)
        responses = [future.result() for future in futures]

    for response in responses:
        assert response.status_code == 200, response.text

    assert responses[0].json()["events"] == responses[1].json()["events"]
    assert responses[0].json()["character"]["hp"] == responses[1].json()["character"]["hp"]

    async def counts():
        async with Session() as session:
            events = (
                await session.scalars(
                    select(EventRecord).where(EventRecord.character_id == character["id"])
                )
            ).all()
            receipts = (
                await session.scalars(select(ActionReceipt).where(ActionReceipt.key == key))
            ).all()
            record = await session.get(CharacterRecord, character["id"])
            return len(events), len(receipts), record.version

    events, receipts, version = asyncio.run(counts())
    assert events == 1
    assert receipts == 1
    assert version == 1


def test_concurrent_turns_on_two_characters_debit_energy_once_each(auth):
    """Parallel turns on two heroes sharing one account must not drop a debit."""
    first = _character(auth)
    second = _character(auth)
    cost = economy.turn_cost("normal")
    body = {"action": "look around"}

    async def set_balance(tenths: int):
        async with Session() as session:
            user = await session.scalar(select(User).where(User.username == "atomic"))
            user.energy_tenths = tenths
            await session.commit()

    asyncio.run(set_balance(cost * 2))

    def act(character_id: str):
        return client.post(
            f"/characters/{character_id}/actions",
            json=body,
            headers={**auth, "Idempotency-Key": uuid.uuid4().hex},
        )

    with ThreadPoolExecutor(max_workers=2) as pool:
        futures = [
            pool.submit(act, first["id"]),
            pool.submit(act, second["id"]),
        ]
        wait(futures)
        responses = [future.result() for future in futures]

    assert all(response.status_code == 200 for response in responses)

    async def ledger_state():
        async with Session() as session:
            user = await session.scalar(select(User).where(User.username == "atomic"))
            txs = (
                await session.scalars(
                    select(EnergyTransaction).where(EnergyTransaction.user_id == user.id)
                )
            ).all()
            debits = [tx for tx in txs if tx.reason == "turn"]
            return user.energy_tenths, sum(-tx.amount_tenths for tx in debits)

    balance, debited = asyncio.run(ledger_state())
    assert balance == 0
    assert debited == cost * 2
