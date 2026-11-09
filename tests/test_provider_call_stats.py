"""ContextVar isolation for provider usage stats."""

from __future__ import annotations

import asyncio

import pytest

from app.ai.base import NarrationContext, NarrationRequest
from app.ai.gateway import NamedProvider, NarrationGateway
from app.ai.completion_meta import take_completion_meta
from app.ai.provider_call_stats import stash_provider_call_stats, take_provider_call_stats


def _request() -> NarrationRequest:
    return NarrationRequest(
        NarrationContext("look", ("fact",), "here", ()),
        "sys",
        "user",
    )


class _WhitespaceProvider:
    async def complete(self, request: NarrationRequest) -> str:
        stash_provider_call_stats(prompt_tokens=99, completion_tokens=1, latency_ms=5)
        return "   "

    async def stream(self, request: NarrationRequest):
        yield "x"


class _OkProvider:
    async def complete(self, request: NarrationRequest) -> str:
        stash_provider_call_stats(prompt_tokens=7, completion_tokens=3, latency_ms=2)
        return "ok"

    async def stream(self, request: NarrationRequest):
        yield "ok"


@pytest.mark.asyncio
async def test_gateway_clears_stale_usage_when_provider_returns_blank():
    gateway = NarrationGateway([
        NamedProvider("First", _WhitespaceProvider()),
        NamedProvider("Second", _OkProvider()),
    ])
    text, status = await gateway.complete(_request())
    assert status == "narrated"
    assert text == "ok"
    # Second provider stats should attach, not the discarded blank response.
    from app.ai.completion_meta import take_completion_meta

    meta = take_completion_meta()
    assert meta is not None
    assert meta.provider == "Second"
    assert meta.prompt_tokens == 7


class _SlowTaggedProvider:
    """Simulates distinct external APIs with overlapping async latency."""

    def __init__(
        self,
        name: str,
        model: str,
        *,
        latency_ms: int,
        prompt_tokens: int,
        completion_tokens: int,
        delay_s: float,
    ):
        self.name = name
        self.model = model
        self.latency_ms = latency_ms
        self.prompt_tokens = prompt_tokens
        self.completion_tokens = completion_tokens
        self.delay_s = delay_s

    async def complete(self, request: NarrationRequest) -> str:
        await asyncio.sleep(self.delay_s)
        stash_provider_call_stats(
            latency_ms=self.latency_ms,
            prompt_tokens=self.prompt_tokens,
            completion_tokens=self.completion_tokens,
            total_tokens=self.prompt_tokens + self.completion_tokens,
        )
        return f"Narration from {self.name}"

    async def stream(self, request: NarrationRequest):
        yield await self.complete(request)


@pytest.mark.asyncio
async def test_concurrent_users_do_not_leak_provider_stats_between_tasks():
    async def user_turn(
        provider_name: str,
        model: str,
        prompt_tokens: int,
        completion_tokens: int,
        latency_ms: int,
        delay_s: float,
    ) -> tuple[str, str, int, int]:
        gateway = NarrationGateway([
            NamedProvider(
                provider_name,
                _SlowTaggedProvider(
                    provider_name,
                    model,
                    latency_ms=latency_ms,
                    prompt_tokens=prompt_tokens,
                    completion_tokens=completion_tokens,
                    delay_s=delay_s,
                ),
            ),
        ])
        _text, status = await gateway.complete(_request())
        assert status == "narrated"
        meta = take_completion_meta()
        assert meta is not None
        assert meta.provider == provider_name
        assert meta.model == model
        assert meta.prompt_tokens == prompt_tokens
        assert meta.completion_tokens == completion_tokens
        assert meta.latency_ms == latency_ms
        assert take_completion_meta() is None
        assert take_provider_call_stats() == {}
        return provider_name, model, prompt_tokens, latency_ms

    user_a, user_b = await asyncio.gather(
        user_turn("NVIDIA NIM", "meta/llama-nim-a", 40, 12, 210, 0.06),
        user_turn("Groq", "llama-groq-b", 19, 7, 88, 0.06),
    )

    assert user_a[0] != user_b[0]
    assert user_a[1] != user_b[1]
    assert user_a[2] != user_b[2]
    assert user_a[3] != user_b[3]
