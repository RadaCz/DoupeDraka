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
from .completion_meta import model_for_provider, set_completion_meta
from .provider_call_stats import take_provider_call_stats
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
    def __init__(
        self,
        providers: Sequence[NamedProvider],
        offline: OfflineProvider | None = None,
        *,
        paid_strict: bool = False,
    ):
        self.providers = list(providers)
        self.offline = offline or OfflineProvider()
        self.paid_strict = paid_strict

    @property
    def has_online_providers(self) -> bool:
        return bool(self.providers)

    @staticmethod
    def _telemetry_fallback(
        failed_provider: str,
        fallback_provider: str,
        *,
        error_kind: str = "",
    ) -> None:
        from ..telemetry import record_llm_fallback

        record_llm_fallback(failed_provider, fallback_provider, error_kind=error_kind)

    def _record_success_meta(self, entry: NamedProvider, *, delivered: bool) -> None:
        set_completion_meta(
            entry.name,
            model_for_provider(entry.provider, entry.name),
            call_stats=take_provider_call_stats(),
            provider_request_status="success",
            delivered_to_player=delivered,
        )

    async def complete(self, request: NarrationRequest) -> tuple[str, str]:
        """Return (text, status) where status is narrated or fallback."""
        for index, entry in enumerate(self.providers):
            take_provider_call_stats()
            try:
                text = await entry.complete(request)
                if text.strip():
                    record_provider_success(entry.name)
                    self._record_success_meta(entry, delivered=True)
                    return text.strip(), "narrated"
            except _RETRYABLE as exc:
                reason = type(exc).__name__
                if self.paid_strict or index + 1 >= len(self.providers):
                    fallback = "offline"
                else:
                    fallback = self.providers[index + 1].name
                logger.warning("%s failed (%s); falling back to %s", entry.name, exc, fallback)
                self._telemetry_fallback(entry.name, fallback, error_kind=reason)
                record_gateway_fallback(entry.name, fallback)
                if self.paid_strict:
                    break
        text = await self.offline.complete(request)
        record_provider_success("offline")
        failed = self.providers[0].name if self.providers else "unknown"
        set_completion_meta(
            "offline",
            "offline",
            provider_request_status="offline_fallback",
            fallback_reason=f"{failed}_failed",
            delivered_to_player=bool(text.strip()),
        )
        return text, "fallback"

    async def stream(self, request: NarrationRequest) -> AsyncIterator[str | StreamReplaceFrame]:
        """Stream narration; switch providers only before the first token."""
        for index, entry in enumerate(self.providers):
            take_provider_call_stats()
            try:
                async for chunk in entry.provider.stream(request):
                    if chunk:
                        yield chunk
                record_provider_success(entry.name)
                self._record_success_meta(entry, delivered=True)
                return
            except ProviderStreamAbortedError as exc:
                logger.warning(
                    "%s failed mid-stream (%s); replacing buffer with offline fallback",
                    entry.name,
                    exc,
                )
                self._telemetry_fallback(entry.name, "offline", error_kind=type(exc).__name__)
                record_gateway_fallback(entry.name, "offline")
                fallback = (await self.offline.complete(request)).strip()
                record_provider_success("offline")
                set_completion_meta(
                    "offline",
                    "offline",
                    provider_request_status="offline_fallback",
                    fallback_reason=f"{entry.name}_stream_aborted",
                    delivered_to_player=bool(fallback),
                )
                yield StreamReplaceFrame(fallback)
                return
            except _RETRYABLE as exc:
                if self.paid_strict or index + 1 >= len(self.providers):
                    fallback = "offline"
                else:
                    fallback = self.providers[index + 1].name
                logger.warning("%s failed (%s); falling back to %s", entry.name, exc, fallback)
                self._telemetry_fallback(entry.name, fallback, error_kind=type(exc).__name__)
                record_gateway_fallback(entry.name, fallback)
                if self.paid_strict:
                    break
        offline_text = (await self.offline.complete(request)).strip()
        record_provider_success("offline")
        failed = self.providers[0].name if self.providers else "unknown"
        set_completion_meta(
            "offline",
            "offline",
            provider_request_status="offline_fallback",
            fallback_reason=f"{failed}_failed",
            delivered_to_player=bool(offline_text),
        )
        if offline_text:
            yield StreamReplaceFrame(offline_text)
