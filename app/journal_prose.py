"""Strip mechanical journal lines before narrator or memory layers see them."""

from __future__ import annotations

import re

_MEMORY_PREFIXES = (
    "long-term memory:",
    "campaign memory:",
)

# Engine-mechanics the narrator already receives as structured facts.
_MECHANICAL_LINE = re.compile(
    r"^\s*(?:"
    r"(?:Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma|"
    r"Attack|Exploration|Ability|Skill|Saving throw)\s+check\b.*"
    r"|Exploration roll:.*"
    r"|Attack roll:.*"
    r"|Defeated in combat\..*"
    r"|You (?:take|catch) .*\bHP\b.*"
    r"|\d+\s+damage\b.*"
    r")",
    re.IGNORECASE,
)


def _is_memory_prefix_line(line: str) -> bool:
    lowered = line.strip().casefold()
    return any(lowered.startswith(prefix) for prefix in _MEMORY_PREFIXES)


def is_mechanical_journal_line(line: str) -> bool:
    text = line.strip()
    if not text:
        return True
    if _is_memory_prefix_line(text):
        return True
    return _MECHANICAL_LINE.match(text) is not None


def extract_prose_beat(entry: str) -> str | None:
    """Return story prose from one journal row, or None when purely mechanical."""
    raw = (entry or "").strip()
    if not raw:
        return None
    if _is_memory_prefix_line(raw):
        return None
    if "\n\n" in raw:
        prose = raw.split("\n\n", 1)[0].strip()
        remainder = raw.split("\n\n", 1)[1] if len(raw.split("\n\n", 1)) > 1 else ""
        if prose and not is_mechanical_journal_line(prose):
            return prose[:500]
        # Fall through: pick first non-mechanical line from body.
        body = remainder or raw
    else:
        body = raw
    lines = [line.strip() for line in body.splitlines() if line.strip()]
    for line in lines:
        for chunk in re.split(r"(?<=[.!?])\s+", line):
            chunk = chunk.strip()
            if chunk and not is_mechanical_journal_line(chunk):
                return chunk[:500]
    for chunk in re.split(r"(?<=[.!?])\s+", body):
        chunk = chunk.strip()
        if chunk and not is_mechanical_journal_line(chunk):
            return chunk[:500]
    return None


def narration_beats_from_journal(entries: list[str], *, limit: int = 5) -> tuple[str, ...]:
    """Previous story beats — no mechanics, prefixes, duplicates, or empties."""
    beats: list[str] = []
    seen: set[str] = set()
    for raw in entries:
        beat = extract_prose_beat(raw)
        if not beat:
            continue
        key = beat.casefold()
        if key in seen:
            continue
        seen.add(key)
        beats.append(beat)
    return tuple(beats[-limit:])


def sanitize_legacy_memory_text(text: str) -> str:
    """Project legacy memory_summary for narrator without deleting stored data."""
    raw = (text or "").strip()
    if not raw:
        return ""
    parts: list[str] = []
    for chunk in re.split(r"(?<=[.!?])\s+|\n+", raw):
        chunk = chunk.strip()
        if not chunk or is_mechanical_journal_line(chunk):
            continue
        if _is_memory_prefix_line(chunk):
            continue
        parts.append(chunk)
    if not parts:
        return ""
    return " ".join(parts)[:2000].strip()
