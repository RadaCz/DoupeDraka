"""Drain fire-and-forget analytics before a short-lived event loop closes (pytest only)."""

from __future__ import annotations

from app.telemetry import drain_scheduled_analytics_events


async def drain_pending_asyncio_tasks() -> None:
    await drain_scheduled_analytics_events()
