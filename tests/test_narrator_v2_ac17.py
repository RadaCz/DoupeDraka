"""Acceptance tests Úkol 17 — Narrator V2 Lite (backendové šablony)."""

import re

import pytest

from app.ai.base import NarrationContext
from app.ai.offline import narrate_offline
from app.ai.offline_cs_catalog import (
    ALL_CS_LITE_PROSE_TEMPLATES,
    BATTLE_CATEGORIES,
    LOCATION_CS,
    LOCATION_SECONDARY_EXPLORE,
    NPC_CALDUS,
    NPC_MARA,
    NPC_NIB,
)
from app.ai.offline_cs_narration import classify_combat_category, combat_prose_v2_cs
from app.ai.offline_prose import META_TERM_PATTERN, narration_contains_meta_terms
from app.ai.offline_variety import choose, choose_variety, variety_seed
from app.narrator import Narrator


def _ctx(**kwargs) -> NarrationContext:
    base = dict(
        action="look",
        events=(),
        location="The Whispering Cellar",
        memories=(),
        language="cs",
        scene_kind="explore",
        scene_dossier={
            "location": {
                "name": "The Whispering Cellar",
                "first_visit_here": True,
            },
        },
    )
    base.update(kwargs)
    return NarrationContext(**base)


def _location_scene_triples() -> list[tuple[str, str, tuple[str, ...]]]:
    rows: list[tuple[str, str, tuple[str, ...]]] = []
    for loc, scenes in LOCATION_CS.items():
        for scene, variants in scenes.items():
            rows.append((loc, scene, variants))
    return rows


# AC17-1: ≥4 varianty + determinismus seedu


def test_ac17_1_battle_categories_have_four_variants():
    for key, variants in BATTLE_CATEGORIES.items():
        assert len(variants) >= 4, f"{key} má jen {len(variants)} variant"


def test_ac17_1_location_scenes_have_four_variants():
    for loc, scene, variants in _location_scene_triples():
        assert len(variants) >= 4, f"{loc}/{scene} má jen {len(variants)} variant"
    assert len(LOCATION_SECONDARY_EXPLORE) >= 4


def test_ac17_1_npc_voice_pools_have_four_variants():
    for pool in (NPC_CALDUS, NPC_NIB, NPC_MARA):
        for rel, variants in pool.items():
            assert len(variants) >= 4, f"NPC pool {rel} má jen {len(variants)} variant"


def test_ac17_1_deterministic_choose_with_seed():
    options = BATTLE_CATEGORIES["B2"]
    ctx_a = _ctx(events=("Attack roll: 10 vs AC 12 — hit.",), action="útok")
    ctx_b = _ctx(events=("Attack roll: 10 vs AC 12 — hit.",), action="útok")
    seed = variety_seed(ctx_a)
    assert choose(options, seed) == choose(options, seed)
    assert choose(options, variety_seed(ctx_b)) == choose(options, seed)


# AC17-2: žádné číslice v katalogu prózy; runtime bez cizích předmětů


def test_ac17_2_catalog_prose_has_no_digits():
    for line in ALL_CS_LITE_PROSE_TEMPLATES:
        assert not re.search(r"\d", line), f"číslice v šabloně: {line!r}"


def test_ac17_2_combat_prose_has_no_roll_dump():
    text = narrate_offline(
        _ctx(
            scene_kind="combat",
            action="zaútočit",
            events=("Attack roll: 18 + 4 vs AC 13 — hit.", "Damage 7 — the goblin has 3 HP left."),
            scene_dossier={
                "location": {"name": "The Whispering Cellar"},
                "combat": {"enemy_name": "goblin"},
            },
        )
    )
    assert not re.search(r"\d", text)
    assert "attack roll" not in text.lower()
    assert "goblin" in text.lower() or "gobliní" in text.lower()


# AC17-5: žádné opakování varianty ve dvou po sobě jdoucích tazích


