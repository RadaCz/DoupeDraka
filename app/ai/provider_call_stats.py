"""Per HTTP call stats from a provider (usage, latency) — merged into completion meta."""

from __future__ import annotations

import contextvars
from typing import Any

_provider_call: contextvars.ContextVar[dict[str, Any] | None] = contextvars.ContextVar(
    "provider_call_stats",
    default=None,
)


def stash_provider_call_stats(**fields: Any) -> None:
    clean = {key: value for key, value in fields.items() if value is not None}
    if clean:
        _provider_call.set(clean)


def take_provider_call_stats() -> dict[str, Any]:
    stats = _provider_call.get()
    _provider_call.set(None)
    return dict(stats or {})
