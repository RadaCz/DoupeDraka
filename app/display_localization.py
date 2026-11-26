"""Chapter One presentation names for offline narration (engine IDs unchanged)."""

from __future__ import annotations

import json
import logging
import re
from functools import lru_cache
from pathlib import Path
from typing import Literal

logger = logging.getLogger(__name__)

_CATALOG_PATH = Path(__file__).resolve().parent.parent / "localization" / "chapter_one_display.json"

LocationCase = Literal["nom", "gen", "dat", "acc", "loc", "ins"]

_EMPTY_CATALOG: dict = {}


@lru_cache(maxsize=1)
def _catalog() -> dict:
    try:
        return json.loads(_CATALOG_PATH.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError, OSError) as exc:
        logger.warning(
            "Chapter display catalog missing or invalid at %s: %s",
            _CATALOG_PATH,
            exc,
        )
        return dict(_EMPTY_CATALOG)


def _location_entry(name: str) -> dict | str | None:
    return _catalog().get("locations", {}).get(name.strip())


def display_location(name: str, language: str, case: LocationCase = "nom") -> str:
    if language != "cs" or not name.strip():
        return name
    entry = _location_entry(name)
    if entry is None:
        return name
    if isinstance(entry, str):
        return entry
    return entry.get(case) or entry.get("nom") or name


def display_location_in(name: str, language: str) -> str:
    """Czech prepositional phrase for „where“ (v/ve/na/u…)."""
    if language != "cs" or not name.strip():
        return display_location(name, language)
    entry = _location_entry(name)
    if isinstance(entry, dict) and entry.get("in_cs"):
        return str(entry["in_cs"])
    loc = display_location(name, "cs", "loc")
    return f"v {loc}" if loc else name


def display_location_gen_cs(name: str, language: str) -> str:
    """Genitiv lokace pro lead („Známé stěny {gen_cs} …“), velké počáteční písmeno."""
    if language != "cs" or not name.strip():
        return display_location(name, language, "gen")
    entry = _location_entry(name)
    if isinstance(entry, dict) and entry.get("gen_cs"):
        return str(entry["gen_cs"])
    gen = display_location(name, "cs", "gen")
    if not gen:
        return gen
    return gen[0].upper() + gen[1:] if gen[0].islower() else gen


def display_location_to(name: str, language: str) -> str:
    """Czech prepositional phrase for motion „toward“ (do/na/k…)."""
    if language != "cs" or not name.strip():
        return display_location(name, language)
    entry = _location_entry(name)
    if isinstance(entry, dict) and entry.get("to_cs"):
        return str(entry["to_cs"])
    gen = display_location(name, "cs", "gen")
    return f"do {gen}" if gen else name


def display_quest_hint(step_id: str, language: str) -> str | None:
    if language != "cs" or not step_id.strip():
        return None
    return _catalog().get("quest_hints_cs", {}).get(step_id.strip())


def display_npc(name: str, language: str) -> str:
    if language != "cs" or not name.strip():
        return name
    return _catalog().get("npcs", {}).get(name.strip(), name)


def display_creature(name: str, language: str) -> str:
    if language != "cs" or not name.strip():
        return name
    creatures = _catalog().get("creatures", {})
    key = name.strip()
    return creatures.get(key) or creatures.get(key.title()) or name


def display_item(name: str, language: str) -> str:
    if language != "cs" or not name.strip():
        return name
    return _catalog().get("items", {}).get(name.strip().lower(), name)


def display_spell(name: str, language: str) -> str:
    if language != "cs" or not name.strip():
        return name
    return _catalog().get("spells", {}).get(name.strip(), name)


def display_arrival_beat(beat: str, language: str) -> str:
    """CS arrival flavor for map UI; engine keeps English canonical beat."""
    if language != "cs" or not beat.strip():
        return beat
    return _catalog().get("arrival_beats_cs", {}).get(beat.strip(), beat)


def embed_catalog_names(text: str, language: str) -> str:
    """Replace known English catalog tokens inside Czech prose (longest first)."""
    if language != "cs" or not text.strip():
        return text
    out = text
    cat = _catalog()
    locations = cat.get("locations", {})
    loc_pairs: list[tuple[str, str]] = []
    for en, val in locations.items():
        if isinstance(val, dict):
            loc_pairs.append((en, val.get("nom", en)))
        else:
            loc_pairs.append((en, str(val)))
    loc_pairs.sort(key=lambda kv: len(kv[0]), reverse=True)
    for en, cs in loc_pairs:
        out = re.sub(re.escape(en), cs, out, flags=re.IGNORECASE if en[0].islower() else 0)

    for bucket in ("creatures", "spells", "items"):
        entries = sorted(cat.get(bucket, {}).items(), key=lambda kv: len(kv[0]), reverse=True)
        for en, cs in entries:
            if bucket in ("items", "creatures"):
                pattern = re.compile(rf"\b{re.escape(en)}\b", re.IGNORECASE)
            else:
                pattern = re.compile(re.escape(en), re.IGNORECASE if bucket == "spells" else 0)
            out = pattern.sub(cs, out)
    return out


def catalog_for_tests() -> dict:
    """Expose raw catalog for parity tests."""
    return _catalog()


def location_cases_for_tests(name: str) -> dict[str, str] | None:
    entry = _location_entry(name)
    if isinstance(entry, dict):
        return {k: v for k, v in entry.items() if isinstance(v, str)}
    return None
