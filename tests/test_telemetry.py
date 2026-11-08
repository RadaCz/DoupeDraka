import asyncio
import json

import pytest
from httpx import ASGITransport, AsyncClient

from app.ai.errors import ProviderRateLimitError
from app.ai.gateway import NamedProvider, NarrationGateway
from app.api import app
from app.db import AnalyticsEvent, Session
from app.engine.models import TurnResult
from app.telemetry import analytics_rows_from_turn


def test_analytics_rows_from_turn_detects_level_death_purchase():
    rows = analytics_rows_from_turn(
        "char-1",
        TurnResult(
            "buy potion",
            ["Defeated in combat. You black out.", "You buy Healing Potion for 50 gp."],
            True,
            level_up_facts={"new_level": 2},
            purchase_facts={"item_name": "Healing Potion", "gold_spent": 50},
        ),
        location="The Vault of Echoes",
        monster_name="Orc marauder",
    )
    types = {row.event_type for row in rows}
    assert types == {"level_up", "purchase", "death"}


def test_gateway_fallback_schedules_telemetry(monkeypatch):
    logged: list[tuple[str, str]] = []

    def capture(failed: str, fallback: str, character_id=None):
        logged.append((failed, fallback))

    monkeypatch.setattr("app.telemetry.record_llm_fallback", capture)

    class FailProvider:
        async def complete(self, request):
            raise ProviderRateLimitError("429", provider="NVIDIA NIM", status_code=429)

        async def stream(self, request):
            raise ProviderRateLimitError("429", provider="NVIDIA NIM", status_code=429)
            yield ""  # pragma: no cover

    class OkProvider:
        async def complete(self, request):
            return "ok"

        async def stream(self, request):
            yield "ok"

    gateway = NarrationGateway([
        NamedProvider("NVIDIA NIM", FailProvider()),
        NamedProvider("Groq", OkProvider()),
    ])

    from app.ai.base import NarrationContext, NarrationRequest

    request = NarrationRequest(
        NarrationContext("act", ("fact",), "here", ()),
        "sys",
        "user",
    )
    text, status = asyncio.run(gateway.complete(request))
    assert text == "ok"
    assert status == "narrated"
    assert logged == [("NVIDIA NIM", "Groq")]


@pytest.mark.anyio
async def test_admin_stats_requires_token(isolated_database):
    get_settings = __import__("app.settings", fromlist=["get_settings"]).get_settings
    token = "test-admin-stats-token"
    get_settings.cache_clear()
    import os

    os.environ["ADMIN_API_KEY"] = token
    get_settings.cache_clear()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        denied = await client.get("/admin/stats")
        assert denied.status_code == 403
        allowed = await client.get("/admin/stats", headers={"X-Admin-Token": token})
        assert allowed.status_code == 200
        body = allowed.json()
        assert "total_active_characters" in body
        assert "llm_fallback_rate" in body

    get_settings.cache_clear()
