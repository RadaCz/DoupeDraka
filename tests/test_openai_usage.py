"""OpenAI-compatible provider usage + latency telemetry."""

from __future__ import annotations

import asyncio
import json

import httpx
import pytest

from app.ai.base import NarrationContext, NarrationRequest
from app.ai.openai_chat import OpenAIChatProvider
from app.ai.provider_call_stats import take_provider_call_stats


def _request() -> NarrationRequest:
    context = NarrationContext(
        action="look",
        events=("A beat.",),
        location="The Whispering Cellar",
        memories=(),
    )
    return NarrationRequest(context, "sys", "user")


@pytest.mark.asyncio
async def test_complete_stashes_usage_when_present():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={
                "choices": [{"message": {"content": "Hello cellar."}}],
                "usage": {"prompt_tokens": 12, "completion_tokens": 7, "total_tokens": 19},
            },
        )

    transport = httpx.MockTransport(handler)
    provider = OpenAIChatProvider(
        "nvidia",
        "https://example.test/v1",
        "secret",
        "test-model",
        transport=transport,
    )
    text = await provider.complete(_request())
    assert text == "Hello cellar."
    stats = take_provider_call_stats()
    assert stats["prompt_tokens"] == 12
    assert stats["completion_tokens"] == 7
    assert stats["total_tokens"] == 19
    assert isinstance(stats["latency_ms"], int)


@pytest.mark.asyncio
async def test_complete_without_usage_does_not_fail():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={"choices": [{"message": {"content": "No usage block."}}]},
        )

    transport = httpx.MockTransport(handler)
    provider = OpenAIChatProvider(
        "nvidia",
        "https://example.test/v1",
        "key",
        "test-model",
        transport=transport,
    )
    await provider.complete(_request())
    stats = take_provider_call_stats()
    assert "prompt_tokens" not in stats
    assert "latency_ms" in stats


@pytest.mark.asyncio
async def test_stream_keeps_usage_from_final_chunk():
    body = "\n".join(
        [
            'data: {"choices":[{"delta":{"content":"Hi "}}]}',
            'data: {"choices":[{"delta":{"content":"there."}}],"usage":{"prompt_tokens":5,"completion_tokens":3,"total_tokens":8}}',
            "data: [DONE]",
        ]
    )

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, content=body.encode(), headers={"content-type": "text/event-stream"})

    transport = httpx.MockTransport(handler)
    provider = OpenAIChatProvider(
        "nvidia",
        "https://example.test/v1",
        "key",
        "test-model",
        transport=transport,
    )

    chunks = [part async for part in provider.stream(_request())]
    assert "".join(chunks) == "Hi there."
    stats = take_provider_call_stats()
    assert stats.get("total_tokens") == 8
