from app.campaign_memory import effective_long_term_memory
from app.engine.models import CharacterState


def test_effective_long_term_prefers_primary_field():
    character = CharacterState("c1", 1, "H", "human", "fighter")
    character.long_term_memory = "Caldus wants the bell."
    character.memory_summary = "Old mechanical: Exploration roll 4"
    assert "Caldus wants the bell" in effective_long_term_memory(character)
    assert "Exploration roll" not in effective_long_term_memory(character)


def test_legacy_memory_summary_used_when_long_term_empty():
    character = CharacterState("c1", 1, "H", "human", "fighter")
    character.memory_summary = "Remembered a promise to Mara."
    assert effective_long_term_memory(character) == "Remembered a promise to Mara."


def test_long_term_ignores_legacy_summary_when_primary_set():
    character = CharacterState("c1", 1, "H", "human", "fighter")
    character.long_term_memory = "Full campaign arc with Mara promise."
    character.memory_summary = "Stale mechanical noise"
    assert effective_long_term_memory(character) == "Full campaign arc with Mara promise."
