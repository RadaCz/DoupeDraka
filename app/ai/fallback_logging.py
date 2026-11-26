"""Structured logs when narration falls back to the offline storyteller."""

from __future__ import annotations

import json
import logging
from typing import Any

import httpx

from .errors import (
    ProviderError,
    ProviderRateLimitError,
    ProviderServerError,
    ProviderTimeoutError,
)

logger = logging.getLogger(__name__)

_LOG_MESSAGE = "narration_offline_fallback"


def llm_narration_intentionally_disabled(provider_setting: str) -> bool:
    """True when settings deliberately skip external LLM (Lite-like / fallback mode)."""
    return provider_setting.strip().lower() in ("fallback", "offline", "")


def classify_provider_failure(exc: BaseException | None) -> tuple[str, dict[str, Any]]:
    """Map an exception to (category, optional structured fields)."""
    if exc is None:
        return "other", {"exception_type": "none"}

    if isinstance(exc, ProviderTimeoutError) or isinstance(exc, httpx.TimeoutException):
        return "timeout", {"exception_type": type(exc).__name__}

    if isinstance(exc, ProviderRateLimitError) or (
        isinstance(exc, ProviderError) and exc.status_code == 429
    ):
        return "rate_limited", _http_fields(exc)

    if isinstance(exc, json.JSONDecodeError):
        return "invalid_json", {"exception_type": type(exc).__name__}

    if isinstance(exc, (KeyError, IndexError, TypeError, ValueError)):
        return "schema_invalid", {"exception_type": type(exc).__name__}

    if isinstance(exc, ProviderError):
        if exc.status_code is not None:
            if exc.status_code >= 500:
                return "http_error", _http_fields(exc)
            if exc.status_code != 429:
                return "http_error", _http_fields(exc)
        if isinstance(exc, ProviderServerError):
            cause = exc.__cause__
            if isinstance(cause, json.JSONDecodeError):
                return "invalid_json", {"exception_type": type(cause).__name__}
            if isinstance(cause, (KeyError, IndexError, TypeError, ValueError)):
                return "schema_invalid", {"exception_type": type(cause).__name__}
            if "malformed" in str(exc).lower():
                return "schema_invalid", {"exception_type": type(exc).__name__}
            if exc.status_code is not None:
                return "http_error", _http_fields(exc)
        return "other", {"exception_type": type(exc).__name__, **_http_fields(exc)}

    if isinstance(exc, httpx.HTTPStatusError):
        status = exc.response.status_code
        if status == 429:
            return "rate_limited", {"http_status": status, "exception_type": type(exc).__name__}
        return "http_error", {"http_status": status, "exception_type": type(exc).__name__}

    return "other", {"exception_type": type(exc).__name__}


def _http_fields(exc: BaseException) -> dict[str, Any]:
    fields: dict[str, Any] = {"exception_type": type(exc).__name__}
    status = getattr(exc, "status_code", None)
    if isinstance(status, int):
        fields["http_status"] = status
    return fields


def log_offline_fallback(
    *,
    category: str,
    provider: str,
    fields: dict[str, Any] | None = None,
) -> None:
    """Warning-level structured log when an online provider failed into offline prose."""
    payload: dict[str, Any] = {
        "fallback_category": category,
        "provider": provider,
    }
    if fields:
        payload.update({key: value for key, value in fields.items() if value is not None})
    logger.warning(_LOG_MESSAGE, extra=payload)


def log_offline_fallback_from_exception(*, provider: str, exc: BaseException | None) -> None:
    category, fields = classify_provider_failure(exc)
    log_offline_fallback(category=category, provider=provider, fields=fields)


def log_offline_not_configured(*, provider: str, detail: str = "no_online_provider") -> None:
    log_offline_fallback(category="not_configured", provider=provider, fields={"detail": detail})


def log_offline_builtin(*, billing_tier: str) -> None:
    """Lite or deliberately offline narration — informational only."""
    logger.info(
        "narration_offline_builtin billing_tier=%s",
        billing_tier,
        extra={"billing_tier": billing_tier, "fallback_category": "offline_builtin"},
    )