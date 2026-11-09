from app.engine.models import CharacterState
from app.narration_dossier import narration_beats_from_journal, scene_dossier_for_character


def test_narration_beats_strip_engine_facts_block():
    journal = "The cellar whispers.\n\nExploration roll: 4 on a d6.\nYou find gold."
    beats = narration_beats_from_journal([journal])
    assert len(beats) == 1
    assert beats[0] == "The cellar whispers."
    assert "Exploration roll" not in beats[0]


def test_npc_dossier_omits_vault_secrets_until_hint():
    character = CharacterState(
        id="c2",
        owner_id=1,
        name="B",
        race="Human",
        character_class="Cleric",
        location="The Shrine of the Forgotten",
        quest_flags={"bell_quest_complete": True},
    )
    dossier = scene_dossier_for_character(character)
    caldus = next(n for n in dossier["npcs_present"] if n["id"] == "caldus")
    assert "does_not_know" in caldus
    assert "Vault" in caldus["does_not_know"][0]

    character.quest_flags["vault_hint_given"] = True
    dossier2 = scene_dossier_for_character(character)
    caldus2 = next(n for n in dossier2["npcs_present"] if n["id"] == "caldus")
    assert "does_not_know" not in caldus2
    assert any("Vault of Echoes" in line for line in caldus2["knows"])


def test_quest_hint_hides_vault_before_caldus_reveals_it():
    character = CharacterState(
        id="c4",
        owner_id=1,
        name="D",
        race="Human",
        character_class="Fighter",
        location="The Shrine of the Forgotten",
        quest_flags={"bell_quest_complete": True},
    )
    dossier = scene_dossier_for_character(character)
    hint = dossier["quests"]["active_step"]["hint"]
    assert "Vault of Echoes" not in hint


def test_npc_dossier_hides_bell_topic_before_quest_accepted():
    character = CharacterState(
        id="c3",
        owner_id=1,
        name="C",
        race="Elf",
        character_class="Rogue",
        location="The Goblin Market",
        quest_flags={},
    )
    dossier = scene_dossier_for_character(character)
    nib = next(n for n in dossier["npcs_present"] if n["id"] == "nib")
    assert "does_not_know" in nib
    assert not any("shrine bell theft is a live topic" in k.lower() for k in nib.get("knows", []))


def test_scene_dossier_includes_quest_and_combat():
    character = CharacterState(
        id="c1",
        owner_id=1,
        name="Aria",
        race="Human",
        character_class="Fighter",
        location="The Whispering Cellar",
        quest_flags={"bell_quest_accepted": True},
        in_combat=True,
        combatant={
            "name": "Goblin scout",
            "hp": 4,
            "max_hp": 7,
            "armor_class": 13,
            "attack_bonus": 4,
            "damage": "1d6+2",
            "reward_xp": 50,
        },
    )
    dossier = scene_dossier_for_character(character)
    assert dossier["hero"]["name"] == "Aria"
    assert dossier["quests"]["completed_step_ids"] == ["bell_quest_accepted"]
    assert dossier["combat"]["enemy_name"] == "Goblin scout"
