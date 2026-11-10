"""Offline narrator P3: scene_kind fallbacks and return visits."""

from app.ai.base import NarrationContext
from app.ai.offline import narrate_offline
from app.ai.offline_cs import narrate_offline_cs
from app.narrator import Narrator


def _context(**kwargs) -> NarrationContext:
    defaults = dict(
        action="wait",
        events=("Nothing special happens.",),
        location="The Whispering Cellar",
        memories=(),
    )
    defaults.update(kwargs)
    return NarrationContext(**defaults)


def test_offline_scene_kind_talk_differs_from_combat_en():
    talk = _context(action="talk to Caldus", scene_kind="talk", events=("The shrine keeper watches.",))
    combat = _context(action="strike", scene_kind="combat", events=("The shrine keeper watches.",))
    talk_text = narrate_offline(talk).lower()
    combat_text = narrate_offline(combat).lower()
    assert talk_text != combat_text
    assert "conversation" in talk_text or "talk" in talk_text or "words" in talk_text
    assert any(
        word in combat_text
        for word in ("steel", "blow", "fight", "combat", "sharp", "inhale", "quiet")
    )


def test_offline_scene_kind_explore_cs():
    text = narrate_offline_cs(
        _context(
            action="look around",
            scene_kind="explore",
            events=("The cellar air is still.",),
            language="cs",
        )
    )
    lower = text.lower()
    assert any(
        stem in lower
        for stem in ("prozkoum", "hled", "okol", "uši", "zrak", "stín", "zvuk", "pozor")
    )


def test_offline_return_visit_mentions_familiarity():
    ctx = _context(
        action="look around",
        scene_kind="explore",
        events=("You scan the room.",),
        scene_dossier={
            "location": {"first_visit_here": False, "name": "The Whispering Cellar", "times_visited": 3},
        },
    )
    prose = Narrator.narrate_offline(ctx)
    assert "know" in prose.lower() or "znáš" in prose.lower() or "familiar" in prose.lower() or "povědom" in prose.lower()


def test_offline_generic_differs_by_scene_kind():
    explore = _context(action="ponder", scene_kind="explore", events=("Quiet.",))
    travel = _context(action="ponder", scene_kind="travel", events=("Quiet.",))
    assert narrate_offline(explore) != narrate_offline(travel)
