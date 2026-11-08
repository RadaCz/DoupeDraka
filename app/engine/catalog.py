from dataclasses import dataclass

@dataclass(frozen=True)
class ClassSpec:
    name: str
    hit_die: int
    primary: str
    mana: int = 0
    # Starting armor as (base AC, dexterity cap). A cap of 0 means "no dexterity
    # bonus" (heavy armor); None means uncapped. Without armor a level-1 martial
    # character has AC 11 and loses to a standard 5e goblin almost every time.
    armor: tuple[int, int | None] = (10, None)

CLASSES = {
    "barbarian": ClassSpec("Barbarian", 12, "strength", armor=(14, 2)),  # scale mail
    "bard": ClassSpec("Bard", 8, "charisma", 2, armor=(11, None)),  # leather
    "cleric": ClassSpec("Cleric", 8, "wisdom", 2, armor=(14, 2)),  # scale mail
    "druid": ClassSpec("Druid", 8, "wisdom", 2, armor=(11, None)),  # leather
    "fighter": ClassSpec("Fighter", 10, "strength", armor=(16, 0)),  # chain mail
    "monk": ClassSpec("Monk", 8, "dexterity", armor=(10, None)),  # unarmored
    "paladin": ClassSpec("Paladin", 10, "strength", 1, armor=(16, 0)),  # chain mail
    "ranger": ClassSpec("Ranger", 10, "dexterity", 1, armor=(14, 2)),  # scale mail
    "rogue": ClassSpec("Rogue", 8, "dexterity", armor=(11, None)),  # leather
    "sorcerer": ClassSpec("Sorcerer", 6, "charisma", 3, armor=(10, None)),
    "warlock": ClassSpec("Warlock", 8, "charisma", 2, armor=(11, None)),  # leather
    "wizard": ClassSpec("Wizard", 6, "intelligence", 3, armor=(10, None)),
}
RACES = ("human", "elf", "dwarf", "halfling", "dragonborn", "gnome", "half_elf", "half_orc", "tiefling")
ABILITY_ORDER = ("strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma")

STANDARD_ARRAY = (15, 14, 13, 12, 10, 8)

def standard_abilities(character_class: str) -> dict[str, int]:
    """Assign the 5e standard array so the class's primary ability is highest.

    A default character must be able to hit AC 13; all-10 scores cannot.
    """
    primary = CLASSES[character_class].primary
    order = []
    for ability in (primary, "constitution", "dexterity", *ABILITY_ORDER):
        if ability not in order:
            order.append(ability)
    return dict(zip(order, STANDARD_ARRAY))