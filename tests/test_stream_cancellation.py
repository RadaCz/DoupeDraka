"""SSE narration stream: CancelledError during provider stream must settle billing once.

Scope: simulates cancellation by raising asyncio.CancelledError inside the mocked
Narrator.stream async iterator (same exception path as client abort during async for).
Does not open a real HTTP connection drop or Telegram WebView teardown.
"""

from __future__ import annotations

import asyncio
import json
import re
import uuid

from sqlalchemy import select

from app.db import ActionReceipt, EnergyTransaction, EventRecord, Session, User
from app.engine import economy
from tests.test_concurrency import auth, client, setup_db  # noqa: F401
from tests.test_api_systems import _mock_online_gateway


def _character(auth_headers):
    from tests.test_concurrency import _character

    return _character(auth_headers)


def test_stream_cancelled_error_commits_turn_refunds_once_and_reraises(auth, monkeypatch):
    """Turn stays committed; paid narration becomes fallback with a single refund."""
    finalize_calls: list[str] = []

    async def cancel_stream(_self, context, **_kwargs):
        yield "partial "
        raise asyncio.CancelledError()

    original_reconcile = __import__("app.api", fromlist=["reconcile_narrator_billing"]).reconcile_narrator_billing

    async def counting_reconcile(**kwargs):
        finalize_calls.append(kwargs.get("narration_status", ""))
        return await original_reconcile(**kwargs)

    _mock_online_gateway(monkeypatch)
    monkeypatch.setattr("app.narrator.Narrator.stream", cancel_stream)
    monkeypatch.setattr("app.api.reconcile_narrator_billing", counting_reconcile)

    billing_events: list[dict] = []

    def capture_billing(*_args, **kwargs):
        billing_events.append(dict(kwargs))

    monkeypatch.setattr("app.api.record_turn_billing", capture_billing)

    assert client.post("/economy/tier", json={"tier": "normal"}, headers=auth).status_code == 200
    character = _character(auth)
    key = uuid.uuid4().hex
    path = f"/characters/{character['id']}/actions/stream"
    headers = {**auth, "Idempotency-Key": key}

    async def energy_before():
        async with Session() as session:
            user = await session.scalar(select(User).where(User.username == "atomic"))
            return user.energy_tenths

    before = asyncio.run(energy_before())
    assert before >= economy.turn_cost("normal")

    response = client.post(path, json={"action": "look around"}, headers=headers)
    assert response.status_code == 200
    assert "event: turn" in response.text
    assert "event: delta" in response.text
    # Starlette/TestClient swallows the re-raised CancelledError after finalize_turn().
    assert "event: complete" not in response.text

    async def after_state():
        async with Session() as session:
            user = await session.scalar(select(User).where(User.username == "atomic"))
            refunds = (
                await session.scalars(
                    select(EnergyTransaction).where(
                        EnergyTransaction.user_id == user.id,
                        EnergyTransaction.reason == "refund",
                    )
                )
            ).all()
            events = (
                await session.scalars(
                    select(EventRecord).where(EventRecord.character_id == character["id"])
                )
            ).all()
            receipt = await session.get(ActionReceipt, key)
            return user.energy_tenths, refunds, events, receipt

    balance, refunds, events, receipt = asyncio.run(after_state())
    assert len(events) == 1, "mechanics commit must survive stream cancellation"
    assert receipt is not None and receipt.status == "complete"
    assert len(refunds) == 1
    assert refunds[0].amount_tenths == economy.turn_cost("normal")
    assert balance == before
    assert len(finalize_calls) == 1
    assert finalize_calls[0] == "fallback"
    assert len(billing_events) == 1
    assert billing_events[0]["energy_refunded_tenths"] == economy.turn_cost("normal")


def test_stream_cancelled_error_idempotent_replay_skips_second_billing(auth, monkeypatch):
    async def cancel_stream(_self, context, **_kwargs):
        yield "x"
        raise asyncio.CancelledError()

    _mock_online_gateway(monkeypatch)
    monkeypatch.setattr("app.narrator.Narrator.stream", cancel_stream)
    billing_events: list[dict] = []
    monkeypatch.setattr(
        "app.api.record_turn_billing",
        lambda *_a, **kw: billing_events.append(dict(kw)),
    )
    assert client.post("/economy/tier", json={"tier": "normal"}, headers=auth).status_code == 200
    character = _character(auth)
    key = uuid.uuid4().hex
    path = f"/characters/{character['id']}/actions/stream"
    headers = {**auth, "Idempotency-Key": key}

    first = client.post(path, json={"action": "look around"}, headers=headers)
    assert first.status_code == 200
    assert "event: complete" not in first.text

    replay = client.post(path, json={"action": "look around"}, headers=headers)
    assert replay.status_code == 200
    assert "event: complete" in replay.text
    assert len(billing_events) == 1


def test_stream_all_providers_fail_before_first_token_refunds_once(auth, monkeypatch):
    import httpx
    from app.ai.gateway import NamedProvider, NarrationGateway

    class _FailingProvider:
        async def complete(self, request):
            raise httpx.ConnectError("refused")

        async def stream(self, request):
            raise httpx.ConnectError("refused")
            yield ""  # pragma: no cover

    gateway = NarrationGateway([NamedProvider("Mock", _FailingProvider())])
    for target in (
        "app.narrator.narration_gateway_for",
        "app.ai.registry.narration_gateway_for",
        "app.api.narration_gateway_for",
    ):
        monkeypatch.setattr(target, lambda _s: gateway)
    monkeypatch.setattr("app.ai.registry.has_external_paid_narration_provider", lambda _s: True)

    assert client.post("/economy/tier", json={"tier": "normal"}, headers=auth).status_code == 200
    character = _character(auth)
    response = client.post(
        f"/characters/{character['id']}/actions/stream",
        json={"action": "look around"},
        headers={**auth, "Idempotency-Key": uuid.uuid4().hex},
    )
    assert response.status_code == 200
    assert "event: replace" in response.text
    assert "event: complete" in response.text
    complete = re.search(r"event: complete\ndata: ({.*?})\n", response.text, re.DOTALL)
    assert complete is not None
    payload = json.loads(complete.group(1))
    assert payload["narration_status"] == "fallback"

    async def balances():
        async with Session() as session:
            user = await session.scalar(select(User).where(User.username == "atomic"))
            refunds = (
                await session.scalars(
                    select(EnergyTransaction).where(
                        EnergyTransaction.user_id == user.id,
                        EnergyTransaction.reason == "refund",
                    )
                )
            ).all()
            return user.energy_tenths, refunds

    balance, refunds = asyncio.run(balances())
    assert len(refunds) == 1
    assert refunds[0].amount_tenths == economy.turn_cost("normal")
    assert balance == 1000
