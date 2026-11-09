"""Per-request metadata for which LLM provider actually delivered narration."""

from __future__ import annotations

import contextvars
from dataclasses import dataclass

_completion_meta: contextvars.ContextVar["CompletionMeta | None"] = contextvars.ContextVar(
    "narration_completion_meta",
    default=None,
)


@dataclass(frozen=True)
class CompletionMeta:
    provider: str
    model: str = ""
    latency_ms: int | None = None
    prompt_tokens: int | None = None
    completion_tokens: int | None = None
    total_tokens: int | None = None
    provider_request_status: str = ""
    fallback_reason: str = ""
    delivered_to_player: bool = False


def set_completion_meta(
    provider: str,
    model: str = "",
    *,
    call_stats: dict | None = None,
    provider_request_status: str = "",
    fallback_reason: str = "",
    delivered_to_player: bool = False,
) -> None:
    stats = dict(call_stats or {})
    _completion_meta.set(
        CompletionMeta(
            provider=provider,
            model=model,
            latency_ms=stats.get("latency_ms"),
            prompt_tokens=stats.get("prompt_tokens"),
            completion_tokens=stats.get("completion_tokens"),
            total_tokens=stats.get("total_tokens"),
            provider_request_status=provider_request_status or stats.get("provider_request_status", ""),
            fallback_reason=fallback_reason or str(stats.get("fallback_reason") or ""),
            delivered_to_player=delivered_to_player,
        )
    )


def take_completion_meta() -> CompletionMeta | None:
    meta = _completion_meta.get()
    _completion_meta.set(None)
    return meta


def model_for_provider(provider: object, fallback_name: str) -> str:
    """Best-effort model id for telemetry (no secrets)."""
    model = getattr(provider, "model", None)
    if isinstance(model, str) and model.strip():
        return model.strip()
    return fallback_name
