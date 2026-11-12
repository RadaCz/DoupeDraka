"""SRD 5.1–aligned equipment: weapons, armor, shields, and armor class."""

from __future__ import annotations

from dataclasses import dataclass

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

# Level-1 MVP class body armor added when missing from creation packages (SRD training).
STARTING_BODY_ARMOR: dict[str, str] = {
    "fighter": "chain mail",
    "cleric": "scale mail",
    "rogue": "leather armor",
}


@dataclass(frozen=True)
class WeaponDefinition:
    key: str
    name: str
    damage: str
    ability: str
    finesse: bool = False
    weapon_type: str = "melee"
    range_normal_ft: int = 5
    range_long_ft: int = 5
    thrown_normal_ft: int = 0
    thrown_long_ft: int = 0
    ammunition: str = ""
    properties: tuple[str, ...] = ()
    damage_type: str = "slashing"


@dataclass(frozen=True)
class ArmorDefinition:
    key: str
    name: str
    category: str  # light | medium | heavy
    base_ac: int
    max_dex_bonus: int | None = None  # None = full DEX
    strength_requirement: int = 0
    stealth_disadvantage: bool = False


SHIELD_KEY = "shield"
SHIELD_AC_BONUS = 2


ARMORS: dict[str, ArmorDefinition] = {
    "leather_armor": ArmorDefinition("leather_armor", "leather armor", "light", 11),
    "studded_leather": ArmorDefinition("studded_leather", "studded leather", "light", 12),
    "scale_mail": ArmorDefinition("scale_mail", "scale mail", "medium", 14, max_dex_bonus=2),
    "chain_mail": ArmorDefinition("chain_mail", "chain mail", "heavy", 16, max_dex_bonus=0, strength_requirement=13, stealth_disadvantage=True),
    SHIELD_KEY: ArmorDefinition(SHIELD_KEY, "shield", "shield", SHIELD_AC_BONUS),
}

# Inventory label -> (definition key, attack bonus for weapons only)
INVENTORY_GEAR: dict[str, tuple[str | None, int]] = {
    "shortsword +1": ("shortsword", 1),
    "shortsword": ("shortsword", 0),
    "longsword": ("longsword", 0),
    "rapier": ("rapier", 0),
    "mace": ("mace", 0),
    "dagger": ("dagger", 0),
    "longbow": ("longbow", 0),
    "shortbow": ("shortbow", 0),
    "light crossbow": ("light_crossbow", 0),
    "heavy crossbow": ("heavy_crossbow", 0),
    "javelin": ("javelin", 0),
    "spear": ("spear", 0),
    "handaxe": ("handaxe", 0),
    "quarterstaff": ("quarterstaff", 0),
    "20 arrows": (None, 0),
    "19 arrows": (None, 0),
    "healing potion": (None, 0),
    "leather armor": ("leather_armor", 0),
    "studded leather": ("studded_leather", 0),
    "scale mail": ("scale_mail", 0),
    "chain mail": ("chain_mail", 0),
    "shield": (SHIELD_KEY, 0),
}


