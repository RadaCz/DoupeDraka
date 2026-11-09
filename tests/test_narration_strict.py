"""PAID_NARRATION_STRICT — single external provider, offline fallback, billing-safe."""

from __future__ import annotations

import asyncio

import pytest

from app.ai.base import NarrationContext, NarrationRequest
from app.ai.errors import ProviderRateLimitError
from app.ai.gateway import NamedProvider, NarrationGateway
from app.ai.registry import external_paid_providers, paid_narration_gateway_for
from app.narrator import Narrator
from app.settings import get_settings


def _request() -> NarrationRequest:
    context = NarrationContext(
        action="look",
        events=("You look around.",),
        location="The Whispering Cellar",
        memories=(),
    )
    return NarrationRequest(context, "system", "user")


class _FlakyProvider:
    def __init__(self, exc: Exception | None, text: str):
        self.exc = exc
        self.text = text
        self.calls = 0

    async def complete(self, request: NarrationRequest) -> str:
        self.calls += 1
        if self.exc:
            raise self.exc
        return self.text

    async def stream(self, request: NarrationRequest):
        self.calls += 1
        if self.exc:
            raise self.exc
        yield self.text


@pytest.mark.asyncio
async def test_strict_gateway_success_nvidia():
    nvidia = _FlakyProvider(None, "NVIDIA prose.")
    gateway = NarrationGateway([NamedProvider("NVIDIA NIM", nvidia)], paid_strict=True)
    text, status = await gateway.complete(_request())
    assert status == "narrated"
    assert text == "NVIDIA prose."
    assert nvidia.calls == 1


@pytest.mark.asyncio
async def test_strict_gateway_never_calls_second_external():
    nvidia = _FlakyProvider(
        ProviderRateLimitError("429", provider="NVIDIA NIM", status_code=429),
        "",
    )
    groq = _FlakyProvider(None, "Groq should not run.")
    gateway = NarrationGateway(
        [
            NamedProvider("NVIDIA NIM", nvidia),
            NamedProvider("Groq", groq),
        ],
        paid_strict=True,
    )
    text, status = await gateway.complete(_request())
    assert status == "fallback"
    assert nvidia.calls == 1
    assert groq.calls == 0
    assert text.strip()


@pytest.mark.asyncio
async def test_non_strict_still_chains_externals():
    nvidia = _FlakyProvider(
        ProviderRateLimitError("429", provider="NVIDIA NIM", status_code=429),
        "",
    )
    groq = _FlakyProvider(None, "Groq prose.")
    gateway = NarrationGateway(
        [
            NamedProvider("NVIDIA NIM", nvidia),
            NamedProvider("Groq", groq),
        ],
        paid_strict=False,
    )
    text, status = await gateway.complete(_request())
    assert status == "narrated"
    assert text == "Groq prose."
    assert groq.calls == 1


def test_paid_gateway_strict_truncates_registry(monkeypatch):
    monkeypatch.setenv("PAID_NARRATION_STRICT", "1")
    monkeypatch.setenv("LLM_PROVIDER", "auto")
    monkeypatch.setenv("LLM_PROVIDER_CHAIN", "nvidia,groq")
    monkeypatch.setenv("NVIDIA_API_KEY", "test-nvidia")
    monkeypatch.setenv("GROQ_API_KEY", "test-groq")
    get_settings.cache_clear()

    settings = get_settings()
    assert len(external_paid_providers(settings)) == 2
    gateway = paid_narration_gateway_for(settings)
    assert gateway.paid_strict is True
    assert len(gateway.providers) == 1
    assert gateway.providers[0].name == "NVIDIA NIM"


@pytest.mark.asyncio
async def test_lite_unchanged_under_strict(monkeypatch):
    counter = _FlakyProvider(None, "Paid.")

    async def fake_paid(_settings):
        return NarrationGateway([NamedProvider("NVIDIA NIM", counter)], paid_strict=True)

    monkeypatch.setattr("app.narrator.paid_narration_gateway_for", fake_paid)
    context = NarrationContext(
        action="look",
        events=("Fact.",),
        location="The Whispering Cellar",
        memories=(),
    )
    narration, status = await Narrator().narrate_detailed(context, billing_tier="lite")
    assert status == "offline"
    assert counter.calls == 0
    assert narration.strip()
