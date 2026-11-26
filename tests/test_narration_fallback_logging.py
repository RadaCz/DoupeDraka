"""Structured warning logs when paid narration falls back to offline prose."""

from __future__ import annotations

import asyncio
import json
import logging

import httpx
import pytest

from app.ai.base import NarrationContext, NarrationRequest
from app.ai.errors import ProviderRateLimitError, ProviderServerError, ProviderTimeoutError
from app.ai.gateway import NamedProvider, NarrationGateway
from app.narrator import Narrator


def _request() -> NarrationRequest:
    context = NarrationContext(
        action="search",
        events=("A path opens.",),
        location="The Sunken Corridor",
        memories=(),
    )
    return NarrationRequest(context, "Describe facts only.", "Engine result: A path opens.")


def _fallback_records(caplog) -> list[logging.LogRecord]:
    return [record for record in caplog.records if record.getMessage() == "narration_offline_fallback"]


def _category(record: logging.LogRecord) -> str:
    return getattr(record, "fallback_category", "")


class _RaisingProvider:
    def __init__(self, exc: BaseException):
        self.exc = exc

    async def complete(self, request: NarrationRequest) -> str:
        raise self.exc

    async def stream(self, request: NarrationRequest):
        raise self.exc
        yield ""  # pragma: no cover


@pytest.mark.parametrize(
    ("exc", "expected_category"),
    [
        (ProviderTimeoutError("timed out", provider="NVIDIA NIM"), "timeout"),
        (ProviderRateLimitError("429", provider="NVIDIA NIM", status_code=429), "rate_limited"),
    ],
)
def test_offline_fallback_logs_structured_category(caplog, exc, expected_category):
    caplog.set_level(logging.DEBUG, logger="app.ai.gateway")
    caplog.set_level(logging.DEBUG, logger="app.ai.fallback_logging")

    gateway = NarrationGateway(
        [NamedProvider("NVIDIA NIM", _RaisingProvider(exc))],
        paid_strict=True,
    )
    text, status = asyncio.run(gateway.complete(_request()))
    assert status == "fallback"
    assert text.strip()

    warnings = [r for r in _fallback_records(caplog) if r.levelno >= logging.WARNING]
    assert len(warnings) == 1
    assert _category(warnings[0]) == expected_category
    assert getattr(warnings[0], "provider", "") == "NVIDIA NIM"


def test_offline_fallback_logs_invalid_json_category(caplog):
    caplog.set_level(logging.DEBUG, logger="app.ai.gateway")
    caplog.set_level(logging.DEBUG, logger="app.ai.fallback_logging")

    class _BadJsonProvider:
        async def complete(self, request: NarrationRequest) -> str:
            try:
                json.loads("{")
            except json.JSONDecodeError as exc:
                raise ProviderServerError("Malformed response", provider="NVIDIA NIM") from exc
            return ""

    gateway = NarrationGateway(
        [NamedProvider("NVIDIA NIM", _BadJsonProvider())],
        paid_strict=True,
    )
    text, status = asyncio.run(gateway.complete(_request()))
    assert status == "fallback"
    assert text.strip()
    warnings = [r for r in _fallback_records(caplog) if r.levelno >= logging.WARNING]
    assert len(warnings) == 1
    assert _category(warnings[0]) == "invalid_json"


def test_lite_narration_emits_no_warning_fallback_logs(caplog, monkeypatch):
    caplog.set_level(logging.DEBUG)

    class _PaidProbe:
        calls = 0

        async def complete(self, request: NarrationRequest) -> str:
            self.calls += 1
            return "Paid."

        async def stream(self, request: NarrationRequest):
            raise AssertionError("unexpected")
            yield ""  # pragma: no cover

    counter = _PaidProbe()

    async def fake_paid(_settings):
        return NarrationGateway([NamedProvider("NVIDIA NIM", counter)], paid_strict=True)

    monkeypatch.setattr("app.narrator.paid_narration_gateway_for", fake_paid)
    context = _request().context
    narration, status = asyncio.run(Narrator().narrate_detailed(context, billing_tier="lite"))

    assert status == "offline"
    assert narration.strip()
    assert counter.calls == 0
    assert not any(record.levelno >= logging.WARNING for record in caplog.records)
    assert not _fallback_records(caplog)


def test_not_configured_when_normal_tier_lacks_online_provider(caplog, monkeypatch):
    caplog.set_level(logging.DEBUG, logger="app.ai.fallback_logging")
    caplog.set_level(logging.DEBUG, logger="app.narrator")

    empty_gateway = NarrationGateway([])

    def fake_gateway(_settings):
        return empty_gateway

    monkeypatch.setattr("app.narrator.paid_narration_gateway_for", fake_gateway)
    monkeypatch.setenv("LLM_PROVIDER", "nvidia")
    from app.settings import get_settings

    get_settings.cache_clear()

    narration, status = asyncio.run(
        Narrator().narrate_detailed(_request().context, billing_tier="normal")
    )
    assert status == "fallback"
    assert narration.strip()
    warnings = [r for r in _fallback_records(caplog) if r.levelno >= logging.WARNING]
    assert len(warnings) == 1
    assert _category(warnings[0]) == "not_configured"


def test_http_error_category_for_server_status(caplog):
    caplog.set_level(logging.DEBUG, logger="app.ai.fallback_logging")
    exc = ProviderServerError("502", provider="NVIDIA NIM", status_code=502)
    gateway = NarrationGateway([NamedProvider("NVIDIA NIM", _RaisingProvider(exc))], paid_strict=True)
    text, status = asyncio.run(gateway.complete(_request()))
    assert status == "fallback"
    assert text.strip()
    warnings = _fallback_records(caplog)
    assert _category(warnings[0]) == "http_error"
    assert getattr(warnings[0], "http_status", None) == 502


def test_other_category_for_connect_error(caplog):
    caplog.set_level(logging.DEBUG, logger="app.ai.fallback_logging")

    class BrokenProvider:
        async def complete(self, request: NarrationRequest) -> str:
            raise httpx.ConnectError("unavailable")

    gateway = NarrationGateway([NamedProvider("Broken", BrokenProvider())], paid_strict=True)
    text, status = asyncio.run(gateway.complete(_request()))
    assert status == "fallback"
    assert text.strip()
    warnings = _fallback_records(caplog)
    assert _category(warnings[0]) == "other"