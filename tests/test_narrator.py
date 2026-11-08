import asyncio

from app.narrator import NarrationContext, Narrator


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

    assert "cast" in narration
    assert "you act" not in narration.lower()
    assert "flee" not in narration
    assert "run" not in narration


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

    assert "Caldus welcomes the shrine bell back" in narration
    assert "5 gold" in narration or "reward recorded" in narration


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
