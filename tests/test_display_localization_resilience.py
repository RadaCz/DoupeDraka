"""Regression: display catalog load failures must not break narration or moves."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

import app.display_localization as dl
from app.ai.base import NarrationContext
from app.ai.offline_prose import combat_opening_prose
from app.display_localization import (
    catalog_for_tests,
    display_creature,
    display_location,
)


def _clear_catalog_cache() -> None:
    dl._catalog.cache_clear()


@pytest.fixture(autouse=True)
def _reset_catalog_cache():
    _clear_catalog_cache()
    yield
    _clear_catalog_cache()


def test_missing_catalog_file_returns_fallback_and_warns(tmp_path: Path, caplog):
    missing = tmp_path / "nope.json"
    original = dl._CATALOG_PATH
    dl._CATALOG_PATH = missing
    try:
        with caplog.at_level("WARNING", logger="app.display_localization"):
            assert catalog_for_tests() == {}
            assert display_location("The Sunken Corridor", "cs") == "The Sunken Corridor"
        assert any("catalog missing or invalid" in r.message.lower() for r in caplog.records)
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
        assert isinstance(text, str)
    finally:
        dl._CATALOG_PATH = original


def test_invalid_catalog_json_returns_fallback_and_warns(tmp_path: Path, caplog):
    bad = tmp_path / "bad.json"
    bad.write_text("{not json", encoding="utf-8")
    original = dl._CATALOG_PATH
    dl._CATALOG_PATH = bad
    try:
        with caplog.at_level("WARNING", logger="app.display_localization"):
            assert catalog_for_tests() == {}
            assert display_creature("Goblin scout", "cs") == "Goblin scout"
        assert any("catalog missing or invalid" in r.message.lower() for r in caplog.records)
    finally:
        dl._CATALOG_PATH = original


def test_standard_install_catalog_nonempty():
    data = catalog_for_tests()
    assert data
    assert data.get("locations")
    repo_path = Path(__file__).resolve().parent.parent / "localization" / "chapter_one_display.json"
    on_disk = json.loads(repo_path.read_text(encoding="utf-8"))
    assert data["locations"] == on_disk["locations"]