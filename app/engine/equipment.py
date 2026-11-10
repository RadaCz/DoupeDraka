"""SRD 5.1–aligned weapon definitions used by the combat ruleset v1."""

from dataclasses import dataclass, field

from .models import CharacterState
from .reference import CLASS_SPECS

MARTIAL_WEAPON_KEYS = frozenset({"shortsword", "longsword", "rapier"})
SIMPLE_WEAPON_KEYS = frozenset({"mace", "dagger", "unarmed"})

STARTING_INVENTORY_BY_CLASS: dict[str, list[str]] = {
    "fighter": ["traveler's clothes", "shortsword"],
    "rogue": ["traveler's clothes", "shortsword", "dagger"],
    "cleric": ["traveler's clothes", "mace"],
    "wizard": ["traveler's clothes", "dagger"],
}


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
    if f"{weapon_key}s" in proficiencies:
        return True
    singular = weapon_key.rstrip("s") if weapon_key.endswith("s") else ""
    if singular and singular in proficiencies:
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


def weapon_for_inventory_label(label: str) -> WeaponDefinition | None:
    key = label.casefold().strip()
    gear = INVENTORY_GEAR.get(key)
    if gear and gear[0]:
        return WEAPONS.get(gear[0])
    if key in WEAPONS:
        return WEAPONS[key]
    return None


def resolve_inventory_label(inventory: list[str], query: str) -> str | None:
    """Match a player phrase to one carried item label."""
    needle = query.casefold().strip()
    if not needle:
        return None
    for item in inventory:
        if item.casefold().strip() == needle:
            return item
    for item in inventory:
        if needle in item.casefold():
            return item
    return None


def set_equipped_weapon(character: CharacterState, query: str) -> tuple[bool, str]:
    label = resolve_inventory_label(character.inventory, query)
    if label is None:
        return False, f"You do not carry {query.strip() or 'that item'}."
    weapon = weapon_for_inventory_label(label)
    if weapon is None:
        return False, f"{label} cannot be wielded as a weapon."
    if not weapon_proficiency(character, weapon.key):
        return False, (
            f"Your {character.character_class.replace('_', ' ')} training does not cover "
            f"a {weapon.name}."
        )
    key = label.casefold().strip()
    gear = INVENTORY_GEAR.get(key)
    attack_bonus = gear[1] if gear else 0
    instances = default_item_instances(character.inventory, character)
    for entry in instances:
        entry_weapon = weapon_for_inventory_label(entry.get("name", ""))
        if entry.get("name", "").casefold().strip() == key:
            entry["equipped"] = True
            entry["attack_bonus"] = attack_bonus
        elif entry_weapon:
            entry["equipped"] = False
            entry["attack_bonus"] = 0
    character.item_instances = instances
    bonus_text = f" (+{attack_bonus} attack)" if attack_bonus else ""
    return True, f"You ready your {weapon.name}{bonus_text}."


def default_item_instances(
    inventory: list[str],
    character: CharacterState | None = None,
    *,
    preserve_equipped: dict[str, int] | None = None,
) -> list[dict]:
    instances: list[dict] = []
    equipped_weapon_set = False
    for index, label in enumerate(inventory):
        key = label.casefold().strip()
        gear = INVENTORY_GEAR.get(key)
        definition = WEAPONS.get(gear[0]) if gear and gear[0] else WEAPONS.get(key)
        attack_bonus = gear[1] if gear else 0
        equipped = False
        if preserve_equipped is not None and key in preserve_equipped and definition:
            if character is None or weapon_proficiency(character, definition.key):
                equipped = True
                attack_bonus = preserve_equipped[key]
        elif preserve_equipped is None and definition and not equipped_weapon_set:
            if character is None or weapon_proficiency(character, definition.key):
                equipped = True
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


def sync_item_instances(character: CharacterState) -> None:
    """Rebuild item_instances from inventory without resetting equipped weapons."""
    preserve: dict[str, int] = {}
    for entry in character.item_instances:
        if entry.get("equipped"):
            name = entry.get("name", "").casefold().strip()
            if name:
                preserve[name] = int(entry.get("attack_bonus", 0))
    character.item_instances = default_item_instances(
        character.inventory,
        character,
        preserve_equipped=preserve if preserve else None,
    )
