"""Aggregate first-party analytics for the admin stats endpoint."""

from __future__ import annotations

import json
from collections import Counter

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from .db import AnalyticsEvent, CharacterRecord


async def aggregate_admin_stats(session: AsyncSession) -> dict:
    total_characters = await session.scalar(select(func.count()).select_from(CharacterRecord)) or 0
    death_count = await session.scalar(
        select(func.count())
        .select_from(AnalyticsEvent)
        .where(AnalyticsEvent.event_type == "death")
    ) or 0

    purchases = (
        await session.scalars(
            select(AnalyticsEvent)
            .where(AnalyticsEvent.event_type == "purchase")
            .order_by(AnalyticsEvent.id.desc())
            .limit(5000)
        )
    ).all()
    shop_counter: Counter[str] = Counter()
    for row in purchases:
        meta = json.loads(row.metadata_json or "{}")
        item = meta.get("item_name")
        if item:
            shop_counter[str(item)] += 1

    narration_rows = (
        await session.scalars(
            select(AnalyticsEvent).where(AnalyticsEvent.event_type == "llm_narration").limit(10000)
        )
    ).all()
    narration_total = len(narration_rows)
    narration_fallback = 0
    for row in narration_rows:
        meta = json.loads(row.metadata_json or "{}")
        if meta.get("status") == "fallback":
            narration_fallback += 1

    provider_fallbacks = await session.scalar(
        select(func.count())
        .select_from(AnalyticsEvent)
        .where(AnalyticsEvent.event_type == "llm_fallback_triggered")
    ) or 0

    deaths_per_character = round(death_count / total_characters, 4) if total_characters else 0.0
    llm_fallback_rate = round(narration_fallback / narration_total, 4) if narration_total else 0.0

    return {
        "total_active_characters": total_characters,
        "total_deaths": death_count,
        "average_deaths_per_character": deaths_per_character,
        "top_shop_items": [
            {"item_name": name, "purchases": count}
            for name, count in shop_counter.most_common(10)
        ],
        "llm_narration_turns": narration_total,
        "llm_narration_fallback_turns": narration_fallback,
        "llm_gateway_fallback_events": provider_fallbacks,
        "llm_fallback_rate": llm_fallback_rate,
    }
