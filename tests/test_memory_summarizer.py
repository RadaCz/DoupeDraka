import asyncio

import pytest

from app.db import EventRecord
from app.engine.models import CharacterState
from app.memory_summarizer import (
    ARCHIVE_BATCH_SIZE,
    ARCHIVE_EVERY_TURNS,
    maybe_archive_journal,
    merge_long_term_memory,
    should_archive_journal,
    summarize_entries,
)


def test_should_archive_every_twentieth_turn():
    assert not should_archive_journal(19)
    assert should_archive_journal(20)
    assert should_archive_journal(40)


def test_merge_long_term_memory_truncates():
    text = merge_long_term_memory("alpha", "beta" * 2000)
    assert len(text) <= 4000
    assert "beta" in text


def test_summarize_entries_is_heuristic_only():
    from datetime import datetime

    rows = [
        EventRecord(id=1, character_id="c1", action="a", result="Story.\n\nMechanics.", created_at=datetime.utcnow())
    ]
    summary = asyncio.run(summarize_entries(rows))
    assert "Story" in summary
    assert "Mechanics" not in summary


def test_summarize_entries_heuristic_without_providers(monkeypatch):
    from datetime import datetime

    rows = [
        EventRecord(
            id=1,
            character_id="c1",
            action="explore",
            result="You find a hidden latch.",
            created_at=datetime.utcnow(),
        ),
        EventRecord(
            id=2,
            character_id="c1",
            action="talk",
            result="Nib mentions a stolen bell.",
            created_at=datetime.utcnow(),
        ),
    ]
    summary = asyncio.run(summarize_entries(rows))
    assert "latch" in summary
    assert "bell" in summary


def test_archive_constants_align_with_spec():
    assert ARCHIVE_EVERY_TURNS == 20
    assert ARCHIVE_BATCH_SIZE == 10


def test_maybe_archive_updates_character(monkeypatch):
    character = CharacterState("c1", 1, "Hero", "human", "fighter")
    character.turn_count = ARCHIVE_EVERY_TURNS
    batch = [
        EventRecord(id=index, character_id="c1", action="explore", result=f"Beat {index}")
        for index in range(1, ARCHIVE_BATCH_SIZE + 1)
    ]

    class FakeScalarResult:
        def all(self):
            return batch

    class FakeSession:
        async def scalars(self, stmt):
            return FakeScalarResult()

    async def fake_summarize(entries):
        assert len(entries) == ARCHIVE_BATCH_SIZE
        return "Caldus wants the shrine bell returned."

    monkeypatch.setattr("app.memory_summarizer.summarize_entries", fake_summarize)

    updated = asyncio.run(maybe_archive_journal(FakeSession(), character.id, character))
    assert "shrine bell" in updated.long_term_memory
    assert updated.journal_archived_through_event_id == ARCHIVE_BATCH_SIZE
