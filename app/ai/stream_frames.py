"""Markers passed through narration streams (gateway → narrator → SSE)."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class StreamReplaceFrame:
    """Replace all client-buffered stream text with a single fallback narration."""

    narration: str
