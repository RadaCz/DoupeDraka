"""Regresní testy Úkol 17 texty (Designer SPEC_17_texts_designer a–g)."""

from __future__ import annotations

import re

import pytest

from app.ai.base import NarrationContext
from app.ai.offline import narrate_offline
from app.ai.offline_cs_catalog import LOCATION_CS
from app.ai.offline_cs_narration import (
    combat_prose_v2_cs,
    location_prose_v2_cs,
    npc_talk_prose_v2_cs,
)
from app.ai.offline_variety import familiarity_lead, variety_seed
from app.ai.offline_variety import choose_variety
from app.display_localization import catalog_for_tests, display_location_in, display_location_to, display_quest_hint
from app.engine.quests import CHAPTER_ONE_STEPS
from app.narration_layers import compose_narration_layers, format_beat_outcome_cs, quest_next_hint


def _ctx(**kwargs) -> NarrationContext:
    defaults = {"language": "cs", "location": "The Shrine of the Forgotten", "events": (), "memories": (), "action": ""}
    defaults.update(kwargs)
    return NarrationContext(**defaults)


# --- a) hint_cs ---

_TRANSLATED_STEP_IDS = frozenset(
    step.id for step in CHAPTER_ONE_STEPS if step.id != "chapter_one_complete"
)


@pytest.mark.parametrize("step_id", sorted(_TRANSLATED_STEP_IDS))
def test_ac17_texts_quest_hint_cs_present(step_id: str):
    hint = display_quest_hint(step_id, "cs")
    assert hint and hint.strip(), f"chybí hint_cs pro {step_id}"


@pytest.mark.xfail(reason="Designer zatím nepřeložil chapter_one_complete — uvedeno v PR")
def test_ac17_texts_quest_hint_chapter_one_complete_pending():
    assert display_quest_hint("chapter_one_complete", "cs") is None


def test_ac17_texts_quest_next_layer_uses_cs_catalog():
    ctx = _ctx(
        scene_dossier={
            "quests": {
                "active_step": {
                    "id": "bell_quest_accepted",
                    "hint": "At the Shrine of the Forgotten, talk to Caldus about the bell.",
                }
            }
        }
    )
    assert quest_next_hint(ctx) == "Ve Svatyni zapomenutých si promluv s Caldem o zvonu."
    layers = compose_narration_layers(ctx, "Příběh.")
    assert "At the Shrine" not in layers["next"]


# --- b) prázdný Výsledek u rozhovoru ---


def test_ac17_texts_talk_outcome_empty():
    ctx = _ctx(
        scene_kind="talk",
        action="promluvit s Caldusem",
        scene_dossier={
            "location": {"name": "The Shrine of the Forgotten"},
            "npcs_present": [{"id": "caldus", "name": "Caldus", "relationship_to_hero": "cautious"}],
            "quests": {"active_step": {"id": "bell_quest_accepted", "hint": "…"}},
        },
    )
    story = narrate_offline(ctx)
    layers = compose_narration_layers(ctx, story)
    assert layers["outcome"] == ""


# --- c) NPC formát ---


def test_ac17_texts_npc_reply_format():
    ctx = _ctx(
        scene_kind="talk",
        action="promluvit s Caldusem",
        events=("You speak with Caldus.",),
        scene_dossier={
            "location": {"name": "The Shrine of the Forgotten", "first_visit_here": True},
            "npcs_present": [
                {
                    "id": "caldus",
                    "name": "Caldus",
                    "relationship_to_hero": "Cautious but welcoming to respectful guests.",
                }
            ],
        },
    )
    line = npc_talk_prose_v2_cs(ctx)
    assert line
    assert re.match(r"^Caldus řekne: „.+“$", line)


# --- d) in_cs / to_cs ---


@pytest.mark.parametrize(
    "name,expected_in,expected_to",
    [
        ("The Shrine of the Forgotten", "ve Svatyni zapomenutých", "do Svatyně zapomenutých"),
        ("The Goblin Market", "na Gobliním trhu", "na Gobliní trh"),
    ],
)
def test_ac17_texts_location_in_to_cs(name: str, expected_in: str, expected_to: str):
    assert display_location_in(name, "cs") == expected_in
    assert display_location_to(name, "cs") == expected_to


