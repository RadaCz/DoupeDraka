"""Rules reference data for the Mini App tooltips.

Kept deliberately data-only so the API can serve it and the tests can assert
consistency. Rule text is summarized 5e wording, not a rules engine.
"""
import json
from dataclasses import dataclass, field
from pathlib import Path

from .catalog import ABILITY_ORDER


@dataclass(frozen=True)
class Trait:
    name: str
    text: str


@dataclass(frozen=True)
class RaceSpec:
    name: str
    speed: int
    ability_increase: dict[str, int]
    traits: tuple[Trait, ...]
    subraces: tuple[str, ...] = ()


DRACONIC_ANCESTRY = {
    "black": ("Acid", "5 by 30 ft. line (DEX save)"),
    "blue": ("Lightning", "5 by 30 ft. line (DEX save)"),
    "brass": ("Fire", "5 by 30 ft. line (DEX save)"),
    "bronze": ("Lightning", "5 by 30 ft. line (DEX save)"),
    "copper": ("Acid", "5 by 30 ft. line (DEX save)"),
    "gold": ("Fire", "15 ft. cone (DEX save)"),
    "green": ("Poison", "15 ft. cone (CON save)"),
    "red": ("Fire", "15 ft. cone (DEX save)"),
    "silver": ("Cold", "15 ft. cone (CON save)"),
    "white": ("Cold", "15 ft. cone (CON save)"),
}

RACE_SPECS: dict[str, RaceSpec] = {
    "human": RaceSpec(
        "Human", 30,
        {ability: 1 for ability in ABILITY_ORDER},
        (Trait("Versatile", "One extra language of your choice."),),
    ),
    "elf": RaceSpec(
        "Elf", 30, {"dexterity": 2},
        (
            Trait("Darkvision", "You can see in dim light within 60 ft. as if it were bright light."),
            Trait("Keen Senses", "You have proficiency in the Perception skill."),
            Trait("Fey Ancestry", "You have advantage on saves against being charmed, and magic cannot put you to sleep."),
            Trait("Trance", "Elves do not sleep; you meditate for 4 hours to gain a long rest."),
        ),
        ("high_elf", "wood_elf", "dark_elf"),
    ),
    "dwarf": RaceSpec(
        "Dwarf", 25, {"constitution": 2},
        (
            Trait("Darkvision", "You can see in dim light within 60 ft. as if it were bright light."),
            Trait("Dwarven Resilience", "Advantage on saves against poison, plus resistance to poison damage."),
            Trait("Dwarven Combat Training", "Proficiency with battleaxe, handaxe, light hammer and warhammer."),
            Trait("Stonecunning", "Double proficiency bonus on History checks about stonework."),
        ),
        ("hill_dwarf", "mountain_dwarf"),
    ),
    "halfling": RaceSpec(
        "Halfling", 25, {"dexterity": 2},
        (
            Trait("Lucky", "When you roll a 1 on an attack, ability check or save, you can reroll it once."),
            Trait("Brave", "You have advantage on saves against being frightened."),
            Trait("Halfling Nimbleness", "You can move through the space of any creature larger than you."),
        ),
        ("lightfoot", "stout"),
    ),
    "dragonborn": RaceSpec(
        "Dragonborn", 30, {"strength": 2, "charisma": 1},
        (
            Trait("Draconic Ancestry", "Choose a dragon type; it sets your breath weapon and damage resistance."),
            Trait("Breath Weapon", "Exhale energy in a line or cone; the target saves for half damage."),
            Trait("Damage Resistance", "You have resistance to the damage type of your ancestry."),
        ),
        tuple(DRACONIC_ANCESTRY),
    ),
    "gnome": RaceSpec(
        "Gnome", 25, {"intelligence": 2},
        (
            Trait("Darkvision", "You can see in dim light within 60 ft. as if it were bright light."),
            Trait("Gnome Cunning", "Advantage on INT, WIS and CHA saves against magic."),
        ),
        ("forest_gnome", "rock_gnome"),
    ),
    "half_elf": RaceSpec(
        "Half-Elf", 30, {"charisma": 2},
        (
            Trait("Darkvision", "You can see in dim light within 60 ft. as if it were bright light."),
            Trait("Fey Ancestry", "Advantage on saves against being charmed, and magic cannot put you to sleep."),
            Trait("Skill Versatility", "Proficiency in two skills of your choice."),
        ),
    ),
    "half_orc": RaceSpec(
        "Half-Orc", 30, {"strength": 2, "constitution": 1},
        (
            Trait("Darkvision", "You can see in dim light within 60 ft. as if it were bright light."),
            Trait("Relentless Endurance", "When reduced to 0 HP you drop to 1 HP instead, once per long rest."),
            Trait("Savage Attacks", "On a critical hit you roll one of the weapon's damage dice again."),
        ),
    ),
    "tiefling": RaceSpec(
        "Tiefling", 30, {"charisma": 2, "intelligence": 1},
        (
            Trait("Darkvision", "You can see in dim light within 60 ft. as if it were bright light."),
            Trait("Hellish Resistance", "You have resistance to fire damage."),
            Trait("Infernal Legacy",
                  "You know Thaumaturgy; at level 3 Hellish Rebuke, at level 5 Darkness."),
        ),
    ),
}


