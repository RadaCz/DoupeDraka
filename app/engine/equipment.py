"""SRD 5.1–aligned weapon definitions used by the combat ruleset v1."""

from dataclasses import dataclass, field

from .models import CharacterState
from .reference import CLASS_SPECS

MARTIAL_WEAPON_KEYS = frozenset({"shortsword", "longsword", "rapier"})
SIMPLE_WEAPON_KEYS = frozenset({"mace", "dagger", "unarmed"})


@dataclass(frozen=True)
class WeaponDefinition:
    key: str
    name: str
    damage: str
    ability: str
    finesse: bool = False


# Inventory labels that map to a weapon definition plus optional attack bonus (magic gear).
INVENTORY_GEAR: dict[str, tuple[str | None, int]] = {
    "shortsword +1": ("shortsword", 1),
    "shortsword": ("shortsword", 0),
    "longsword": ("longsword", 0),
    "rapier": ("rapier", 0),
    "mace": ("mace", 0),
    "dagger": ("dagger", 0),
    "healing potion": (None, 0),
}


WEAPONS: dict[str, WeaponDefinition] = {
    "unarmed": WeaponDefinition("unarmed", "unarmed strike", "1d4", "strength"),
    "shortsword": WeaponDefinition("shortsword", "shortsword", "1d6", "strength", finesse=True),
    "longsword": WeaponDefinition("longsword", "longsword", "1d8", "strength"),
    "rapier": WeaponDefinition("rapier", "rapier", "1d8", "dexterity", finesse=True),
    "mace": WeaponDefinition("mace", "mace", "1d6", "strength"),
    "dagger": WeaponDefinition("dagger", "dagger", "1d4", "strength", finesse=True),
}


def proficiency_bonus(level: int) -> int:
    return 2 + max(0, (level - 1) // 4)


def weapon_key_from_inventory(inventory: list[str]) -> str:
    for item in inventory:
        key = item.casefold().strip()
        mapped = INVENTORY_GEAR.get(key)
        if mapped and mapped[0]:
            return mapped[0]
        if key in WEAPONS:
            return key
    return "unarmed"


def item_attack_bonus(character: CharacterState) -> int:
    for entry in character.item_instances:
        if entry.get("equipped"):
            return int(entry.get("attack_bonus", 0))
    return 0


def equipped_weapon(character: CharacterState) -> WeaponDefinition:
    for entry in character.item_instances:
        if entry.get("equipped") and entry.get("definition_id") in WEAPONS:
            return WEAPONS[entry["definition_id"]]
    return WEAPONS[weapon_key_from_inventory(character.inventory)]


def _ability_mod(score: int) -> int:
    return (score - 10) // 2


def weapon_proficiency(character: CharacterState, weapon_key: str) -> bool:
    spec = CLASS_SPECS.get(character.character_class)
    if spec is None:
        return weapon_key == "unarmed"
    proficiencies = {entry.casefold() for entry in spec.weapons}
    if weapon_key in proficiencies:
        return True
    if "simple" in proficiencies and weapon_key in SIMPLE_WEAPON_KEYS:
        return True
    if "martial" in proficiencies and weapon_key in MARTIAL_WEAPON_KEYS:
        return True
    return weapon_key == "unarmed"


def attack_modifier(character: CharacterState, weapon: WeaponDefinition) -> int:
    strength = character.abilities.get("strength", 10)
    dexterity = character.abilities.get("dexterity", 10)
    if weapon.finesse:
        mod = max(_ability_mod(strength), _ability_mod(dexterity))
    else:
        mod = _ability_mod(character.abilities.get(weapon.ability, strength))
    prof = proficiency_bonus(character.level) if weapon_proficiency(character, weapon.key) else 0
    return prof + mod


def damage_modifier(character: CharacterState, weapon: WeaponDefinition) -> int:
    strength = character.abilities.get("strength", 10)
    dexterity = character.abilities.get("dexterity", 10)
    if weapon.finesse:
        return max(_ability_mod(strength), _ability_mod(dexterity))
    return _ability_mod(character.abilities.get(weapon.ability, strength))


def default_item_instances(inventory: list[str]) -> list[dict]:
    instances: list[dict] = []
    equipped_weapon_set = False
    for index, label in enumerate(inventory):
        key = label.casefold().strip()
        gear = INVENTORY_GEAR.get(key)
        definition = WEAPONS.get(gear[0]) if gear and gear[0] else WEAPONS.get(key)
        attack_bonus = gear[1] if gear else 0
        equipped = bool(definition and not equipped_weapon_set)
        if equipped:
            equipped_weapon_set = True
        instances.append({
            "instance_id": f"gear-{index}",
            "definition_id": definition.key if definition else key.replace(" ", "_"),
            "name": label,
            "equipped": equipped,
            "attack_bonus": attack_bonus if equipped else 0,
        })
    return instances
