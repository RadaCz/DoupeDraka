"""P2 narrator quality contracts: scene kind, memory layers, NPC voice, Czech."""

from app.api import build_narration_context
from app.engine.models import CharacterState
from app.narration_dossier import narration_beats_from_journal, scene_dossier_for_character
from app.narration_scene import infer_scene_kind
from app.narrator import Narrator


def test_infer_talk_scene_for_caldus_dialogue():
    kind = infer_scene_kind("talk to Caldus about the bell", ("Charisma check: 14 vs DC 12 — success.",), in_combat=False)
    assert kind == "talk"


def test_short_term_beats_exclude_mechanics_block():
    journal = "Caldus nods slowly.\n\nCharisma check: 14 vs DC 12 — success."
    beats = narration_beats_from_journal([journal])
    assert beats[0] == "Caldus nods slowly."
    assert "Charisma check" not in beats[0]


def test_npc_profiles_have_distinct_personalities():
    character = CharacterState("c1", 1, "H", "human", "fighter", location="The Goblin Market")
    dossier = scene_dossier_for_character(character)
    nib = next(n for n in dossier["npcs_present"] if n["id"] == "nib")
    character.location = "The Shrine of the Forgotten"
    caldus = next(n for n in scene_dossier_for_character(character)["npcs_present"] if n["id"] == "caldus")
    assert nib["voice"] != caldus["voice"]
    assert nib["personality"] != caldus["personality"]


def test_build_context_puts_long_term_only_in_system_field():
    character = CharacterState("c1", 1, "H", "human", "fighter", long_term_memory="Vault still locked.")
    ctx = build_narration_context(character, "look", ("You look.",), ["Prior prose beat."])
    assert "Vault still locked" in Narrator.system_prompt(ctx)
    user = Narrator()._request(ctx).user_prompt
    assert "Long-term memory" not in user
    assert "Prior prose beat" in user


def test_czech_system_prompt_includes_natural_prose_directive():
    character = CharacterState(
        "c1", 1, "H", "human", "fighter", narration_language="cs", verbose=True
    )
    ctx = build_narration_context(character, "prohledat", ("Exploration roll: 3.",), [])
    prompt = Narrator.system_prompt(ctx)
    assert "natural Czech" in prompt or "Czech fantasy" in prompt