def test_ac17_5_no_consecutive_duplicate_variant():
    options = BATTLE_CATEGORIES["B3"]
    seed = 120
    first, idx = choose_variety(options, seed)
    second, idx2 = choose_variety(options, seed, last_index=idx)
    assert first != second or len(options) == 1
    assert idx2 != idx


def test_ac17_5_scene_dossier_last_index_guard():
    options = BATTLE_CATEGORIES["B6"]
    seed = variety_seed(_ctx(events=("Goblin hits you for 3. Your HP: 2/20.",), scene_kind="combat"))
    ctx = _ctx(
        events=("Goblin hits you for 3. Your HP: 2/20.",),
        scene_kind="combat",
        scene_dossier={
            "location": {"name": "The Whispering Cellar"},
            "narrator_variety": {"B6": seed % len(options)},
            "combat": {"enemy_name": "goblin"},
        },
    )
    a = combat_prose_v2_cs(ctx)
    ctx2 = _ctx(
        events=("Goblin hits you for 2. Your HP: 1/20.",),
        scene_kind="combat",
        scene_dossier={
            "location": {"name": "The Whispering Cellar"},
            "narrator_variety": {"B6": seed % len(options)},
            "combat": {"enemy_name": "goblin"},
        },
    )
    b = combat_prose_v2_cs(ctx2)
    assert a != b


# AC17-6: opravy E + META_TERM_PATTERN


def test_ac17_6_section_e_czech_fixes():
    from pathlib import Path
    import inspect
    import app.ai.offline_variety as offline_variety_mod
    import app.ai.offline_prose as offline_prose_mod

    src_variety = inspect.getsource(offline_variety_mod.familiarity_lead)
    assert "Vracíš se" in src_variety
    assert "Vraceš se" not in src_variety
    src_prose = inspect.getsource(offline_prose_mod.combat_prose_from_events)
    assert "proklouzne" in src_prose
    assert "prosměkne" not in src_prose

    display = Path("localization/chapter_one_display.json").read_text(encoding="utf-8")
    assert "škubá botami" in display
    assert "levnými amulety" in display
    assert "nehodnými amulety" not in display
    assert "škábe o boty" not in display


def test_ac17_6_meta_term_pattern_green():
    samples = list(ALL_CS_LITE_PROSE_TEMPLATES) + [
        narrate_offline(_ctx(events=("You explore but find no immediate threat.",))),
        Narrator.narrate_offline(
            _ctx(events=("Attack roll: 5 vs AC 14 — miss.",), scene_kind="combat", action="útok")
        ),
    ]
    for text in samples:
        assert not META_TERM_PATTERN.search(text or "")
        assert not narration_contains_meta_terms(text or "")


# Mapování fakt → kategorie (dokumentace v testech)


@pytest.mark.parametrize(
    ("events", "expected"),
    [
        (("Attack roll: 16 vs AC 13 — hit.", "Damage 4 — goblin has 2 HP."), "B2"),
        (("Attack roll: 4 vs AC 13 — miss.",), "B3"),
        (("Attack with sword: 22 (d20 +2) — hit.", "Damage 8 — goblin has 0 HP."), "B9"),
        (("You dodge and gain disadvantage protection against the next enemy attack.",), "B5"),
        (("Goblin hits you for 5. Your HP: 15/40.",), "B6"),
        (("Goblin's attack misses.",), "B7"),
        (("Goblin hits you for 8. Your HP: 2/20.",), "B8"),
        (("Dexterity check: 18 — you break away and escape the fight.",), "B11"),
        (("Dexterity check: 5 vs DC 12 — you fail to break away.",), "B12"),
        (("You advance 10 ft — now 5 ft from goblin.",), "B13-advance"),
        (("You retreat 5 ft — now 20 ft from goblin.",), "B13-retreat"),
    ],
)
def test_combat_fact_category_mapping(events: tuple[str, ...], expected: str):
    cat = classify_combat_category(_ctx(events=events, scene_kind="combat"))
    assert cat == expected