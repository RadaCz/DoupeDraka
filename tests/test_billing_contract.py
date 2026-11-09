"""Lite/Normal narrator billing must match the configured provider chain."""

from __future__ import annotations

from unittest.mock import AsyncMock

import pytest

from app.ai.base import NarrationContext, NarrationRequest
from app.ai.gateway import NamedProvider, NarrationGateway
from app.ai.registry import has_external_paid_narration_provider, narration_gateway_for
from app.narrator import Narrator
from app.settings import get_settings


def _context() -> NarrationContext:
    return NarrationContext(
        location="The Whispering Cellar",
        action="look around",
        events=("You take a cautious look around.",),
        memories=(),
        tone="balanced",
        humor="rare",
        verbose=False,
        language="en",
    )


class _CountingProvider:
    def __init__(self):
        self.complete_calls = 0
        self.stream_chunks = 0

    async def complete(self, request: NarrationRequest) -> str:
        self.complete_calls += 1
        return "Paid narration line."

    async def stream(self, request: NarrationRequest):
        self.stream_chunks += 1
        yield "Paid "


@pytest.mark.asyncio
async def test_lite_never_calls_external_provider(monkeypatch):
    counter = _CountingProvider()
    gateway = NarrationGateway([NamedProvider("Paid", counter)])

    monkeypatch.setattr("app.narrator.narration_gateway_for", lambda _settings: gateway)
    narration, status = await Narrator().narrate_detailed(_context(), billing_tier="lite")
    assert status == "offline"
    assert narration.strip()
    assert counter.complete_calls == 0
    assert counter.stream_chunks == 0


@pytest.mark.asyncio
async def test_normal_calls_configured_provider(monkeypatch):
    counter = _CountingProvider()
    gateway = NarrationGateway([NamedProvider("Paid", counter)])
    gateway.complete = AsyncMock(wraps=gateway.complete)

    monkeypatch.setattr("app.narrator.paid_narration_gateway_for", lambda _settings: gateway)

    narration, status = await Narrator().narrate_detailed(_context(), billing_tier="normal")
    assert status == "narrated"
    assert "Paid" in narration
    assert counter.complete_calls == 1


def test_normal_without_external_provider_downgrades_billing_tier(monkeypatch):
    monkeypatch.setenv("LLM_PROVIDER", "ollama")
    monkeypatch.setenv("OLLAMA_URL", "http://127.0.0.1:11434")
    monkeypatch.setenv("GROQ_API_KEY", "")
    monkeypatch.setenv("NVIDIA_API_KEY", "")
    monkeypatch.setenv("CEREBRAS_API_KEY", "")
    monkeypatch.setenv("OPENROUTER_API_KEY", "")
    get_settings.cache_clear()
    settings = get_settings()

    from app.engine import economy

    assert has_external_paid_narration_provider(settings) is False
    assert economy.effective_billing_tier(
        "normal",
        has_online_provider=narration_gateway_for(settings).has_online_providers,
        has_external_paid_provider=False,
    ) == "lite"


@pytest.mark.asyncio
async def test_normal_stream_invokes_provider_not_offline(monkeypatch):
    counter = _CountingProvider()

    async def stream(_self, context, *, billing_tier="lite", **_kwargs):
        assert billing_tier == "normal"
        counter.stream_chunks += 1
        yield "Streamed "

    monkeypatch.setattr("app.narrator.Narrator.stream", stream)
    chunks = []
    async for frame in Narrator().stream(_context(), billing_tier="normal"):
        chunks.append(frame)
    assert counter.stream_chunks == 1
    assert "".join(chunks).startswith("Streamed")


