"""First-party analytics: small JSON events, no blocking on the hot path."""

from __future__ import annotations

import asyncio
import json
import logging
import os
import weakref
from collections.abc import Iterable
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from .db import AnalyticsEvent, Session
from .engine.models import TurnResult
from .narration_events import DEFEAT_EVENT_PREFIX

logger = logging.getLogger(__name__)

# Pytest only: track tasks per event loop so drains never cross loops.
_loop_analytics_tasks: weakref.WeakKeyDictionary[
    asyncio.AbstractEventLoop,
    set[asyncio.Task[None]],
] = weakref.WeakKeyDictionary()


def _metadata(data: dict[str, Any]) -> dict[str, Any]:
    return dict(data)


def analytics_rows_from_turn(
    character_id: str,
    result: TurnResult,
    *,
    location: str,
    monster_name: str | None,
) -> list[AnalyticsEvent]:
    """Derive analytics events from a resolved engine turn (same transaction as the turn)."""
    rows: list[AnalyticsEvent] = []

    if result.level_up_facts and result.level_up_facts.get("new_level") is not None:
        rows.append(
            AnalyticsEvent(
                event_type="level_up",
                character_id=character_id,
                metadata_json=_metadata({"new_level": result.level_up_facts.get("new_level")}),
            )
        )

    if result.purchase_facts:
        rows.append(
            AnalyticsEvent(
                event_type="purchase",
                character_id=character_id,
                metadata_json=_metadata(result.purchase_facts),
            )
        )

    if any(event.startswith(DEFEAT_EVENT_PREFIX) for event in result.events):
        rows.append(
            AnalyticsEvent(
                event_type="death",
                character_id=character_id,
                metadata_json=_metadata(
                    {"location": location, "monster_name": monster_name or "unknown"},
                ),
            )
        )

    return rows


def append_analytics(session: AsyncSession, rows: Iterable[AnalyticsEvent]) -> None:
    for row in rows:
        session.add(row)


async def _persist_analytics_event(
    event_type: str,
    character_id: str | None,
    metadata: dict[str, Any] | None,
) -> None:
    try:
        async with Session() as session:
            session.add(
                AnalyticsEvent(
                    event_type=event_type,
                    character_id=character_id,
                    metadata_json=_metadata(metadata or {}),
                )
            )
            await session.commit()
    except Exception:
        logger.exception("Failed to persist analytics event %s", event_type)


def schedule_analytics_event(
    event_type: str,
    character_id: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> None:
    """Fire-and-forget insert so narration fallback never blocks the turn commit."""
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        return
    task = loop.create_task(_persist_analytics_event(event_type, character_id, metadata))
    if os.environ.get("DOUPE_TEST_DB", "").strip() == "1":
        _loop_analytics_tasks.setdefault(loop, set()).add(task)


async def drain_scheduled_analytics_events() -> None:
    """Wait for in-flight scheduled analytics on the active loop (pytest / TestClient)."""
    loop = asyncio.get_running_loop()
    bucket = _loop_analytics_tasks.get(loop)
    if not bucket:
        return
    pending = [task for task in list(bucket) if not task.done()]
    if pending:
        await asyncio.gather(*pending, return_exceptions=True)
    for finished in [task for task in list(bucket) if task.done()]:
        bucket.discard(finished)


def record_character_created(session: AsyncSession, character_id: str, race: str, character_class: str) -> None:
    session.add(
        AnalyticsEvent(
            event_type="character_created",
            character_id=character_id,
            metadata_json=_metadata({"race": race, "character_class": character_class}),
        )
    )


def record_llm_fallback(
    failed_provider: str,
    fallback_provider: str,
    character_id: str | None = None,
    *,
    error_kind: str = "",
) -> None:
    metadata: dict[str, Any] = {
        "failed_provider": failed_provider,
        "fallback_provider": fallback_provider,
    }
    if error_kind:
        metadata["error_kind"] = error_kind
    schedule_analytics_event("llm_fallback_triggered", character_id, metadata)


def record_llm_provider_usage(
    character_id: str | None,
    *,
    provider: str,
    model: str,
    narration_status: str,
    delivered_to_player: bool,
    latency_ms: int | None = None,
    prompt_tokens: int | None = None,
    completion_tokens: int | None = None,
    total_tokens: int | None = None,
    provider_request_status: str = "",
    fallback_reason: str = "",
) -> None:
    """Provider call telemetry — tokens only when the API returned them."""
    metadata: dict[str, Any] = {
        "provider": provider,
        "model": model,
        "narration_status": narration_status,
        "delivered_to_player": delivered_to_player,
    }
    if latency_ms is not None:
        metadata["latency_ms"] = latency_ms
    if prompt_tokens is not None:
        metadata["prompt_tokens"] = prompt_tokens
    if completion_tokens is not None:
        metadata["completion_tokens"] = completion_tokens
    if total_tokens is not None:
        metadata["total_tokens"] = total_tokens
    if provider_request_status:
        metadata["provider_request_status"] = provider_request_status
    if fallback_reason:
        metadata["fallback_reason"] = fallback_reason
    schedule_analytics_event("llm_provider_usage", character_id, metadata)


def narration_status_with_delivery(
    status: str,
    *,
    provider: str | None = None,
    model: str | None = None,
) -> dict[str, str]:
    """Merge delivery metadata for turn_billing / analytics consumers."""
    payload: dict[str, str] = {"narration_status": status}
    if provider:
        payload["narration_provider"] = provider
    if model:
        payload["narration_model"] = model
    return payload


def record_llm_narration_status(
    character_id: str | None,
    status: str,
    *,
    provider: str | None = None,
    model: str | None = None,
) -> None:
    metadata: dict[str, Any] = {"status": status}
    if provider:
        metadata["provider"] = provider
    if model:
        metadata["model"] = model
    schedule_analytics_event("llm_narration", character_id, metadata)


def record_turn_billing(
    character_id: str | None,
    *,
    billing_tier: str,
    stored_tier: str,
    state_changed: bool,
    narration_status: str,
    energy_charged_tenths: int,
    energy_refunded_tenths: int = 0,
    narration_provider: str | None = None,
    narration_model: str | None = None,
) -> None:
    """Minimal playtest telemetry (GDS01 E5 scope)."""
    metadata: dict[str, Any] = {
        "billing_tier": billing_tier,
        "stored_tier": stored_tier,
        "state_changed": state_changed,
        "narration_status": narration_status,
        "energy_charged_tenths": energy_charged_tenths,
        "energy_refunded_tenths": energy_refunded_tenths,
    }
    if narration_provider:
        metadata["narration_provider"] = narration_provider
    if narration_model:
        metadata["narration_model"] = narration_model
    schedule_analytics_event("turn_billing", character_id, metadata)
