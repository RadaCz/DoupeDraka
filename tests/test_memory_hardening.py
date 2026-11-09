"""P2.1 memory hardening — legacy sanitization and journal prose extraction."""

from __future__ import annotations

import asyncio

import pytest

from app.api import build_narration_context
from app.campaign_memory import effective_long_term_memory
from app.db import EventRecord
from app.engine.models import CharacterState
from app.journal_prose import narration_beats_from_journal, sanitize_legacy_memory_text
from app.memory_summarizer import summarize_entries
from app.narrator import Narrator


def test_legacy_story_only_memory_summary_preserved():
    character = CharacterState("c1", 1, "H", "human", "fighter")
    character.memory_summary = "Caldus thanked the hero and asked about the bell."
    assert "Caldus" in effective_long_term_memory(character)


def test_legacy_mechanical_dump_stripped_from_narrator_view():
    character = CharacterState("c1", 1, "H", "human", "fighter")
    character.memory_summary = (
        "Exploration roll: 4 on a d6. You find gold. "
        "Charisma check: 15 vs DC 12 — success."
    )
    projected = effective_long_term_memory(character)
    assert "Exploration roll" not in projected
    assert "Charisma check" not in projected
    assert "You find gold" in projected


def test_empty_ltm_empty_legacy_fallback_is_empty():
    character = CharacterState("c1", 1, "H", "human", "fighter")
    assert effective_long_term_memory(character) == ""


def test_nonempty_ltm_ignores_legacy_even_if_dirty():
    character = CharacterState("c1", 1, "H", "human", "fighter")
    character.long_term_memory = "Mara warned of danger in the corridor."
    character.memory_summary = "Attack roll: 18 vs AC 13."
    assert effective_long_term_memory(character) == "Mara warned of danger in the corridor."


def test_beats_multi_entries_no_blank_lines():
    entries = ["", "  ", "The door creaks.", "Nib haggles over a charm."]
    beats = narration_beats_from_journal(entries)
    assert beats == ("The door creaks.", "Nib haggles over a charm.")


def test_beats_strip_mechanics_between_story_lines():
    journal = "You greet Caldus.\n\nCharisma check: 14 vs DC 12 — success."
    beats = narration_beats_from_journal([journal])
    assert beats == ("You greet Caldus.",)


def test_beats_single_paragraph_without_blank_line_separator():
    journal = "You greet Caldus. Charisma check: 14 vs DC 12 — success."
    beats = narration_beats_from_journal([journal])
    assert beats == ("You greet Caldus.",)


def test_beats_dedupe_and_drop_empty():
    beats = narration_beats_from_journal(
        ["The same beat.", "The same beat.", "Exploration roll: 2 on a d6."]
    )
    assert beats == ("The same beat.",)


def test_beats_drop_memory_prefix_lines():
    beats = narration_beats_from_journal([
        "Long-term memory: secret vault coordinates",
        "A quiet moment at the shrine.",
    ])
    assert beats == ("A quiet moment at the shrine.",)


def test_archive_summary_uses_prose_only():
    rows = [
        EventRecord(id=1, character_id="c1", action="look", result="Torches flicker.\n\nExploration roll: 3."),
        EventRecord(id=2, character_id="c1", action="talk", result="Caldus bows."),
    ]
    summary = asyncio.run(summarize_entries(rows))
    assert "Exploration roll" not in summary
    assert "Caldus" in summary


def test_archive_preserves_story_order():
    rows = [
        EventRecord(id=1, character_id="c1", action="a", result="First beat."),
        EventRecord(id=2, character_id="c1", action="b", result="Second beat."),
    ]
    summary = asyncio.run(summarize_entries(rows))
    assert summary.index("First") < summary.index("Second")


def test_lite_narration_stays_offline(monkeypatch):
    from app.ai.gateway import NarrationGateway
    from app.ai.gateway import NamedProvider

    class _Paid:
        async def complete(self, request):
            raise AssertionError("lite must not call paid provider")

    gateway = NarrationGateway([NamedProvider("Paid", _Paid())])
    monkeypatch.setattr("app.narrator.paid_narration_gateway_for", lambda _s: gateway)

    context = build_narration_context(
        CharacterState("c1", 1, "H", "human", "fighter"),
        "look",
        ("You look.",),
        [],
    )

    async def run():
        return await Narrator().narrate_detailed(context, billing_tier="lite")

    text, status = asyncio.run(run())
    assert status == "offline"
    assert text.strip()


@pytest.mark.asyncio
async def test_normal_billing_refunds_on_fallback(monkeypatch):
    """Contract: fallback status must not equal narrated for billing reconcile."""
    from app.api import reconcile_narrator_billing
    from app.schemas import ActionResponse

    response = ActionResponse(
        events=["You look."],
        narration="Offline fallback.",
        character={},
        energy_tenths=990,
        energy=99.0,
        tier="normal",
        narration_status="fallback",
    )

    class _User:
        id = 1

    from unittest.mock import AsyncMock, MagicMock

    refunded = []

    async def fake_refund(session, user_id, tenths, detail):
        refunded.append(tenths)
        return 1000

    monkeypatch.setattr("app.api.atomic_refund_energy", fake_refund)
    monkeypatch.setattr("app.api.Session", lambda: AsyncMock(__aenter__=AsyncMock(return_value=MagicMock(commit=AsyncMock()))))

    await reconcile_narrator_billing(
        user_id=1,
        stored_tier="normal",
        billing_tier="normal",
        charged_tenths=10,
        narration_status="fallback",
        action_detail="look",
        character_id="c1",
        state_changed=True,
        receipt_key="",
        response=response,
    )
    assert refunded == [10]


def test_narrator_system_prompt_gets_sanitized_legacy_only():
    character = CharacterState("c1", 1, "H", "human", "fighter")
    character.memory_summary = "Met Mara by the water. Dexterity check: 10 vs DC 12 — failure."
    ctx = build_narration_context(character, "look", ("You look.",), ["Prior beat."])
    prompt = Narrator.system_prompt(ctx)
    assert "Long-term campaign memory:" in prompt
    assert "Met Mara" in prompt
    assert "10 vs DC 12" not in prompt


def test_sanitize_preserves_mixed_story_and_noise():
    text = "Bell returned to Caldus. Attack roll: 19. Caldus smiled."
    clean = sanitize_legacy_memory_text(text)
    assert "Bell returned" in clean
    assert "Caldus smiled" in clean
    assert "Attack roll" not in clean
