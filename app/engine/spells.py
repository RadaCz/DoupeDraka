"""SRD spell lists and the MVP's deterministic spell mechanics."""
from __future__ import annotations

import random
import re
from typing import TYPE_CHECKING

from .reference import SPELLS

if TYPE_CHECKING:
    from .models import CharacterState


SPELLCASTING_ABILITIES = {
    "bard": "cha",
    "cleric": "wis",
    "druid": "wis",
    "paladin": "cha",
    "ranger": "wis",
    "sorcerer": "cha",
    "warlock": "cha",
    "wizard": "int",
}

FULL_CASTERS = frozenset({"bard", "cleric", "druid", "sorcerer", "wizard"})
HALF_CASTERS = frozenset({"paladin", "ranger"})
PACT_CASTERS = frozenset({"warlock"})
PREPARED_CASTERS = frozenset({"cleric", "druid", "paladin", "ranger"})
CASTER_CLASSES = frozenset(SPELLCASTING_ABILITIES)

CLASS_SPELL_LISTS: dict[str, dict[int, tuple[str, ...]]] = {
    "bard": {
        0: ("Dancing Lights", "Light", "Mage Hand", "Mending", "Message", "Minor Illusion", "Prestidigitation", "Vicious Mockery"),
        1: ("Animal Friendship", "Bane", "Charm Person", "Comprehend Languages", "Cure Wounds", "Detect Magic", "Disguise Self", "Faerie Fire", "Feather Fall", "Healing Word", "Heroism", "Hideous Laughter", "Identify", "Illusory Script", "Longstrider", "Silent Image", "Sleep", "Speak with Animals", "Thunderwave", "Unseen Servant"),
    },
    "cleric": {
        0: ("Guidance", "Light", "Mending", "Resistance", "Sacred Flame", "Spare the Dying", "Thaumaturgy"),
        1: ("Bane", "Bless", "Command", "Create or Destroy Water", "Cure Wounds", "Detect Evil and Good", "Detect Magic", "Detect Poison and Disease", "Guiding Bolt", "Healing Word", "Inflict Wounds", "Protection from Evil and Good", "Purify Food and Drink", "Sanctuary", "Shield of Faith"),
    },
    "druid": {
        0: ("Druidcraft", "Guidance", "Mending", "Poison Spray", "Produce Flame", "Resistance", "Shillelagh"),
        1: ("Animal Friendship", "Charm Person", "Create or Destroy Water", "Cure Wounds", "Detect Magic", "Detect Poison and Disease", "Entangle", "Faerie Fire", "Fog Cloud", "Goodberry", "Healing Word", "Jump", "Longstrider", "Purify Food and Drink", "Speak with Animals", "Thunderwave"),
    },
    "paladin": {
        0: (),
        1: ("Bless", "Command", "Cure Wounds", "Detect Evil and Good", "Detect Magic", "Detect Poison and Disease", "Divine Favor", "Heroism", "Protection from Evil and Good", "Purify Food and Drink", "Shield of Faith"),
    },
    "ranger": {
        0: (),
        1: ("Alarm", "Animal Friendship", "Cure Wounds", "Detect Magic", "Detect Poison and Disease", "Fog Cloud", "Goodberry", "Hunter's Mark", "Jump", "Longstrider", "Speak with Animals"),
    },
    "sorcerer": {
        0: ("Acid Splash", "Chill Touch", "Dancing Lights", "Fire Bolt", "Light", "Mage Hand", "Mending", "Message", "Minor Illusion", "Poison Spray", "Prestidigitation", "Ray of Frost", "Shocking Grasp", "True Strike"),
        1: ("Burning Hands", "Charm Person", "Color Spray", "Comprehend Languages", "Detect Magic", "Disguise Self", "Expeditious Retreat", "False Life", "Feather Fall", "Fog Cloud", "Jump", "Mage Armor", "Magic Missile", "Shield", "Silent Image", "Sleep", "Thunderwave"),
    },
    "warlock": {
        0: ("Chill Touch", "Eldritch Blast", "Mage Hand", "Minor Illusion", "Poison Spray", "Prestidigitation", "True Strike"),
        1: ("Charm Person", "Comprehend Languages", "Expeditious Retreat", "Hellish Rebuke", "Illusory Script", "Protection from Evil and Good", "Unseen Servant"),
    },
    "wizard": {
        0: ("Acid Splash", "Chill Touch", "Dancing Lights", "Fire Bolt", "Light", "Mage Hand", "Mending", "Message", "Minor Illusion", "Poison Spray", "Prestidigitation", "Ray of Frost", "Shocking Grasp", "True Strike"),
        1: ("Alarm", "Burning Hands", "Charm Person", "Color Spray", "Comprehend Languages", "Detect Magic", "Disguise Self", "Expeditious Retreat", "False Life", "Feather Fall", "Find Familiar", "Floating Disk", "Fog Cloud", "Grease", "Hideous Laughter", "Identify", "Illusory Script", "Jump", "Longstrider", "Mage Armor", "Magic Missile", "Protection from Evil and Good", "Shield", "Silent Image", "Sleep", "Thunderwave", "Unseen Servant"),
    },
}