WEAPONS: dict[str, WeaponDefinition] = {
    "unarmed": WeaponDefinition("unarmed", "unarmed strike", "1d4", "strength", damage_type="bludgeoning"),
    "shortsword": WeaponDefinition("shortsword", "shortsword", "1d6", "strength", finesse=True),
    "longsword": WeaponDefinition("longsword", "longsword", "1d8", "strength"),
    "rapier": WeaponDefinition("rapier", "rapier", "1d8", "dexterity", finesse=True),
    "mace": WeaponDefinition("mace", "mace", "1d6", "strength", damage_type="bludgeoning"),
    "dagger": WeaponDefinition(
        "dagger", "dagger", "1d4", "strength", finesse=True, thrown_normal_ft=20, thrown_long_ft=60
    ),
    "quarterstaff": WeaponDefinition(
        "quarterstaff", "quarterstaff", "1d6", "strength", damage_type="bludgeoning"
    ),
    "handaxe": WeaponDefinition(
        "handaxe", "handaxe", "1d6", "strength", thrown_normal_ft=20, thrown_long_ft=60
    ),
    "javelin": WeaponDefinition(
        "javelin", "javelin", "1d6", "strength", thrown_normal_ft=30, thrown_long_ft=120, damage_type="piercing"
    ),
    "spear": WeaponDefinition(
        "spear", "spear", "1d6", "strength", thrown_normal_ft=20, thrown_long_ft=60, damage_type="piercing"
    ),
    "shortbow": WeaponDefinition(
        "shortbow",
        "shortbow",
        "1d6",
        "dexterity",
        weapon_type="ranged",
        range_normal_ft=80,
        range_long_ft=320,
        ammunition="arrow",
        properties=("ammunition", "two-handed"),
        damage_type="piercing",
    ),
    "longbow": WeaponDefinition(
        "longbow",
        "longbow",
        "1d8",
        "dexterity",
        weapon_type="ranged",
        range_normal_ft=150,
        range_long_ft=600,
        ammunition="arrow",
        properties=("ammunition", "heavy", "two-handed"),
        damage_type="piercing",
    ),
    "light_crossbow": WeaponDefinition(
        "light_crossbow",
        "light crossbow",
        "1d8",
        "dexterity",
        weapon_type="ranged",
        range_normal_ft=80,
        range_long_ft=320,
        ammunition="bolt",
        properties=("ammunition", "loading", "two-handed"),
        damage_type="piercing",
    ),
    "heavy_crossbow": WeaponDefinition(
        "heavy_crossbow",
        "heavy crossbow",
        "1d10",
        "dexterity",
        weapon_type="ranged",
        range_normal_ft=100,
        range_long_ft=400,
        ammunition="bolt",
        properties=("ammunition", "heavy", "loading", "two-handed"),
        damage_type="piercing",
    ),
}


