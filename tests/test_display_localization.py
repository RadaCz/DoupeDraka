"""Backend display catalog parity with shared chapter_one JSON."""

import json
from pathlib import Path

from app.display_localization import (
    catalog_for_tests,
    display_creature,
    display_location,
    display_spell,
)
from app.ai.offline_prose import combat_opening_prose
from app.ai.base import NarrationContext

_CATALOG_PATH = Path(__file__).resolve().parent.parent / "localization" / "chapter_one_display.json"


def test_catalog_file_loads():
    data = json.loads(_CATALOG_PATH.read_text(encoding="utf-8"))
    assert data["locations"]["The Sunken Corridor"] == "Potopená chodba"
    assert catalog_for_tests()["creatures"]["Goblin scout"] == "Gobliní zvěd"


def test_display_location_and_creature_cs():
    assert display_location("The Sunken Corridor", "cs") == "Potopená chodba"
    assert display_creature("Goblin scout", "cs") == "Gobliní zvěd"
    assert display_location("Unknown Place", "cs") == "Unknown Place"


def test_spell_presentation_cs():
    assert display_spell("Cure Wounds", "cs") == "Léčení ran"
    assert display_spell("Fire Bolt", "en") == "Fire Bolt"


def test_combat_opening_cs_uses_localized_names():
    ctx = NarrationContext(
        action="search",
        events=(
            "An enemy appears: Goblin scout (7 HP).",
            "Initiative: you 14 (DEX), Goblin scout 11 (DEX). Your turn first.",
        ),
        location="The Sunken Corridor",
        memories=(),
        scene_kind="combat",
        scene_dossier={
            "location": {"name": "The Sunken Corridor", "atmosphere": "Damp stone."},
        },
        language="cs",
    )
    text = combat_opening_prose(ctx, language="cs") or ""
    assert "Goblin scout" not in text
    assert "Gobliní zvěd" in text
    assert "The Sunken Corridor" not in text