@dataclass(frozen=True)
class SubclassSpec:
    name: str
    text: str


@dataclass(frozen=True)
class ClassSpec:
    name: str
    hit_die: int
    primary: str
    saving_throws: tuple[str, ...]
    armor: tuple[str, ...]
    weapons: tuple[str, ...]
    subclasses: tuple[SubclassSpec, ...] = field(default_factory=tuple)


CLASS_SPECS: dict[str, ClassSpec] = {
    "barbarian": ClassSpec(
        "Barbarian", 12, "strength", ("strength", "constitution"),
        ("light", "medium", "shields"), ("simple", "martial"),
        (
            SubclassSpec("Path of the Berserker", "Enter a frenzy while raging, gaining a bonus-action melee attack and risking exhaustion."),
        ),
    ),
    "bard": ClassSpec(
        "Bard", 8, "charisma", ("dexterity", "charisma"),
        ("light",), ("simple", "hand crossbows", "longswords", "rapiers", "shortswords"),
        (
            SubclassSpec("College of Lore", "Gain extra skill proficiencies and use Cutting Words to hinder foes."),
        ),
    ),
    "cleric": ClassSpec(
        "Cleric", 8, "wisdom", ("wisdom", "charisma"),
        ("light", "medium", "shields"), ("simple",),
        (
            SubclassSpec("Life Domain", "Strengthen healing magic and gain heavy armor proficiency."),
        ),
    ),
    "druid": ClassSpec(
        "Druid", 8, "wisdom", ("intelligence", "wisdom"),
        ("light", "medium", "shields"), ("clubs", "daggers", "darts", "javelins", "maces", "quarterstaffs", "scimitars", "sickles", "slings", "spears"),
        (
            SubclassSpec("Circle of the Land", "Recover spell slots on a short rest and learn extra terrain-based spells."),
        ),
    ),
    "fighter": ClassSpec(
        "Fighter", 10, "strength", ("strength", "constitution"),
        ("light", "medium", "heavy", "shields"), ("simple", "martial"),
        (
            SubclassSpec("Champion", "Brutally simple: wider critical range and better athletics."),
        ),
    ),
    "ranger": ClassSpec(
        "Ranger", 10, "dexterity", ("strength", "dexterity"),
        ("light", "medium", "shields"), ("simple", "martial"),
        (
            SubclassSpec("Hunter", "Colossus Slayer and Horde Breaker: steady, reliable damage."),
        ),
    ),
    "rogue": ClassSpec(
        "Rogue", 8, "dexterity", ("dexterity", "intelligence"),
        ("light",), ("simple", "hand crossbows", "longswords", "rapiers", "shortswords"),
        (
            SubclassSpec("Thief", "Use Fast Hands and Second-Story Work to excel at quick tasks and climbing."),
        ),
    ),
    "warlock": ClassSpec(
        "Warlock", 8, "charisma", ("wisdom", "charisma"),
        ("light",), ("simple",),
        (
            SubclassSpec("The Fiend", "Gain temporary hit points when you reduce a hostile creature to 0 hit points."),
        ),
    ),
    "paladin": ClassSpec(
        "Paladin", 10, "strength", ("wisdom", "charisma"),
        ("light", "medium", "heavy", "shields"), ("simple", "martial"),
        (
            SubclassSpec("Oath of Devotion", "Sacred Weapon and Turn the Unholy; the classic knight."),
        ),
    ),
    "monk": ClassSpec(
        "Monk", 8, "dexterity", ("strength", "dexterity"),
        (), ("simple", "shortswords"),
        (
            SubclassSpec("Way of the Open Hand", "Flurry of Blows that knocks targets prone or pushes them."),
        ),
    ),
    "sorcerer": ClassSpec(
        "Sorcerer", 6, "charisma", ("constitution", "charisma"),
        (), ("daggers", "darts", "slings", "quarterstaffs", "light crossbows"),
        (
            SubclassSpec("Draconic Bloodline", "Draconic resilience raises your AC and grants extra HP."),
        ),
    ),
    "wizard": ClassSpec(
        "Wizard", 6, "intelligence", ("intelligence", "wisdom"),
        (), ("daggers", "darts", "slings", "quarterstaffs", "light crossbows"),
        (
            SubclassSpec("School of Evocation", "Shape your blasts around allies and add INT to damage."),
        ),
    ),
}

