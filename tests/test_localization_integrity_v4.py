"""Sprint 4 — offline CS hooks for economy/rest facts and expanded display catalog."""

from app.ai.base import NarrationContext
from app.ai.offline_cs import narrate_offline_cs
from app.display_localization import display_creature
from app.engine.economy_balance import roll_exploration_gold
from app.engine.models import CharacterState


def test_display_creature_expanded_bestiary_cs():
    assert display_creature("Kobold skirmisher", "cs") == "Koboldí záškodník"
    assert display_creature("Kobold skirmisher", "en") == "Kobold skirmisher"


def test_offline_cs_repeat_scavenge_prose():
    ctx = NarrationContext(
        action="search",
        events=(
            "You pick over stones and debris, but this area has no loose coin left to find.",
        ),
        location="The Sunken Corridor",
        memories=(),
        scene_kind="search",
        scene_dossier={"location": {"name": "The Sunken Corridor"}},
        language="cs",
    )
    text = narrate_offline_cs(ctx)
    assert "stones and debris" not in text.lower()
    assert any(word in text.lower() for word in ("mince", "sutiny", "zlat"))


def test_roll_exploration_gold_one_time_flag():
    character = CharacterState(
        id="c1",
        owner_id=1,
        name="Test",
        race="human",
        character_class="fighter",
        location="The Sunken Corridor",
        quest_flags={},
    )
    _line, changed = roll_exploration_gold(character, 3)
    assert changed
    line2, changed2 = roll_exploration_gold(character, 2)
    assert not changed2
    assert "no loose coin" in line2
