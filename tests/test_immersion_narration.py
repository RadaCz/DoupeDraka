"""Player-facing offline narration: no meta-system wording, language and variety."""

from app.ai.base import NarrationContext
from app.ai.offline import narrate_offline
from app.ai.offline_prose import breath_pause_prose, combat_opening_prose, narration_contains_meta_terms
from app.ai.offline_variety import generic_scene_prose
from app.narrator import Narrator


def _ctx(**kwargs) -> NarrationContext:
    defaults = dict(
        action="look around",
        events=("You explore the area but find no immediate threat.",),
        location="The Whispering Cellar",
        memories=(),
        scene_kind="explore",
        scene_dossier={
            "location": {
                "name": "The Whispering Cellar",
                "atmosphere": "Cold stone sweats with moisture. A draft carries the scent of mildew.",
                "first_visit_here": False,
                "times_visited": 2,
            },
        },
    )
    defaults.update(kwargs)
    return NarrationContext(**defaults)


def test_generic_fallback_never_uses_meta_terms_en():
    text = generic_scene_prose(_ctx(scene_kind="general", events=("Quiet.",)), language="en")
    assert not narration_contains_meta_terms(text)


def test_generic_fallback_never_uses_meta_terms_cs():
    text = generic_scene_prose(
        _ctx(scene_kind="combat", events=("Quiet.",), action="strike"),
        language="cs",
    )
    assert not narration_contains_meta_terms(text)
    assert "engine" not in text.lower()
    assert "deník" not in text.lower()


def test_breath_cooldown_varies_and_has_no_meta_en():
    text = narrate_offline(_ctx(events=("You take a moment to catch your breath. No new threat appears.",)))
    assert not narration_contains_meta_terms(text)
    assert "catch your breath" not in text.lower()
    varied = breath_pause_prose(
        _ctx(
            action="search",
            scene_kind="rest",
            memories=("Earlier you fought here.",),
        ),
        language="en",
    )
    assert not narration_contains_meta_terms(varied)
    assert "Whispering Cellar" in varied or "breath" in varied.lower() or "pause" in varied.lower()


def test_empty_explore_uses_location_not_engine():
    text = narrate_offline(_ctx())
    assert not narration_contains_meta_terms(text)
    assert "engine" not in text.lower()


def test_combat_hit_is_story_not_roll_dump():
    text = narrate_offline(
        _ctx(
            scene_kind="combat",
            action="attack",
            events=(
                "Attack roll: 16 + 3 vs AC 13 — hit.",
                "Damage 6 — the goblin has 2 HP left.",
            ),
            scene_dossier={
                "location": {"name": "The Whispering Cellar"},
                "combat": {"enemy_name": "goblin"},
            },
        )
    )
    assert "attack roll" not in text.lower()
    assert not narration_contains_meta_terms(text)
    assert "goblin" in text.lower()


def test_explore_fallback_avoids_echoing_search_location_in_prose():
    from app.ai.offline_variety import generic_scene_prose

    ctx = _ctx(
        action="search The Underground River",
        scene_kind="explore",
        location="The Underground River",
        events=("You explore the area but find no immediate threat.",),
        scene_dossier={
            "location": {
                "name": "The Underground River",
                "first_visit_here": True,
                "atmosphere": "Cold water threads beneath cracked stone.",
            },
        },
    )
    text = generic_scene_prose(ctx, language="en")
    assert "search the underground river" not in text.lower()
    assert "underground river" in text.lower()


def test_paid_system_prompt_forbids_journal_meta():
    prompt = Narrator.system_prompt(_ctx(language="en"))
    lower = prompt.lower()
    assert "internal systems" in lower or "journals" in lower
    assert "scene responds" in lower
    assert "your choice moves" in lower


def test_rest_recovery_prose_natural_en_and_cs():
    from app.ai.offline_prose import rest_recovery_prose

    ctx = _ctx(
        events=("You rest and recover.",),
        scene_kind="rest",
        action="rest",
    )
    en = rest_recovery_prose(ctx, language="en")
    cs = rest_recovery_prose(ctx, language="cs")
    assert not narration_contains_meta_terms(en)
    assert not narration_contains_meta_terms(cs)
    assert "body thanks" not in en.lower()
    assert "tělo ti odpoví" not in cs.lower()
    assert "Whispering Cellar" in en or "place" in en.lower()


def test_offline_rest_branch_uses_recovery_prose():
    text = narrate_offline(
        _ctx(events=("You rest and recover.",), scene_kind="rest", action="rest"),
    )
    assert not narration_contains_meta_terms(text)
    assert "you rest and recover" not in text.lower()


FORBIDDEN_PHRASES = (
    "your choice moves the moment forward",
    "the scene responds",
    "the scene answers",
    "stays within engine findings",
)


def test_combat_opening_prose_uses_location_and_enemy_not_attack_template():
    ctx = _ctx(
        action="search",
        events=(
            "An enemy appears: Goblin scout (7 HP).",
            "Initiative: you 14 (DEX), Goblin scout 11 (DEX). Your turn first.",
        ),
        location="The Underground River",
        scene_kind="combat",
    )
    en = combat_opening_prose(ctx, language="en")
    cs = combat_opening_prose(ctx, language="cs")
    assert en
    assert cs
    assert "Goblin scout" in en
    assert "Underground River" in en
    assert "attack roll" not in en.lower()
    assert "Goblin scout" in cs
    assert "Underground River" in cs
    assert not narration_contains_meta_terms(en)
    assert not narration_contains_meta_terms(cs)


def test_combat_opening_skipped_once_attack_roll_present():
    ctx = _ctx(
        action="attack goblin",
        events=("Attack roll: 12 + 3 = 15 — hit.", "Damage 5 — the Goblin scout has 2 HP left."),
        location="The Underground River",
    )
    assert combat_opening_prose(ctx, language="en") is None


def test_generic_fallback_avoids_forbidden_phrases_en():
    for kind in ("general", "explore", "rest", "travel", "talk"):
        text = generic_scene_prose(_ctx(scene_kind=kind), language="en")
        lower = text.lower()
        for phrase in FORBIDDEN_PHRASES:
            assert phrase not in lower
        assert not narration_contains_meta_terms(text)
