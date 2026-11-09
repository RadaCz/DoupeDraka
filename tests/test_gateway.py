import asyncio

import httpx
import pytest

from app.ai.base import NarrationContext, NarrationRequest
from app.ai.completion_meta import take_completion_meta
from app.ai.errors import ProviderRateLimitError, ProviderStreamAbortedError
from app.ai.gateway import NamedProvider, NarrationGateway
from app.ai.stream_frames import StreamReplaceFrame


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
        meta = take_completion_meta()
        assert first.calls == 1
        assert meta is not None
        assert meta.provider == "Groq"
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


class PartialThenAbortProvider:
    def __init__(self, partial: str, message: str = "connection reset"):
        self.partial = partial
        self.message = message

    async def complete(self, request: NarrationRequest) -> str:
        raise ProviderStreamAbortedError(self.message, provider="NVIDIA NIM", partial=self.partial)

    async def stream(self, request: NarrationRequest):
        if self.partial:
            yield self.partial
        raise ProviderStreamAbortedError(self.message, provider="NVIDIA NIM", partial=self.partial)


def test_gateway_mid_stream_abort_yields_replace_not_duplicate_chunks():
    async def run():
        token = "ZZZ_PARTIAL_TOKEN "
        gateway = NarrationGateway([NamedProvider("NVIDIA NIM", PartialThenAbortProvider(token))])
        frames = [frame async for frame in gateway.stream(_request())]
        assert frames[0] == token
        assert isinstance(frames[-1], StreamReplaceFrame)
        assert token.strip() not in frames[-1].narration
        # API must clear buffered deltas when it sees StreamReplaceFrame (no partial + offline concat).
        buffered = ""
        final = ""
        for frame in frames:
            if isinstance(frame, StreamReplaceFrame):
                buffered = frame.narration
            else:
                buffered += frame
        final = buffered
        assert token.strip() not in final

    asyncio.run(run())


def test_gateway_stream_yields_replace_when_all_providers_fail_before_first_token():
    async def run():
        failing = FlakyProvider(httpx.ConnectError("connection refused"), "")
        gateway = NarrationGateway([NamedProvider("NVIDIA NIM", failing)])
        frames = [frame async for frame in gateway.stream(_request())]
        assert failing.calls == 1
        assert len(frames) == 1
        assert isinstance(frames[0], StreamReplaceFrame)
        assert frames[0].narration.strip()

    asyncio.run(run())
