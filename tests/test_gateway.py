import asyncio

import pytest

from app.ai.base import NarrationContext, NarrationRequest
from app.ai.errors import ProviderRateLimitError
from app.ai.gateway import NamedProvider, NarrationGateway


def _request() -> NarrationRequest:
    context = NarrationContext(
        action="look around",
        events=("A door opens.",),
        location="The Whispering Cellar",
        memories=(),
    )
    return NarrationRequest(context, "system", "user")


class FlakyProvider:
    def __init__(self, fail_with: Exception | None, text: str):
        self.fail_with = fail_with
        self.text = text
        self.calls = 0

    async def complete(self, request: NarrationRequest) -> str:
        self.calls += 1
        if self.fail_with:
            raise self.fail_with
        return self.text

    async def stream(self, request: NarrationRequest):
        self.calls += 1
        if self.fail_with:
            raise self.fail_with
        yield self.text


def test_gateway_falls_back_after_rate_limit():
    async def run():
        first = FlakyProvider(ProviderRateLimitError("429", provider="NVIDIA NIM", status_code=429), "")
        second = FlakyProvider(None, "Groq narrates the beat.")
        gateway = NarrationGateway([
            NamedProvider("NVIDIA NIM", first),
            NamedProvider("Groq", second),
        ])
        text, status = await gateway.complete(_request())
        assert first.calls == 1
        assert second.calls == 1
        assert text == "Groq narrates the beat."
        assert status == "narrated"

    asyncio.run(run())


def test_gateway_streams_from_second_provider_when_first_fails():
    async def run():
        first = FlakyProvider(ProviderRateLimitError("429", provider="NVIDIA NIM", status_code=429), "")
        second = FlakyProvider(None, "streamed")
        gateway = NarrationGateway([
            NamedProvider("NVIDIA NIM", first),
            NamedProvider("Groq", second),
        ])
        chunks = [chunk async for chunk in gateway.stream(_request())]
        assert chunks == ["streamed"]
        assert first.calls == 1

    asyncio.run(run())