# Every class the engine can create has a full ClassSpec above; a test asserts
# that `set(CLASSES) <= set(CLASS_SPECS)` so the two can never silently drift.


with Path(__file__).with_name("srd_spells.json").open(encoding="utf-8") as source:
   SPELLS = tuple(json.load(source))

FEATS = (
   {
       "name": "Grappler",
       "prerequisite": "Strength 13 or higher",
       "benefits": [
           "You have advantage on attack rolls against a creature you are grappling.",
           "You can use an action and make a grapple check to pin a creature you grapple; on success, both of you are restrained until the grapple ends.",
       ],
   },
)

BACKGROUNDS = (
   {
       "name": "Acolyte",
       "skill_proficiencies": ["Insight", "Religion"],
       "languages": "Two of your choice",
       "equipment": [
           "Holy symbol",
           "Prayer book or prayer wheel",
           "Five sticks of incense",
           "Vestments",
           "Common clothes",
           "Pouch containing 15 gp",
       ],
       "feature": {
           "name": "Shelter of the Faithful",
           "text": "Temples of your faith provide you and your companions ordinary support and care.",
       },
   },
)


def race_list() -> list[dict]:
    return [
        {
            "key": key,
            "name": spec.name,
            "speed": spec.speed,
            "ability_increase": spec.ability_increase,
            "subraces": list(spec.subraces),
            "traits": [{"name": trait.name, "text": trait.text} for trait in spec.traits],
        }
        for key, spec in RACE_SPECS.items()
    ]


def class_list() -> list[dict]:
    return [
        {
            "key": key,
            "name": spec.name,
            "hit_die": spec.hit_die,
            "primary": spec.primary,
            "saving_throws": list(spec.saving_throws),
            "armor": list(spec.armor),
            "weapons": list(spec.weapons),
            "subclasses": [{"name": sub.name, "text": sub.text} for sub in spec.subclasses],
        }
        for key, spec in CLASS_SPECS.items()
    ]


def draconic_ancestry() -> dict[str, dict[str, str]]:
    return {
        key: {"damage_type": damage, "breath_weapon": breath}
        for key, (damage, breath) in DRACONIC_ANCESTRY.items()
    }


def feat_list() -> list[dict]:
    return [
        {**feat, "benefits": list(feat["benefits"])}
        for feat in FEATS
    ]


def background_list() -> list[dict]:
    return [
        {
            **background,
            "skill_proficiencies": list(background["skill_proficiencies"]),
            "equipment": list(background["equipment"]),
            "feature": dict(background["feature"]),
        }
        for background in BACKGROUNDS
    ]


__all__ = [
    "RACE_SPECS", "CLASS_SPECS", "SPELLS", "FEATS", "BACKGROUNDS",
    "DRACONIC_ANCESTRY", "race_list", "class_list", "draconic_ancestry",
    "feat_list", "background_list",
]