LEVEL_TWO_SPELL_LISTS: dict[str, tuple[str, ...]] = {
    "bard": ("Invisibility",),
    "cleric": (),
    "druid": (),
    "paladin": (),
    "ranger": (),
    "sorcerer": ("Invisibility", "Misty Step", "Scorching Ray"),
    "warlock": ("Invisibility", "Misty Step"),
    "wizard": ("Invisibility", "Misty Step", "Scorching Ray"),
}

STARTING_SPELLS = {
    "bard": ("Dancing Lights", "Vicious Mockery", "Cure Wounds", "Healing Word", "Faerie Fire", "Sleep"),
    "cleric": ("Guidance", "Sacred Flame", "Spare the Dying", "Cure Wounds", "Healing Word", "Bless"),
    "druid": ("Druidcraft", "Produce Flame", "Cure Wounds", "Healing Word", "Goodberry"),
    "paladin": ("Bless", "Cure Wounds", "Divine Favor", "Shield of Faith"),
    "ranger": ("Cure Wounds", "Fog Cloud", "Goodberry"),
    "sorcerer": ("Fire Bolt", "Ray of Frost", "Mage Hand", "Prestidigitation", "Magic Missile", "Burning Hands"),
    "warlock": ("Eldritch Blast", "Chill Touch", "Hellish Rebuke", "Charm Person"),
    "wizard": ("Fire Bolt", "Mage Hand", "Light", "Magic Missile", "Burning Hands", "Shield", "Detect Magic", "Mage Armor", "Sleep"),
}

MODELED_SPELL_EFFECTS = {
    "Bless": ("concentration_buff", "bless", None, None),
    "Shield of Faith": ("concentration_buff", "shield_of_faith", None, None),
    "Mage Armor": ("mage_armor", "", None, None),
    "Shield": ("reaction_shield", "", None, None),
    "Burning Hands": ("save_damage", "3d6", "dexterity", "half"),
    "Cure Wounds": ("heal", "1d8", None, None),
    "Eldritch Blast": ("spell_attack", "1d10", None, None),
    "Fire Bolt": ("spell_attack", "1d10", None, None),
    "Healing Word": ("heal", "1d4", None, None),
    "Magic Missile": ("auto_damage", "1d4", None, None),
    "Misty Step": ("teleport", "30", None, None),
    "Invisibility": ("concentration_buff", "invisible", None, None),
    "Scorching Ray": ("multi_attack", "2d6", None, None),
    "Sacred Flame": ("save_damage", "1d8", "dexterity", "none"),
    "Vicious Mockery": ("save_damage", "1d4", "wisdom", "none"),
}

SPELL_CASTING_META: dict[str, dict[str, bool | str]] = {
    "Bless": {"concentration": True, "casting_time": "action"},
    "Shield of Faith": {"concentration": True, "casting_time": "bonus"},
    "Mage Armor": {"concentration": False, "casting_time": "action"},
    "Shield": {"concentration": False, "casting_time": "reaction"},
    "Healing Word": {"concentration": False, "casting_time": "bonus"},
    "Misty Step": {"concentration": False, "casting_time": "bonus"},
    "Invisibility": {"concentration": True, "casting_time": "action"},
}

_SPELL_NAMES = {re.sub(r"\s+", " ", spell["name"].strip()).casefold(): spell for spell in SPELLS}


def spell_level(name: str) -> int | None:
    spell = _SPELL_NAMES.get(re.sub(r"\s+", " ", name.strip()).casefold())
    return int(spell["level"]) if spell else None


def _full_caster_slots(level: int) -> dict[int, int]:
    progression = (
        {1: 2}, {1: 3}, {1: 4, 2: 2}, {1: 4, 2: 3},
        {1: 4, 2: 3, 3: 2}, {1: 4, 2: 3, 3: 3},
        {1: 4, 2: 3, 3: 3, 4: 1}, {1: 4, 2: 3, 3: 3, 4: 2},
        {1: 4, 2: 3, 3: 3, 4: 3, 5: 1}, {1: 4, 2: 3, 3: 3, 4: 3, 5: 2},
        {1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1},
        {1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1},
        {1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1},
        {1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1},
        {1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1, 8: 1},
        {1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1, 8: 1},
        {1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1, 8: 1, 9: 1},
        {1: 4, 2: 3, 3: 3, 4: 3, 5: 3, 6: 1, 7: 1, 8: 1, 9: 1},
        {1: 4, 2: 3, 3: 3, 4: 3, 5: 3, 6: 2, 7: 1, 8: 1, 9: 1},
        {1: 4, 2: 3, 3: 3, 4: 3, 5: 3, 6: 2, 7: 2, 8: 1, 9: 1},
    )
    return dict(progression[max(1, min(20, level)) - 1])


