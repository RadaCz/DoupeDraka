"""turn_billing analytics metadata (E5)."""

import asyncio
from unittest.mock import patch

import pytest

from app import telemetry
from app.ai.base import NarrationContext
from app.api import reconcile_narrator_billing
from app.schemas import ActionResponse


@pytest.mark.asyncio
async def test_reconcile_records_turn_billing_for_lite_offline():
    captured: list[dict] = []

    def _capture(event_type, character_id=None, metadata=None):
        if event_type == "turn_billing":
            captured.append(metadata or {})

    with patch.object(telemetry, "schedule_analytics_event", side_effect=_capture):
        response = ActionResponse(
            events=["You explore."],
            narration="Mechanical line.",
            character={},
            narration_status="offline",
            energy_tenths=1000,
            energy=100.0,
        )
        await reconcile_narrator_billing(
            user_id=1,
            stored_tier="lite",
            billing_tier="lite",
            charged_tenths=0,
            narration_status="offline",
            action_detail="explore",
            character_id="c1",
            state_changed=True,
            receipt_key="",
            response=response,
        )

    assert len(captured) == 1
    row = captured[0]
    assert row["billing_tier"] == "lite"
    assert row["stored_tier"] == "lite"
    assert row["narration_status"] == "offline"
    assert row["energy_charged_tenths"] == 0
    assert row["energy_refunded_tenths"] == 0


@pytest.mark.asyncio
async def test_lite_narrator_uses_offline_status():
    from app.narrator import Narrator

    context = NarrationContext(
        location="The Whispering Cellar",
        action="explore",
        events=("You scout ahead.",),
        memories=(),
        tone="balanced",
        humor="rare",
        verbose=False,
        language="en",
    )
    narration, status = await Narrator().narrate_detailed(context, billing_tier="lite")
    assert narration.strip()
    assert status == "offline"