def test_ac17_texts_familiarity_lead_shrine_in_cs():
    ctx = _ctx(
        location="The Shrine of the Forgotten",
        scene_dossier={"location": {"name": "The Shrine of the Forgotten", "first_visit_here": False}},
    )
    lead = familiarity_lead(ctx, language="cs")
    assert lead
    assert " v svatyni " not in lead.lower()
    assert "goblińího" not in lead
    assert any(
        phrase in lead
        for phrase in (
            "ve Svatyni zapomenutých",
            "Svatyně zapomenutých",
            "do Svatyně zapomenutých",
        )
    )


def test_ac17_texts_all_chapter_one_locations_have_in_to_cs():
    locs = catalog_for_tests().get("locations", {})
    for key in LOCATION_CS:
        entry = locs.get(key, {})
        assert entry.get("in_cs"), key
        assert entry.get("to_cs"), key


# --- e) {foe} nominativ + velká písmena ---


def test_ac17_texts_foe_from_creature_catalog():
    beats = [
        {
            "kind": "attack",
            "actor": "enemy",
            "outcome": "miss",
            "enemy": {"name": "Orc", "hp_current": 14, "hp_max": 20},
        }
    ]
    ctx = _ctx(
        scene_kind="combat",
        events=("Orc misses.",),
        resolution={"beats": beats},
        scene_dossier={"location": {"name": "The Whispering Cellar"}, "combat": {"enemy_name": "Orc"}},
    )
    prose = combat_prose_v2_cs(ctx)
    assert prose
    assert "Orčí nájezdník" in prose
    assert "nepřítel" not in prose.casefold()


def test_ac17_texts_sentence_capitalization_after_lead():
    ctx = _ctx(
        scene_kind="combat",
        events=("Goblin misses.",),
        resolution={
            "beats": [
                {
                    "kind": "attack",
                    "actor": "enemy",
                    "outcome": "miss",
                    "enemy": {"name": "Orc marauder", "hp_current": 10, "hp_max": 20},
                }
            ]
        },
        scene_dossier={
            "location": {"name": "The Shrine of the Forgotten", "first_visit_here": False},
            "combat": {"enemy_name": "Orc marauder"},
        },
    )
    prose = combat_prose_v2_cs(ctx)
    assert prose
    for sentence in [s.strip() for s in prose.split(".") if s.strip()]:
        assert sentence[0].isupper(), sentence


# --- f) kouzlo ve Výsledku ---


def test_ac17_texts_spell_name_in_outcome_layer():
    beat = {
        "kind": "spell_damage",
        "spell_name": "Fire Bolt",
        "damage": 8,
    }
    line = format_beat_outcome_cs(beat)
    assert line.startswith("Ohnivý paprsek:")
    assert "Fire Bolt" not in line


# --- g) AC17-5 dvě návštěvy Svatyně ---


def test_ac17_texts_ac17_5_two_consecutive_shrine_revisit_explore_variants():
    key = "The Shrine of the Forgotten"
    base = {
        "location": {"name": key, "first_visit_here": False},
        "narrator_variety": {},
    }
    ctx1 = _ctx(
        events=("You explore the shrine.",),
        action="prozkoumat svatyni",
        scene_kind="explore",
        location=key,
        scene_dossier=base,
    )
    text1 = location_prose_v2_cs(ctx1, explore=True)
    assert text1
    category = f"C-{key}-revisit"
    options = LOCATION_CS[key]["revisit"]
    seed = variety_seed(ctx1)
    _, idx1 = choose_variety(options, seed)
    ctx2 = _ctx(
        events=("You explore the shrine again.",),
        action="prozkoumat svatyni",
        scene_kind="explore",
        location=key,
        scene_dossier={**base, "narrator_variety": {category: idx1}},
    )
    text2 = location_prose_v2_cs(ctx2, explore=True)
    assert text2
    assert text1 != text2