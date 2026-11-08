"""Try narration providers in order; fall back on rate limits, timeouts, and 5xx."""

from __future__ import annotations

import logging
from collections.abc import AsyncIterator, Sequence

from .base import NarrationProvider, NarrationRequest
import httpx

from .errors import (
    RETRYABLE_PROVIDER_ERRORS,
    ProviderStreamAbortedError,
)

_RETRYABLE = RETRYABLE_PROVIDER_ERRORS + (httpx.ConnectError, httpx.ReadError)
from .gateway_metrics import record_fallback as record_gateway_fallback
from .gateway_metrics import record_provider_success
from .offline import OfflineProvider
from .stream_frames import StreamReplaceFrame

logger = logging.getLogger(__name__)


class NamedProvider:
    """Wrap a provider so fallback logs show a human-readable label."""

    def __init__(self, name: str, provider: NarrationProvider):
        self.name = name
        self.provider = provider

    async def complete(self, request: NarrationRequest) -> str:
        return await self.provider.complete(request)

    async def stream(self, request: NarrationRequest) -> AsyncIterator[str]:
        async for chunk in self.provider.stream(request):
            yield chunk


class NarrationGateway:
    def __init__(self, providers: Sequence[NamedProvider], offline: OfflineProvider | None = None):
        self.providers = list(providers)
        self.offline = offline or OfflineProvider()

    @property
    def has_online_providers(self) -> bool:
        return bool(self.providers)

    @staticmethod
    def _telemetry_fallback(failed_provider: str, fallback_provider: str) -> None:
        from ..telemetry import record_llm_fallback

        record_llm_fallback(failed_provider, fallback_provider)

    async def complete(self, request: NarrationRequest) -> tuple[str, str]:
        """Return (text, status) where status is narrated or fallback."""
        for index, entry in enumerate(self.providers):
            try:
                text = await entry.complete(request)
                if text.strip():
                    record_provider_success(entry.name)
                    return text.strip(), "narrated"
            except _RETRYABLE as exc:
                fallback = self.providers[index + 1].name if index + 1 < len(self.providers) else "offline"
                logger.warning("%s failed (%s); falling back to %s", entry.name, exc, fallback)
                self._telemetry_fallback(entry.name, fallback)
                record_gateway_fallback(entry.name, fallback)
        text = await self.offline.complete(request)
        record_provider_success("offline")
        return text, "fallback"

    async def stream(self, request: NarrationRequest) -> AsyncIterator[str | StreamReplaceFrame]:
        """Stream narration; switch providers only before the first token."""
        for index, entry in enumerate(self.providers):
            try:
                async for chunk in entry.provider.stream(request):
                    if chunk:
                        yield chunk
                record_provider_success(entry.name)
                return
            except ProviderStreamAbortedError as exc:
                logger.warning(
                    "%s failed mid-stream (%s); replacing buffer with offline fallback",
                    entry.name,
                    exc,
                )
                self._telemetry_fallback(entry.name, "offline")
                record_gateway_fallback(entry.name, "offline")
                fallback = (await self.offline.complete(request)).strip()
                record_provider_success("offline")
                yield StreamReplaceFrame(fallback)
                return
            except _RETRYABLE as exc:
                fallback = self.providers[index + 1].name if index + 1 < len(self.providers) else "offline"
                logger.warning("%s failed (%s); falling back to %s", entry.name, exc, fallback)
                self._telemetry_fallback(entry.name, fallback)
                record_gateway_fallback(entry.name, fallback)
        async for chunk in self.offline.stream(request):
            yield chunk
        record_provider_success("offline")
