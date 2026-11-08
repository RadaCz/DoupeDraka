"""First-party analytics: small JSON events, no blocking on the hot path."""

from __future__ import annotations

import asyncio
import json
import logging
from collections.abc import Iterable
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from .db import AnalyticsEvent, Session
from .engine.models import TurnResult
from .narration_events import DEFEAT_EVENT_PREFIX

logger = logging.getLogger(__name__)


def _encode_metadata(data: dict[str, Any]) -> str:
    return json.dumps(data, ensure_ascii=False, separators=(",", ":"))


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
                metadata_json=_encode_metadata(
                    {"new_level": result.level_up_facts.get("new_level")},
                ),
            )
        )

    if result.purchase_facts:
        rows.append(
            AnalyticsEvent(
                event_type="purchase",
                character_id=character_id,
                metadata_json=_encode_metadata(result.purchase_facts),
            )
        )

    if any(event.startswith(DEFEAT_EVENT_PREFIX) for event in result.events):
        rows.append(
            AnalyticsEvent(
                event_type="death",
                character_id=character_id,
                metadata_json=_encode_metadata(
                    {
                        "location": location,
                        "monster_name": monster_name or "unknown",
                    },
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
                    metadata_json=_encode_metadata(metadata or {}),
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
    loop.create_task(_persist_analytics_event(event_type, character_id, metadata))


def record_character_created(session: AsyncSession, character_id: str, race: str, character_class: str) -> None:
    session.add(
        AnalyticsEvent(
            event_type="character_created",
            character_id=character_id,
            metadata_json=_encode_metadata({"race": race, "character_class": character_class}),
        )
    )


def record_llm_fallback(failed_provider: str, fallback_provider: str, character_id: str | None = None) -> None:
    schedule_analytics_event(
        "llm_fallback_triggered",
        character_id,
        {"failed_provider": failed_provider, "fallback_provider": fallback_provider},
    )


def record_llm_narration_status(character_id: str | None, status: str) -> None:
    schedule_analytics_event(
        "llm_narration",
        character_id,
        {"status": status},
    )
