"""Compress archived journal beats into long_term_memory (Decision D7)."""

from __future__ import annotations

import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .ai.base import NarrationContext, NarrationRequest
from .ai.registry import narration_gateway_for
from .db import EventRecord
from .engine.models import CharacterState
from .settings import get_settings

logger = logging.getLogger(__name__)

ARCHIVE_EVERY_TURNS = 20
ARCHIVE_BATCH_SIZE = 10
MAX_LONG_TERM_CHARS = 4000

SUMMARY_SYSTEM = (
    "Summarize the supplied past adventure journal into a single concise paragraph. "
    "Focus on key NPCs, active quests, important loot, and location changes. "
    "Do not invent events. Write in English."
)


def should_archive_journal(turn_count: int) -> bool:
    return turn_count > 0 and turn_count % ARCHIVE_EVERY_TURNS == 0


def merge_long_term_memory(existing: str, addition: str) -> str:
    merged = f"{existing.strip()} {addition.strip()}".strip()
    if len(merged) <= MAX_LONG_TERM_CHARS:
        return merged
    return merged[-MAX_LONG_TERM_CHARS:]


def heuristic_summary(entries: list[EventRecord]) -> str:
    parts = []
    for row in entries:
        snippet = (row.result or row.action).replace("\n", " ").strip()
        if snippet:
            parts.append(snippet[:160])
    text = " ".join(parts)
    return text[:800] if text else "Earlier adventures are remembered only in broad strokes."


async def summarize_entries(entries: list[EventRecord]) -> str:
    if not entries:
        return ""
    lines = []
    for row in entries:
        lines.append(f"Action: {row.action}\nJournal:\n{(row.result or '')[:900]}")
    user_prompt = "\n\n---\n\n".join(lines)
    gateway = narration_gateway_for(get_settings())
    request = NarrationRequest(
        context=NarrationContext(
            action="summarize journal",
            events=(),
            location="",
            memories=(),
            verbose=False,
        ),
        system_prompt=SUMMARY_SYSTEM,
        user_prompt=user_prompt,
    )
    if gateway.has_online_providers:
        try:
            text, status = await gateway.complete(request)
            if status == "narrated" and text.strip():
                return text.strip()
        except Exception:
            logger.exception("LLM journal summarization failed; using heuristic summary")
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
