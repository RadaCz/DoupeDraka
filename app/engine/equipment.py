"""SRD 5.1–aligned weapon definitions used by the combat ruleset v1."""

from dataclasses import dataclass, field

from .models import CharacterState


@dataclass(frozen=True)
class WeaponDefinition:
    key: str
    name: str
    damage: str
    ability: str
    finesse: bool = False


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
        if key in WEAPONS:
            return key
    return "unarmed"


def equipped_weapon(character: CharacterState) -> WeaponDefinition:
    for entry in character.item_instances:
        if entry.get("equipped") and entry.get("definition_id") in WEAPONS:
            return WEAPONS[entry["definition_id"]]
    return WEAPONS[weapon_key_from_inventory(character.inventory)]


def _ability_mod(score: int) -> int:
    return (score - 10) // 2


def attack_modifier(character: CharacterState, weapon: WeaponDefinition) -> int:
    strength = character.abilities.get("strength", 10)
    dexterity = character.abilities.get("dexterity", 10)
    if weapon.finesse:
        mod = max(_ability_mod(strength), _ability_mod(dexterity))
    else:
        mod = _ability_mod(character.abilities.get(weapon.ability, strength))
    return proficiency_bonus(character.level) + mod


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
        definition = WEAPONS.get(key)
        equipped = bool(definition and not equipped_weapon_set)
        if equipped:
            equipped_weapon_set = True
        instances.append({
            "instance_id": f"gear-{index}",
            "definition_id": definition.key if definition else key.replace(" ", "_"),
            "name": label,
            "equipped": equipped,
        })
    return instances