def proficiency_bonus(level: int) -> int:
    return 2 + max(0, (level - 1) // 4)


def _ability_mod(score: int) -> int:
    return (score - 10) // 2


def _class_armor_proficiencies(character_class: str) -> frozenset[str]:
    spec = CLASS_SPECS.get(character_class)
    if spec is None:
        return frozenset()
    return frozenset(entry.casefold() for entry in spec.armor)


def armor_proficiency(character: CharacterState, armor: ArmorDefinition) -> bool:
    prof = _class_armor_proficiencies(character.character_class)
    if armor.category == "shield":
        return "shields" in prof
    return armor.category in prof


def shield_proficiency(character: CharacterState) -> bool:
    return "shields" in _class_armor_proficiencies(character.character_class)


def strength_requirement_met(character: CharacterState, armor: ArmorDefinition) -> bool:
    if armor.strength_requirement <= 0:
        return True
    return character.abilities.get("strength", 10) >= armor.strength_requirement


def gear_definition_key(label: str) -> str | None:
    key = label.casefold().strip()
    mapped = INVENTORY_GEAR.get(key)
    if mapped and mapped[0]:
        return mapped[0]
    if key in WEAPONS:
        return key
    return None


def item_kind(label: str) -> str:
    def_key = gear_definition_key(label)
    if def_key in WEAPONS:
        return "weapon"
    if def_key == SHIELD_KEY:
        return "shield"
    if def_key in ARMORS and def_key != SHIELD_KEY:
        return "armor"
    return "gear"


def armor_for_label(label: str) -> ArmorDefinition | None:
    key = gear_definition_key(label)
    if key and key in ARMORS and key != SHIELD_KEY:
        return ARMORS[key]
    return None


def shield_for_label(label: str) -> ArmorDefinition | None:
    if gear_definition_key(label) == SHIELD_KEY:
        return ARMORS[SHIELD_KEY]
    return None


def _equipped_slot(entry: dict) -> str | None:
    slot = entry.get("equipped_slot")
    if slot in {"weapon", "armor", "shield"}:
        return slot
    if entry.get("equipped"):
        return "weapon"
    return None


def _set_slot(instances: list[dict], label_key: str, slot: str | None, *, attack_bonus: int = 0) -> None:
    for entry in instances:
        name_key = entry.get("name", "").casefold().strip()
        if name_key == label_key:
            entry["equipped_slot"] = slot
            if slot == "weapon":
                entry["equipped"] = True
                entry["attack_bonus"] = attack_bonus
            else:
                entry["equipped"] = False
                if slot != "weapon":
                    entry["attack_bonus"] = 0
        elif slot and _equipped_slot(entry) == slot:
            entry["equipped_slot"] = None
            entry["equipped"] = False
            entry["attack_bonus"] = 0


def equipped_armor_instance(character: CharacterState) -> dict | None:
    for entry in character.item_instances:
        if _equipped_slot(entry) == "armor":
            return entry
    return None


def equipped_shield_instance(character: CharacterState) -> dict | None:
    for entry in character.item_instances:
        if _equipped_slot(entry) == "shield":
            return entry
    return None


def compute_armor_class(character: CharacterState) -> int:
    """Single authority for player AC (SRD 5.1)."""
    from .concentration import mage_armor_applies, mage_armor_base_ac, shield_of_faith_ac_bonus

    dex_mod = _ability_mod(character.abilities.get("dexterity", 10))
    body_ac = 10 + dex_mod

    armor_entry = equipped_armor_instance(character)
    if mage_armor_applies(character):
        body_ac = mage_armor_base_ac(character)
    elif armor_entry:
        armor = armor_for_label(armor_entry.get("name", ""))
        if (
            armor
            and armor_proficiency(character, armor)
            and strength_requirement_met(character, armor)
        ):
            if armor.category == "heavy":
                body_ac = armor.base_ac
            elif armor.category == "medium":
                cap = armor.max_dex_bonus if armor.max_dex_bonus is not None else 2
                body_ac = armor.base_ac + min(dex_mod, cap)
            else:
                body_ac = armor.base_ac + dex_mod

    shield_bonus = 0
    if equipped_shield_instance(character) and shield_proficiency(character):
        shield_bonus = SHIELD_AC_BONUS

    from .class_features import defense_style_ac_bonus

    return body_ac + shield_bonus + defense_style_ac_bonus(character) + shield_of_faith_ac_bonus(character)


def refresh_armor_class(character: CharacterState) -> int:
    character.armor_class = compute_armor_class(character)
    return character.armor_class


def weapon_key_from_inventory(inventory: list[str]) -> str:
    for item in inventory:
        key = item.casefold().strip()
        mapped = INVENTORY_GEAR.get(key)
        if mapped and mapped[0] in WEAPONS:
            return mapped[0]
        if key in WEAPONS:
            return key
    return "unarmed"


def item_attack_bonus(character: CharacterState) -> int:
    for entry in character.item_instances:
        if _equipped_slot(entry) == "weapon":
            return int(entry.get("attack_bonus", 0))
    return 0


def equipped_weapon(character: CharacterState) -> WeaponDefinition:
    for entry in character.item_instances:
        if _equipped_slot(entry) == "weapon" and entry.get("definition_id") in WEAPONS:
            return WEAPONS[entry["definition_id"]]
    return WEAPONS[weapon_key_from_inventory(character.inventory)]


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
    key = gear_definition_key(label)
    if key and key in WEAPONS:
        return WEAPONS[key]
    return None


def resolve_inventory_label(inventory: list[str], query: str) -> str | None:
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


def _rebuild_instances_preserve_slots(character: CharacterState) -> list[dict]:
    preserve_slots: dict[str, str] = {}
    preserve_attack: dict[str, int] = {}
    for entry in character.item_instances:
        name = entry.get("name", "").casefold().strip()
        slot = _equipped_slot(entry)
        if name and slot:
            preserve_slots[name] = slot
            preserve_attack[name] = int(entry.get("attack_bonus", 0))
    return default_item_instances(
        character.inventory,
        character,
        preserve_slots=preserve_slots or None,
        preserve_attack=preserve_attack or None,
    )


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
    instances = _rebuild_instances_preserve_slots(character)
    _set_slot(instances, key, "weapon", attack_bonus=attack_bonus)
    character.item_instances = instances
    refresh_armor_class(character)
    bonus_text = f" (+{attack_bonus} attack)" if attack_bonus else ""
    return True, f"You ready your {weapon.name}{bonus_text}."


def set_equipped_armor(character: CharacterState, query: str) -> tuple[bool, str]:
    label = resolve_inventory_label(character.inventory, query)
    if label is None:
        return False, f"You do not carry {query.strip() or 'that item'}."
    armor = armor_for_label(label)
    if armor is None:
        return False, f"{label} is not armor you can wear."
    if not armor_proficiency(character, armor):
        return False, f"You are not proficient with {armor.name}."
    if not strength_requirement_met(character, armor):
        return False, f"You need Strength {armor.strength_requirement} to wear {armor.name}."
    instances = _rebuild_instances_preserve_slots(character)
    _set_slot(instances, label.casefold().strip(), "armor")
    character.item_instances = instances
    ac = refresh_armor_class(character)
    return True, f"You don {armor.name}. Armor class is now {ac}."


def set_equipped_shield(character: CharacterState, query: str) -> tuple[bool, str]:
    label = resolve_inventory_label(character.inventory, query)
    if label is None:
        return False, f"You do not carry {query.strip() or 'that item'}."
    if shield_for_label(label) is None:
        return False, f"{label} is not a shield."
    if not shield_proficiency(character):
        return False, "You are not proficient with shields."
    instances = _rebuild_instances_preserve_slots(character)
    _set_slot(instances, label.casefold().strip(), "shield")
    character.item_instances = instances
    ac = refresh_armor_class(character)
    return True, f"You raise your shield. Armor class is now {ac}."


def unequip_armor(character: CharacterState) -> tuple[bool, str]:
    if equipped_armor_instance(character) is None:
        return False, "You are not wearing armor."
    instances = list(character.item_instances)
    for entry in instances:
        if _equipped_slot(entry) == "armor":
            entry["equipped_slot"] = None
    character.item_instances = instances
    ac = refresh_armor_class(character)
    return True, f"You remove your armor. Armor class is now {ac}."


def unequip_shield(character: CharacterState) -> tuple[bool, str]:
    if equipped_shield_instance(character) is None:
        return False, "You are not wielding a shield."
    instances = list(character.item_instances)
    for entry in instances:
        if _equipped_slot(entry) == "shield":
            entry["equipped_slot"] = None
    character.item_instances = instances
    ac = refresh_armor_class(character)
    return True, f"You stow your shield. Armor class is now {ac}."


def unequip_item(character: CharacterState, query: str) -> tuple[bool, str]:
    needle = query.casefold().strip()
    if not needle or needle in {"armor", "armour", "zbroj", "zbroje"}:
        return unequip_armor(character)
    if needle in {"shield", "štít", "stit"}:
        return unequip_shield(character)
    label = resolve_inventory_label(character.inventory, query)
    if label is None:
        return False, f"You do not carry {query.strip() or 'that item'}."
    if shield_for_label(label):
        entry = next((e for e in character.item_instances if e.get("name", "").casefold().strip() == label.casefold().strip()), None)
        if entry is None or _equipped_slot(entry) != "shield":
            return False, f"You are not wielding {label}."
        return unequip_shield(character)
    if armor_for_label(label):
        if equipped_armor_instance(character) is None:
            return False, f"You are not wearing {label}."
        return unequip_armor(character)
    return False, f"You cannot unequip {label} that way."


def equip_item_from_query(character: CharacterState, query: str) -> tuple[bool, str]:
    label = resolve_inventory_label(character.inventory, query)
    if label is None:
        return False, f"You do not carry {query.strip() or 'that item'}."
    kind = item_kind(label)
    if kind == "armor":
        return set_equipped_armor(character, label)
    if kind == "shield":
        return set_equipped_shield(character, label)
    if kind == "weapon":
        return set_equipped_weapon(character, label)
    return False, f"{label} cannot be equipped."


def apply_starting_equipment(character: CharacterState) -> None:
    body = STARTING_BODY_ARMOR.get(character.character_class)
    if body:
        labels = {item.casefold().strip() for item in character.inventory}
        if body.casefold() not in labels:
            character.inventory.append(body)
    character.item_instances = default_item_instances(character.inventory, character)
    for label in character.inventory:
        piece = armor_for_label(label)
        if piece and armor_proficiency(character, piece):
            instances = character.item_instances
            _set_slot(instances, label.casefold().strip(), "armor")
            character.item_instances = instances
            break
    for label in character.inventory:
        if shield_for_label(label) and shield_proficiency(character):
            instances = character.item_instances
            _set_slot(instances, label.casefold().strip(), "shield")
            character.item_instances = instances
            break
    refresh_armor_class(character)


def load_character_state(data: dict) -> CharacterState:
    """Build character from persisted dict, migrate legacy gear, refresh AC."""
    from .class_features import ensure_class_identity_defaults

    character = CharacterState(**data)
    ensure_class_identity_defaults(character)
    from .race_features import hydrate_race_on_load

    hydrate_race_on_load(character)
    migrate_item_instances(character)
    return character


def migrate_item_instances(character: CharacterState) -> None:
    """Legacy saves: rebuild instances and preserve weapon slots; then refresh AC."""
    if not character.item_instances and character.inventory:
        apply_starting_equipment(character)
        return
    changed = False
    for entry in character.item_instances:
        if entry.get("equipped") and not entry.get("equipped_slot"):
            entry["equipped_slot"] = "weapon"
            changed = True
        if "equipped_slot" not in entry:
            entry["equipped_slot"] = "weapon" if entry.get("equipped") else None
            changed = True
    if changed:
        sync_item_instances(character)
    refresh_armor_class(character)


def default_item_instances(
    inventory: list[str],
    character: CharacterState | None = None,
    *,
    preserve_slots: dict[str, str] | None = None,
    preserve_attack: dict[str, int] | None = None,
    preserve_equipped: dict[str, int] | None = None,
) -> list[dict]:
    instances: list[dict] = []
    equipped_weapon_set = False
    for index, label in enumerate(inventory):
        key = label.casefold().strip()
        def_key = gear_definition_key(label)
        kind = item_kind(label)
        gear = INVENTORY_GEAR.get(key)
        attack_bonus = gear[1] if gear else 0
        slot: str | None = None
        if preserve_slots and key in preserve_slots:
            slot = preserve_slots[key]
            if slot == "weapon":
                attack_bonus = (preserve_attack or {}).get(key, attack_bonus)
        elif preserve_equipped is not None and key in preserve_equipped and kind == "weapon":
            slot = "weapon"
            attack_bonus = preserve_equipped[key]
        elif preserve_slots is None and preserve_equipped is None and kind == "weapon" and not equipped_weapon_set:
            if character is None or weapon_proficiency(character, def_key or "unarmed"):
                slot = "weapon"
                equipped_weapon_set = True

        instances.append({
            "instance_id": f"gear-{index}",
            "definition_id": def_key or key.replace(" ", "_"),
            "name": label,
            "item_kind": kind,
            "equipped_slot": slot,
            "equipped": slot == "weapon",
            "attack_bonus": attack_bonus if slot == "weapon" else 0,
        })
    return instances


def sync_item_instances(character: CharacterState) -> None:
    preserve_slots: dict[str, str] = {}
    preserve_attack: dict[str, int] = {}
    for entry in character.item_instances:
        name = entry.get("name", "").casefold().strip()
        slot = _equipped_slot(entry)
        if name and slot:
            preserve_slots[name] = slot
            if slot == "weapon":
                preserve_attack[name] = int(entry.get("attack_bonus", 0))
    character.item_instances = default_item_instances(
        character.inventory,
        character,
        preserve_slots=preserve_slots or None,
        preserve_attack=preserve_attack or None,
    )
    refresh_armor_class(character)
