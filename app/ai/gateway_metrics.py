"""In-process LLM gateway hit counters (single-worker / load-test visibility)."""

from __future__ import annotations

from collections import Counter
from threading import Lock

_lock = Lock()
_hits: Counter[str] = Counter()
_fallbacks: Counter[str] = Counter()


def record_provider_success(provider: str) -> None:
    with _lock:
        _hits[provider] += 1


def record_fallback(failed: str, fallback: str) -> None:
    with _lock:
        _fallbacks[f"{failed}->{fallback}"] += 1


def snapshot() -> dict:
    with _lock:
        return {
            "provider_hits": dict(_hits),
            "fallback_paths": dict(_fallbacks),
        }


def reset() -> None:
    with _lock:
        _hits.clear()
        _fallbacks.clear()
