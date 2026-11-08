"""Pre-made heroes for the ready-made character paths.

Blank characters used to receive all-10 ability scores, which cannot reliably hit
AC 13, so a brand new player could lose their first fight without doing anything
wrong. The 5e standard array (owned by the engine catalog) fixes that and is what
the pre-made heroes build on.
"""
from dataclasses import dataclass, field

from .engine.catalog import standard_abilities


@dataclass(frozen=True)
class HeroPreset:
    key: str
    name: str
    race: str
    character_class: str
    role: str
    abilities: dict[str, int] = field(default_factory=dict)

    def payload(self) -> dict:
        return {
            "name": self.name,
            "race": self.race,
            "character_class": self.character_class,
            "abilities": dict(self.abilities),
        }


def _abilities(character_class: str, **overrides: int) -> dict[str, int]:
    return standard_abilities(character_class) | overrides


HEROES: dict[str, HeroPreset] = {
    "tank": HeroPreset(
        key="tank",
        name="Grath",
        race="human",
        character_class="fighter",
        role="Tank",
        abilities=_abilities("fighter", strength=16, constitution=16, dexterity=12, intelligence=8),
    ),
    "skirmisher": HeroPreset(
        key="skirmisher",
        name="Vela",
        race="halfling",
        character_class="rogue",
        role="Skirmisher",
        # Dexterity drives both attack and armor class, so she dodges and stabs.
        abilities=_abilities("rogue", dexterity=16, constitution=14, wisdom=11, strength=8),
    ),
    "support": HeroPreset(
        key="support",
        name="Lyra",
        race="elf",
        character_class="wizard",
        role="Support",
        abilities=_abilities("wizard", intelligence=16, dexterity=16, constitution=14, strength=8),
    ),
    "healer": HeroPreset(
        key="healer",
        name="Brom",
        race="dwarf",
        character_class="cleric",
        role="Healer",
        # Wisdom casting plus heavy constitution: durable and mana-rich.
        abilities=_abilities("cleric", wisdom=16, constitution=15, strength=12, dexterity=10),
    ),
}


def get_hero(key: str) -> HeroPreset:
    try:
        return HEROES[key]
    except KeyError as error:
        raise ValueError(f"Unknown preset: {key}") from error