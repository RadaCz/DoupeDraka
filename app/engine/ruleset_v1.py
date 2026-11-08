"""Locked MVP ruleset scope (SRD 5.1 compatible). Etapa 3."""

from __future__ import annotations

RULESET_EDITION = "SRD 5.1"
RULESET_LABEL = "DoupěDraka Ruleset v1"
MAX_MVP_LEVEL = 5

MVP_RACES: frozenset[str] = frozenset({"human", "elf", "dwarf", "halfling"})
MVP_CLASSES: frozenset[str] = frozenset({"fighter", "rogue", "cleric", "wizard"})


def race_mvp_playable(key: str) -> bool:
    return key in MVP_RACES


def class_mvp_playable(key: str) -> bool:
    return key in MVP_CLASSES


def validate_mvp_creation(race: str, character_class: str) -> None:
    if not race_mvp_playable(race):
        raise ValueError(
            f"Race '{race}' is reference-only in Ruleset v1. "
            f"Playable: {', '.join(sorted(MVP_RACES))}."
        )
    if not class_mvp_playable(character_class):
        raise ValueError(
            f"Class '{character_class}' is reference-only in Ruleset v1. "
            f"Playable: {', '.join(sorted(MVP_CLASSES))}."
        )


def public_summary() -> dict:
    return {
        "edition": RULESET_EDITION,
        "label": RULESET_LABEL,
        "max_level": MAX_MVP_LEVEL,
        "mvp_races": sorted(MVP_RACES),
        "mvp_classes": sorted(MVP_CLASSES),
        "notes": (
            "Reference catalogs may list additional SRD entries; only mvp_* options "
            "are fully supported in chapter 1. Subclass and lineage picks are flavor text."
        ),
    }
