"""Compress archived journal beats into long_term_memory (Decision D7)."""

from __future__ import annotations

import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .db import EventRecord
from .engine.models import CharacterState
from .journal_prose import narration_beats_from_journal

logger = logging.getLogger(__name__)

ARCHIVE_EVERY_TURNS = 20
ARCHIVE_BATCH_SIZE = 10
MAX_LONG_TERM_CHARS = 4000

def should_archive_journal(turn_count: int) -> bool:
    return turn_count > 0 and turn_count % ARCHIVE_EVERY_TURNS == 0


def merge_long_term_memory(existing: str, addition: str) -> str:
    merged = f"{existing.strip()} {addition.strip()}".strip()
    if len(merged) <= MAX_LONG_TERM_CHARS:
        return merged
    return merged[-MAX_LONG_TERM_CHARS:]


def heuristic_summary(entries: list[EventRecord]) -> str:
    prose_beats = narration_beats_from_journal(
        [(row.result or row.action or "") for row in entries],
        limit=len(entries),
    )
    if not prose_beats:
        return "Earlier adventures are remembered only in broad strokes."
    text = " ".join(prose_beats)
    return text[:800]


async def summarize_entries(entries: list[EventRecord]) -> str:
    """Always offline/heuristic — journal archive must not incur paid API calls."""
    if not entries:
        return ""
    return heuristic_summary(entries)


async def maybe_archive_journal(
    session: AsyncSession,
    character_id: str,
    character: CharacterState,
) -> CharacterState:
    """Archive the oldest journal batch and fold it into long_term_memory."""
    if not should_archive_journal(character.turn_count):
        return character

    rows = (
        await session.scalars(
            select(EventRecord)
            .where(
                EventRecord.character_id == character_id,
                EventRecord.id > character.journal_archived_through_event_id,
            )
            .order_by(EventRecord.id.asc())
            .limit(ARCHIVE_BATCH_SIZE)
        )
    ).all()
    if len(rows) < ARCHIVE_BATCH_SIZE:
        return character

    summary = await summarize_entries(rows)
    character.long_term_memory = merge_long_term_memory(character.long_term_memory, summary)
    character.journal_archived_through_event_id = rows[-1].id
    logger.info(
        "Archived journal events 1-%s for character %s (through id %s)",
        len(rows),
        character_id,
        character.journal_archived_through_event_id,
    )
    return character
