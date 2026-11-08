import asyncio
import json

import httpx

from app.ai.base import NarrationContext, NarrationRequest
from app.ai.ollama import OllamaProvider
from app.narrator import Narrator


def narration_request() -> NarrationRequest:
    context = NarrationContext(
        action="search",
        events=("A path opens.",),
        location="The Sunken Corridor",
        memories=(),
    )
    return NarrationRequest(context, "Describe facts only.", "Engine result: A path opens.")


def test_ollama_provider_completes_with_resolved_prompt():
    def respond(request: httpx.Request) -> httpx.Response:
        payload = json.loads(request.content)
        assert request.url == "http://ollama.test/api/chat"
        assert payload["stream"] is False
        assert payload["model"] == "test-model"
        assert payload["messages"][0]["content"] == "Describe facts only."
        return httpx.Response(200, json={"message": {"content": "The path opens."}})

    provider = OllamaProvider(
        "http://ollama.test/",
        "test-model",
        transport=httpx.MockTransport(respond),
    )

    result = asyncio.run(provider.complete(narration_request()))

    assert result == "The path opens."


def test_ollama_provider_yields_streamed_chunks():
    def respond(request: httpx.Request) -> httpx.Response:
        payload = json.loads(request.content)
        assert payload["stream"] is True
        return httpx.Response(
            200,
            content=(
                b'{"message":{"content":"A cold "},"done":false}\n'
                b'{"message":{"content":"draft stirs."},"done":true}\n'
            ),
        )

    provider = OllamaProvider(
        "http://ollama.test",
        "test-model",
        transport=httpx.MockTransport(respond),
    )

    async def collect() -> list[str]:
        return [chunk async for chunk in provider.stream(narration_request())]

    assert asyncio.run(collect()) == ["A cold ", "draft stirs."]


def test_provider_failure_uses_offline_fallback(monkeypatch):
    class BrokenProvider:
        async def complete(self, request: NarrationRequest) -> str:
            raise httpx.ConnectError("Ollama is unavailable")

    monkeypatch.setattr("app.narrator.provider_for", lambda settings: BrokenProvider())
    context = narration_request().context

    narration, status = asyncio.run(Narrator().narrate_detailed(context))

    assert status == "fallback"
    assert narration
    assert "Ollama is unavailable" not in narration
