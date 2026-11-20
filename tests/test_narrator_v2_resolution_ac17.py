"""AC17-3 a mapování combat kategorií ze structured resolution.beats."""

import re

import pytest

from app.ai.base import NarrationContext
from app.ai.offline import narrate_offline
from app.ai.offline_cs_narration import classify_combat_category
from app.narration_layers import (
    classify_combat_category_from_beats,
    compose_narration_layers,
    format_beat_outcome_cs,
    format_resolution_outcome,
)

_RAW_ENGINE_TOKENS = (
    "opportunity_attack",
    "shield",
    "strength",
    "dexterity",
    "constitution",
    "intelligence",
    "wisdom",
    "charisma",
    "critical_miss",
    "Záchraný",
)


def _ctx(**kwargs) -> NarrationContext:
    base = dict(
        action="útok",
        events=(),
        location="The Whispering Cellar",
        memories=(),
        language="cs",
        scene_kind="combat",
        scene_dossier={
            "location": {"name": "The Whispering Cellar"},
            "combat": {"enemy_name": "goblin"},
            "quests": {"active_step": {"hint": "Jdi na Gobliní trh."}},
        },
    )
    base.update(kwargs)
    return NarrationContext(**base)


def _enemy_hit_beat(*, hp_current: int, hp_max: int = 20) -> dict:
    return {
        "kind": "attack",
        "actor": "enemy",
        "actor_name": "Goblin",
        "outcome": "hit",
        "attack_roll": {"natural": 15, "modifier": 2, "total": 17},
        "target_ac": 14,
        "damage": {"total": 5},
        "hero": {"hp_current": hp_current, "hp_max": hp_max},
        "enemy": {"hp_current": 10, "hp_max": 20, "name": "Goblin"},
    }


@pytest.mark.parametrize(
    ("beats", "expected"),
    [
        ([{"kind": "defend", "actor": "hero", "hero": {"hp_current": 12, "hp_max": 20}}], "B5"),
        ([{"kind": "flee", "actor": "hero", "success": True, "roll": {"total": 18}, "dc": 12}], "B11"),
        ([{"kind": "flee", "actor": "hero", "success": False, "roll": {"total": 6}, "dc": 12}], "B12"),
        (
            [{"kind": "movement", "actor": "hero", "distance_ft": {"from": 30, "to": 20}}],
            "B13-advance",
        ),
        (
            [{"kind": "movement", "actor": "hero", "distance_ft": {"from": 10, "to": 25}}],
            "B13-retreat",
        ),
        (
            [
                {
                    "kind": "attack",
                    "actor": "hero",
                    "outcome": "hit",
                    "enemy": {"hp_current": 0, "hp_max": 20, "name": "Goblin"},
                }
            ],
            "B9",
        ),
    ],
)
def test_ac17_beats_map_to_combat_category(beats, expected):
    assert classify_combat_category_from_beats(beats) == expected
    cat = classify_combat_category(
        _ctx(events=("placeholder",), resolution={"beats": beats})
    )
    assert cat == expected


def test_ac17_b8_boundary_25_percent_from_beats():
    assert classify_combat_category_from_beats([_enemy_hit_beat(hp_current=5)]) == "B8"
    assert classify_combat_category_from_beats([_enemy_hit_beat(hp_current=6)]) == "B6"


def test_ac17_classify_prefers_beats_over_journal():
    beats = [{"kind": "defend", "actor": "hero", "hero": {"hp_current": 12, "hp_max": 20}}]
    cat = classify_combat_category(
        _ctx(
            events=("Attack roll: 20 — hit.",),
            resolution={"beats": beats},
        )
    )
    assert cat == "B5"


