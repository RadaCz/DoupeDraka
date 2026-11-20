"""AC17-3 a mapování combat kategorií ze structured resolution.beats."""

import re

import pytest

from app.ai.base import NarrationContext
from app.ai.offline import narrate_offline
from app.ai.offline_cs_narration import classify_combat_category
from app.narration_layers import classify_combat_category_from_beats, compose_narration_layers


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