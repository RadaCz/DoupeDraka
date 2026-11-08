from dataclasses import replace

from app.api import build_narration_context
from app.engine.models import CharacterState
from app.narration_language import language_output_instruction, normalize_narration_language
from app.narrator import NarrationContext, Narrator


def _minimal_character(**overrides) -> CharacterState:
    base = CharacterState(
        id="00000000-0000-0000-0000-000000000001",
        owner_id="00000000-0000-0000-0000-000000000002",
        name="Tester",
        race="human",
        character_class="fighter",
        abilities={"strength": 10, "dexterity": 10, "constitution": 10, "intelligence": 10, "wisdom": 10, "charisma": 10},
        hp=10,
        max_hp=10,
        armor_class=10,
        level=1,
        xp=0,
        gold=0,
        inventory=[],
        location="The Whispering Cellar",
    )
    return replace(base, **overrides)


def test_normalize_narration_language_accepts_region_tags():
    assert normalize_narration_language("cs-CZ") == "cs"
    assert normalize_narration_language("EN") == "en"
    assert normalize_narration_language("de") == "en"


def test_build_narration_context_carries_normalized_language():
    character = _minimal_character(narration_language="cs")
    context = build_narration_context(character, "hledat", ("Exploration roll: 4 on a six-sided die.",), [])
    assert context.language == "cs"


def test_system_prompt_instructs_czech_prose_not_mechanics():
    context = NarrationContext(
        action="prozkoumat",
        events=("Dexterity check: 18 vs DC 12 — success.",),
        location="The Whispering Cellar",
        memories=(),
        language="cs",
    )
    prompt = Narrator.system_prompt(context)
    assert "Czech" in prompt
    assert "Dexterity check" in prompt
    assert language_output_instruction("cs") in prompt


def test_offline_shrine_quest_in_czech():
    context = NarrationContext(
        action="vrátit zvon",
        events=("You return the shrine bell to Caldus and receive 5 gold pieces and 30 XP.",),
        location="The Shrine of the Forgotten",
        memories=(),
        language="cs",
    )
    narration = Narrator.narrate_offline(context)
    assert "Caldus" in narration
    assert "zvon" in narration.lower() or "deníku" in narration.lower()