def test_ac17_spell_damage_kill_maps_b9_like_attack():
    beats = [
        {
            "kind": "spell_damage",
            "actor": "hero",
            "spell_name": "Magic Missile",
            "damage": 12,
            "enemy": {"hp_current": 0, "hp_max": 20, "name": "Goblin"},
        }
    ]
    assert classify_combat_category_from_beats(beats) == "B9"
    assert (
        classify_combat_category(_ctx(events=("x",), resolution={"beats": beats}))
        == "B9"
    )


@pytest.mark.parametrize(
    "beat",
    [
        {
            "kind": "attack",
            "actor": "hero",
            "outcome": "hit",
            "attack_roll": {"natural": 15, "modifier": 2, "total": 17},
            "target_ac": 14,
            "damage": {"total": 5},
        },
        {
            "kind": "movement",
            "actor": "hero",
            "distance_ft": {"from": 30, "to": 20},
        },
        {"kind": "defend", "actor": "hero"},
        {
            "kind": "flee",
            "actor": "hero",
            "success": True,
            "roll": {"total": 18},
            "dc": 12,
        },
        {"kind": "healing", "actor": "hero", "healing": 8},
        {
            "kind": "spell_damage",
            "actor": "hero",
            "spell_name": "Magic Missile",
            "damage": 7,
        },
        {
            "kind": "saving_throw",
            "actor": "hero",
            "ability": "dexterity",
            "dc": 13,
            "roll": {"total": 16},
            "success": True,
        },
        {"kind": "reaction", "actor": "hero", "name": "shield", "cast": True},
        {"kind": "reaction", "actor": "enemy", "name": "opportunity_attack"},
    ],
)
def test_ac17_outcome_cs_no_raw_engine_keys(beat):
    line = format_beat_outcome_cs(beat)
    assert line
    lowered = line.casefold()
    for token in _RAW_ENGINE_TOKENS:
        assert token.casefold() not in lowered, f"{token!r} in {line!r}"
    if beat.get("kind") == "saving_throw":
        assert "Záchranný hod" in line
        assert "Obratnost" in line
    if beat.get("name") == "shield":
        assert "Štít" in line
    if beat.get("name") == "opportunity_attack":
        assert "Příležitostný útok" in line


def test_ac17_outcome_resolution_joins_all_beat_types_without_raw_keys():
    beats = [
        {
            "kind": "attack",
            "actor": "hero",
            "outcome": "critical_hit",
            "attack_roll": {"natural": 20, "modifier": 3, "total": 23},
            "target_ac": 12,
            "damage": {"total": 9},
        },
        {"kind": "reaction", "actor": "hero", "name": "shield", "cast": True},
        {
            "kind": "saving_throw",
            "actor": "hero",
            "ability": "wisdom",
            "dc": 15,
            "roll": {"total": 14},
            "success": False,
        },
    ]
    text = format_resolution_outcome(_ctx(resolution={"beats": beats}))
    assert text
    lowered = text.casefold()
    for token in _RAW_ENGINE_TOKENS:
        assert token.casefold() not in lowered
    assert "Moudrost" in text
    assert "Štít" in text


def test_ac17_story_prose_has_no_digits_with_resolution():
    beats = [
        {
            "kind": "attack",
            "actor": "hero",
            "outcome": "hit",
            "attack_roll": {"natural": 18, "modifier": 3, "total": 21},
            "target_ac": 13,
            "damage": {"total": 7},
            "hero": {"hp_current": 14, "hp_max": 20},
            "enemy": {"hp_current": 3, "hp_max": 20, "name": "goblin"},
        }
    ]
    ctx = _ctx(
        events=("Attack with sword: 21 (d20 +3) — hit.", "Damage 7 — goblin has 3/20 HP."),
        resolution={"beats": beats},
    )
    story = narrate_offline(ctx)
    assert not re.search(r"\d", story)
    layers = compose_narration_layers(ctx, story)
    assert layers["story"] == story
    assert "21" in layers["outcome"]
    assert re.search(r"\d", layers["outcome"])
    assert layers["next"] == "Jdi na Gobliní trh."