"""Czech offline narrator produces non-English prose for common turn shapes."""

from app.ai.offline import narrate_offline
from app.narrator import NarrationContext, Narrator


def _cs(**kwargs) -> NarrationContext:
    base = dict(
        action="hledat",
        location="The Whispering Cellar",
        memories=(),
        language="cs",
    )
    base.update(kwargs)
    return NarrationContext(**base)


def test_czech_explore_success():
    context = _cs(
        action="prohledat",
        events=("Exploration roll: 5 on a six-sided die — you find 3 gold pieces tucked beneath loose stones.",),
    )
    text = narrate_offline(context)
    assert "You find" not in text
    assert any(word in text.lower() for word in ("zlat", "kam", "mince"))


def test_czech_combat_hit():
    context = _cs(
        action="zaútočit",
        events=(
            "Attack roll: 18 + 4 vs AC 13 — hit.",
            "Damage 7 — the goblin has 3 HP left.",
        ),
    )
    text = narrate_offline(context)
    assert "attack roll" not in text.lower()
    assert any(word in text.lower() for word in ("úder", "zasá", "boj"))


def test_czech_combat_miss():
    context = _cs(
        action="zaútočit",
        events=("Attack roll: 3 + 4 vs AC 13 — miss.",),
    )
    text = narrate_offline(context)
    assert "miss" not in text.lower()
    assert any(word in text.lower() for word in ("mine", "útok", "nepřítel", "čepel", "soupeř"))


def test_czech_quest_bell_return():
    context = _cs(
        action="vrátit zvon",
        location="The Shrine of the Forgotten",
        events=("You return the shrine bell to Caldus and receive 5 gold pieces and 30 XP.",),
    )
    text = Narrator.narrate_offline(context)
    assert "return the shrine" not in text.lower()
    assert "caldus" in text.lower() or "zvon" in text.lower()


def test_czech_check_failure():
    context = _cs(
        action="prohledat",
        events=("Dexterity check: 4 vs DC 12 — failure.",),
    )
    text = narrate_offline(context)
    assert "failure" not in text.lower()
    assert any(word in text.lower() for word in ("nepoved", "zkouší", "bez"))


def test_czech_defeat_rest():
    context = _cs(
        action="odpočinek",
        events=("You take a moment to catch your breath. No new threat appears.",),
    )
    text = Narrator.narrate_offline(context)
    assert "catch your breath" not in text.lower()
    assert any(word in text.lower() for word in ("dech", "zastav", "klid"))
