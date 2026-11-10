"""Detect likely English prose when Czech narration was requested (telemetry only)."""

from __future__ import annotations

import logging
import re

from .narration_language import normalize_narration_language
from .telemetry import schedule_analytics_event

logger = logging.getLogger(__name__)

_ENGLISH_STOP_WORDS = frozenset({
    "the", "and", "you", "your", "with", "for", "that", "this", "are", "was", "have",
    "had", "from", "into", "their", "they", "what", "when", "take", "long", "rest",
})


def prose_looks_english(text: str) -> bool:
    """Simple heuristic for small models ignoring Czech instructions."""
    words = re.findall(r"[a-z']+", text.lower())
    if len(words) < 5:
        return False
    hits = sum(1 for word in words if word in _ENGLISH_STOP_WORDS)
    return (hits / len(words)) >= 0.14


def coerce_narration_prose(context, prose: str) -> str:
    """When Czech was requested, replace English-looking LLM prose with offline CS fallback."""
    from .ai.base import NarrationContext

    if not isinstance(context, NarrationContext):
        return prose
    expected = normalize_narration_language(context.language)
    trimmed = prose.strip()
    if not trimmed or expected != "cs":
        return prose
    if not prose_looks_english(trimmed):
        return prose
    from .narrator import Narrator

    fallback = Narrator.narrate_offline(context).strip()
    if fallback:
        maybe_record_prose_language_mismatch(context.language, trimmed, None)
        return fallback
    return prose


def maybe_record_prose_language_mismatch(
    language_code: str | None,
    prose: str,
    character_id: str | None,
) -> None:
    expected = normalize_narration_language(language_code)
    if expected != "cs" or not prose.strip():
        return
    if not prose_looks_english(prose):
        return
    sample = prose.strip()[:160]
    logger.warning(
        "Narration prose looks English while language=cs (character=%s): %s",
        character_id,
        sample,
    )
    schedule_analytics_event(
        "narration_language_mismatch",
        character_id,
        {"expected": "cs", "sample": sample},
    )
