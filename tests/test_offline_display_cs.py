"""CS offline prose must not leak canonical English display names where catalogued."""

from app.ai.base import NarrationContext
from app.ai.offline import narrate_offline
from app.ai.offline_prose import rest_recovery_prose


def _ctx(**kwargs) -> NarrationContext:
    defaults = dict(
        action="look around",
        events=("You explore the area but find no immediate threat.",),
        location="The Sunken Corridor",
        memories=(),
        scene_kind="explore",
        language="cs",
        scene_dossier={
            "location": {
                "name": "The Sunken Corridor",
                "atmosphere": "Damp stone.",
                "first_visit_here": True,
            },
        },
    )
    defaults.update(kwargs)
    return NarrationContext(**defaults)


def test_defeat_respawn_location_localized_cs():
    ctx = _ctx(
        events=("Defeated in combat.",),
        defeat_facts={"respawn_location": "The Whispering Cellar"},
        scene_kind="combat",
    )
    text = narrate_offline(ctx)
    assert "The Whispering Cellar" not in text
    # Respawn phrase uses locative case (v šeptajícím sklepu), not nominative label.
    assert "šeptajícím sklepu" in text.casefold()


def test_rest_prose_no_english_corridor_name():
    ctx = _ctx(events=("You rest and recover.",), scene_kind="rest", action="rest")
    text = rest_recovery_prose(ctx, language="cs")
    assert "The Sunken Corridor" not in text


def test_travel_generic_uses_localized_place():
    ctx = _ctx(action="travel to The Goblin Market", scene_kind="travel", location="The Goblin Market")
    text = narrate_offline(ctx)
    assert "The Goblin Market" not in text