def spell_slot_progression(character_class: str, level: int) -> dict[int, int]:
    level = max(1, min(20, level))
    if character_class in FULL_CASTERS:
        return _full_caster_slots(level)
    if character_class in HALF_CASTERS:
        return _full_caster_slots((level + 1) // 2) if level >= 2 else {}
    if character_class == "warlock":
        if level == 1:
            return {1: 1}
        slot_level = min(5, (level + 1) // 2)
        slot_count = 2 if level < 11 else 3 if level < 17 else 4
        return {slot_level: slot_count}
    return {}


def _ability_modifier(character: CharacterState, ability_code: str) -> int:
    ability = {"int": "intelligence", "wis": "wisdom", "cha": "charisma"}[ability_code]
    return (character.abilities[ability] - 10) // 2


def apply_creation_spell_choices(
    character: CharacterState,
    cantrips: list[str],
    level_one_spells: list[str],
) -> None:
    """Replace auto starters when the player chose spells at creation."""
    if not cantrips and not level_one_spells:
        return
    if character.character_class in PREPARED_CASTERS:
        character.prepared_spells = list(cantrips) + list(level_one_spells)
        character.known_spells = []
    else:
        character.known_spells = list(cantrips) + list(level_one_spells)
        character.prepared_spells = []


def initialize_spellcasting(character: CharacterState) -> None:
    """Set class-appropriate starting spells and slot capacity."""
    character.spellcasting_ability = SPELLCASTING_ABILITIES.get(character.character_class, "")
    character.spell_slots = spell_slot_progression(character.character_class, character.level)
    character.max_spell_slots = dict(character.spell_slots)
    character.known_spells = []
    character.prepared_spells = []
    if character.character_class not in CASTER_CLASSES:
        return

    starter = STARTING_SPELLS[character.character_class]
    if character.character_class in PREPARED_CASTERS:
        ability_mod = _ability_modifier(character, character.spellcasting_ability)
        prepared_limit = max(1, (character.level if character.character_class in {"cleric", "druid"} else character.level // 2) + ability_mod)
        if not character.spell_slots:
            prepared_limit = 0
        character.prepared_spells = [
            name for name in starter if spell_level(name) == 0
        ] + [
            name for name in starter if spell_level(name) == 1
        ][:prepared_limit]
    else:
        character.known_spells = list(starter)


def ensure_spellcasting(character: CharacterState) -> None:
    """Hydrate a legacy payload only when it predates every spellcasting field."""
    if character.character_class not in CASTER_CLASSES:
        return
    character.spell_slots = {
        int(level): int(count) for level, count in character.spell_slots.items()
    }
    character.max_spell_slots = {
        int(level): int(count) for level, count in character.max_spell_slots.items()
    }
    if not character.spellcasting_ability:
        initialize_spellcasting(character)
        return
    if not character.max_spell_slots and character.spell_slots:
        character.max_spell_slots = dict(character.spell_slots)


def advance_spellcasting(character: CharacterState) -> None:
    """Add newly gained slot capacity at level-up without restoring spent slots."""
    old_max = {int(level): count for level, count in character.max_spell_slots.items()}
    current = {int(level): count for level, count in character.spell_slots.items()}
    new_max = spell_slot_progression(character.character_class, character.level)
    for level, capacity in new_max.items():
        gained = max(0, capacity - old_max.get(level, 0))
        current[level] = min(capacity, current.get(level, 0) + gained)
    character.max_spell_slots = new_max
    character.spell_slots = {level: count for level, count in current.items() if count > 0}


def learn_level_up_spells(character: CharacterState, rng: random.Random) -> list[str]:
    """Apply the class's level-up spell learning/preparation at its new level."""
    character_class = character.character_class
    if character_class not in CASTER_CLASSES:
        return []

    max_spell_level = max(character.max_spell_slots, default=0)
    available = [
        spell
        for level, names in CLASS_SPELL_LISTS[character_class].items()
        if 0 < level <= max_spell_level
        for spell in names
    ]
    available.extend(
        spell for spell in LEVEL_TWO_SPELL_LISTS[character_class]
        if max_spell_level >= 2
    )

    if character_class in PREPARED_CASTERS:
        ability_mod = _ability_modifier(character, character.spellcasting_ability)
        if character_class in {"cleric", "druid"}:
            prepared_limit = max(1, character.level + ability_mod)
        else:
            prepared_limit = max(1, character.level // 2 + ability_mod)
        if not max_spell_level:
            prepared_limit = 0
        prepared = list(character.prepared_spells)
        candidates = [spell for spell in available if spell not in prepared]
        prepared_count = sum((spell_level(spell) or 0) > 0 for spell in prepared)
        additions = candidates[:max(0, prepared_limit - prepared_count)]
        character.prepared_spells.extend(additions)
        return additions

    known = set(character.known_spells)
    candidates = [spell for spell in available if spell not in known]
    count = 2 if character_class == "wizard" else 1
    additions = rng.sample(candidates, min(count, len(candidates)))
    character.known_spells.extend(additions)
    return additions
