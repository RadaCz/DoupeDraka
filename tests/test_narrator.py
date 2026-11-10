import asyncio

from app.ai.offline_prose import narration_contains_meta_terms
from app.narrator import NarrationContext, Narrator


def test_offline_narrates_combat_defeat_respawn():
    context = NarrationContext(
        action="attack",
        events=(
            "Defeated in combat. You black out and wake in The Whispering Cellar with 1 HP.",
        ),
        location="The Whispering Cellar",
        memories=(),
        defeat_facts={
            "kind": "combat_respawn",
            "respawn_location": "The Whispering Cellar",
            "current_hp": 1,
        },
    )
    narration = Narrator.narrate_offline(context)
    assert "Whispering Cellar" in narration
    assert "wake" in narration.lower() or "probud" in narration.lower()


def test_scene_dossier_in_user_prompt():
    context = NarrationContext(
        action="look",
        events=("A latch clicks.",),
        location="The Whispering Cellar",
        memories=(),
        scene_dossier={"hero": {"name": "Test", "hp": 8}},
    )
    prompt = Narrator()._request(context).user_prompt
    assert "Scene dossier" in prompt
    assert '"name": "Test"' in prompt


def test_long_term_memory_in_system_prompt():
    context = NarrationContext(
        action="look",
        events=("A latch clicks.",),
        location="The Whispering Cellar",
        memories=(),
        long_term_memory="Caldus wants the shrine bell returned.",
    )
    prompt = Narrator.system_prompt(context)
    assert "Long-term campaign memory" in prompt
    assert "shrine bell" in prompt


def test_defeat_instruction_in_system_prompt():
    context = NarrationContext(
        action="attack",
        events=("Defeated in combat. You black out...",),
        location="The Whispering Cellar",
        memories=(),
        defeat_facts={"respawn_location": "The Whispering Cellar", "current_hp": 1},
    )
    instruction = Narrator._defeat_scene_instruction(context)
    assert "1 HP" in instruction
    assert "Do not describe the fight continuing" in instruction


def test_fallback_does_not_repeat_previous_narration():
    context = NarrationContext(
        action="cast",
        events=("One mana spent.",),
        location="The Whispering Cellar",
        memories=(
            "In The Whispering Cellar you act: flee. You still recall: In The Whispering Cellar you act: run.",
        ),
    )

    narration = Narrator.narrate_offline(context)

    assert "Whispering Cellar" in narration
    assert "you act" not in narration.lower()
    assert "flee" not in narration
    assert "run" not in narration
    assert "cast" not in narration.lower()


def test_fallback_describes_exploration_discoveries():
    context = NarrationContext(
        action="Look around",
        events=(
            "Exploration roll: 3 on a six-sided die.",
            "You find 2 gold pieces tucked beneath loose stones (a random 1 to 4).",
        ),
        location="The Whispering Cellar",
        memories=(),
    )

    narration = Narrator.narrate_offline(context)

    assert "2 gold pieces" in narration
    assert "you act" not in narration.lower()


def test_fallback_varies_successful_checks_instead_of_repeating_a_shell():
    first = NarrationContext(
        action="Look around",
        events=("Dexterity check: 18 vs DC 12 — success.",),
        location="The Whispering Cellar",
        memories=(),
    )
    second = NarrationContext(
        action="Look around",
        events=("Dexterity check: 15 vs DC 12 — success.",),
        location="The Whispering Cellar",
        memories=(),
    )

    first_narration = Narrator.narrate_offline(first)
    second_narration = Narrator.narrate_offline(second)

    assert first_narration != second_narration
    assert "look around" in first_narration.lower()
    assert "look around" in second_narration.lower()


def test_fallback_describes_new_enemy_without_inventing_its_actions():
    context = NarrationContext(
        action="search the cellar",
        events=(
            "Exploration roll: 1 on a six-sided die.",
            "An enemy appears: Goblin scout (7 HP).",
            "The creature has not attacked yet. Choose your next action.",
        ),
        location="The Whispering Cellar",
        memories=(),
    )

    narration = Narrator.narrate_offline(context)

    assert "Goblin scout" in narration
    assert "has not struck" in narration or "has not attacked" in narration


def test_fallback_describes_resolved_shrine_bell_quest_facts():
    context = NarrationContext(
        action="return the shrine bell",
        events=("You return the shrine bell to Caldus and receive 5 gold pieces and 30 XP.",),
        location="The Shrine of the Forgotten",
        memories=(),
    )

    narration = Narrator.narrate_offline(context)

    assert "Caldus" in narration
    assert "shrine bell" in narration.lower() or "bell" in narration.lower()
    assert "5 gold" in narration.lower()
    assert not narration_contains_meta_terms(narration)


def test_offline_narrates_checks_in_czech_when_configured():
    context = NarrationContext(
        action="inspect the old door",
        events=("Intelligence check: 15 vs DC 12 — success.",),
        location="The Whispering Cellar",
        memories=(),
        language="cs",
    )

    narration = Narrator.narrate_offline(context)

    assert "inspect" in narration.lower() or "dveř" in narration.lower() or "pokus" in narration.lower()
    assert "you try to" not in narration.lower()


def test_offline_stream_yields_fallback_prose():
    context = NarrationContext(
        action="look around",
        events=("Exploration roll: 2 on a six-sided die.",),
        location="The Whispering Cellar",
        memories=(),
    )

    async def collect():
        return [chunk async for chunk in Narrator().stream(context)]

    chunks = asyncio.run(collect())

    assert len(chunks) == 1
    assert chunks[0]
