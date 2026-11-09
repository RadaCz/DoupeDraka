"""Campaign memory layering — short beats vs canonical long-term recall."""

from __future__ import annotations

from .engine.models import CharacterState
from .journal_prose import sanitize_legacy_memory_text


def effective_long_term_memory(character: CharacterState) -> str:
    """Canonical long-term text for the narrator (P2).

    Primary field: ``long_term_memory`` (archived journal + durable facts).
    Legacy payloads may only have ``memory_summary`` — used only when LTM is empty
    so old saves keep working without mixing mechanical legacy dumps into new LTM.
    """
    primary = (character.long_term_memory or "").strip()
    if primary:
        return primary
    return sanitize_legacy_memory_text(character.memory_summary or "")
