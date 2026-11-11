"""SRD 5.1 level-1 character creation — Ruleset v1 MVP (4 races / 4 classes)."""

from __future__ import annotations

from dataclasses import dataclass, field

from .catalog import ABILITY_ORDER, STANDARD_ARRAY, apply_racial_ability_increases, standard_abilities
from .reference import CLASS_SPECS, RACE_SPECS
from .ruleset_v1 import class_mvp_playable, race_mvp_playable
from .spells import CLASS_SPELL_LISTS, PREPARED_CASTERS, spell_level

STANDARD_ARRAY_SET = frozenset(STANDARD_ARRAY)

SKILL_ABILITIES: dict[str, str] = {
    "Acrobatics": "dexterity",
    "Animal Handling": "wisdom",
    "Arcana": "intelligence",
    "Athletics": "strength",
    "Deception": "charisma",
    "History": "intelligence",
    "Insight": "wisdom",
    "Intimidation": "charisma",
    "Investigation": "intelligence",
    "Medicine": "wisdom",
    "Nature": "intelligence",
    "Perception": "wisdom",
    "Performance": "charisma",
    "Persuasion": "charisma",
    "Religion": "intelligence",
    "Sleight of Hand": "dexterity",
    "Stealth": "dexterity",
    "Survival": "wisdom",
}

MVP_BACKGROUNDS: dict[str, dict] = {
    "acolyte": {
        "name": "Acolyte",
        "skill_proficiencies": ["Insight", "Religion"],
        "languages": 2,
        "equipment": ["holy symbol", "prayer book", "vestments", "common clothes", "pouch with 15 gp"],
        "feature": {"name": "Shelter of the Faithful", "text": "Temples of your faith may shelter you and allies."},
    },
    "criminal": {
        "name": "Criminal",
        "skill_proficiencies": ["Deception", "Stealth"],
        "languages": 0,
        "equipment": ["crowbar", "dark common clothes", "hood", "pouch with 15 gp"],
        "feature": {"name": "Criminal Contact", "text": "A reliable underworld contact — narrative only in v1."},
    },
    "folk_hero": {
        "name": "Folk Hero",
        "skill_proficiencies": ["Animal Handling", "Survival"],
        "languages": 0,
        "equipment": ["artisan's tools", "shovel", "iron pot", "common clothes", "pouch with 10 gp"],
        "feature": {"name": "Rustic Hospitality", "text": "Common folk aid you — narrative only in v1."},
    },
    "sage": {
        "name": "Sage",
        "skill_proficiencies": ["Arcana", "History"],
        "languages": 2,
        "equipment": ["ink", "quill", "small knife", "letter from a colleague", "common clothes", "pouch with 10 gp"],
        "feature": {"name": "Researcher", "text": "Libraries may grant lore — narrative only in v1."},
    },
    "soldier": {
        "name": "Soldier",
        "skill_proficiencies": ["Athletics", "Intimidation"],
        "languages": 0,
        "equipment": ["insignia of rank", "trophy", "deck of cards", "common clothes", "pouch with 10 gp"],
        "feature": {"name": "Military Rank", "text": "Soldiers recognize your bearing — narrative only in v1."},
    },
    "hermit": {
        "name": "Hermit",
        "skill_proficiencies": ["Medicine", "Religion"],
        "languages": 1,
        "equipment": ["scroll case", "winter blanket", "herbalism kit", "common clothes", "pouch with 5 gp"],
        "feature": {"name": "Discovery", "text": "A unique revelation shapes you — narrative only in v1."},
    },
}

DEFAULT_BACKGROUND_BY_CLASS = {
    "fighter": "folk_hero",
    "rogue": "criminal",
    "cleric": "acolyte",
    "wizard": "sage",
}

CLASS_SKILL_PICKS: dict[str, tuple[tuple[str, ...], int]] = {
    "fighter": (
        ("Acrobatics", "Animal Handling", "Athletics", "History", "Insight", "Intimidation", "Perception", "Survival"),
        2,
    ),
    "rogue": (
        (
            "Acrobatics", "Athletics", "Deception", "Insight", "Intimidation", "Investigation", "Perception",
            "Performance", "Persuasion", "Sleight of Hand", "Stealth",
        ),
        4,
    ),
    "cleric": (("History", "Insight", "Medicine", "Persuasion", "Religion"), 2),
    "wizard": (("Arcana", "History", "Insight", "Investigation", "Medicine", "Religion"), 2),
}

EQUIPMENT_PACKAGES: dict[str, dict[str, list[str]]] = {
    "fighter": {
        "guardian": ["shortsword", "shield", "traveler's clothes"],
        "duelist": ["longsword", "shortsword", "traveler's clothes"],
    },
    "rogue": {
        "scout": ["shortsword", "dagger", "thieves' tools", "traveler's clothes"],
    },
    "cleric": {
        "warpriest": ["mace", "shield", "traveler's clothes"],
    },
    "wizard": {
        "scholar": ["dagger", "spellbook", "traveler's clothes"],
    },
}

DEFAULT_EQUIPMENT_PACKAGE: dict[str, str] = {
    "fighter": "guardian",
    "rogue": "scout",
    "cleric": "warpriest",
    "wizard": "scholar",
}

SPELL_PICK_LIMITS: dict[str, dict[str, int]] = {
    "wizard": {"cantrips": 3, "level_one_known": 3},
    "cleric": {"cantrips": 3, "level_one_prepared": 4},
}

EXPLORE_SKILL_CUES: dict[str, tuple[str, ...]] = {
    "Perception": ("look around", "listen", "spot", "notice", "rozhléd", "poslouch"),
    "Investigation": ("search", "investigate", "inspect", "examine", "prohledej", "prozkoumej"),
    "Stealth": ("sneak", "hide", "pliz", "schovej"),
}


@dataclass
class CreationChoices:
    background: str
    class_skills: list[str] = field(default_factory=list)
    equipment_package: str = ""
    cantrips: list[str] = field(default_factory=list)
    level_one_spells: list[str] = field(default_factory=list)
    alignment: str = ""
    ideal: str = ""
    bond: str = ""
    flaw: str = ""
    backstory: str = ""


def validate_standard_array(scores: dict[str, int]) -> None:
    if set(scores.keys()) != set(ABILITY_ORDER):
        raise ValueError("Ability scores must include each of: " + ", ".join(ABILITY_ORDER))
    values = sorted(scores.values())
    if sorted(values) != sorted(STANDARD_ARRAY):
        raise ValueError(f"Ability scores must be a permutation of the standard array {list(STANDARD_ARRAY)}")
    if any(not 3 <= score <= 20 for score in values):
        raise ValueError("Ability scores must be in range 3–20 before racial bonuses")


def validate_background(key: str) -> dict:
    background = MVP_BACKGROUNDS.get(key)
    if background is None:
        raise ValueError(f"Unknown or unavailable background: {key}")
    return background


def validate_class_skills(character_class: str, picks: list[str], *, background_skills: list[str]) -> list[str]:
    if character_class not in CLASS_SKILL_PICKS:
        return list(picks)
    options, count = CLASS_SKILL_PICKS[character_class]
    option_set = frozenset(options)
    if len(picks) != count:
        raise ValueError(f"{character_class} must choose exactly {count} class skills")
    if any(skill not in option_set for skill in picks):
        raise ValueError(f"Invalid class skill for {character_class}")
    overlap = set(picks) & set(background_skills)
    if overlap:
        raise ValueError("Class skill picks must not duplicate background skills: " + ", ".join(sorted(overlap)))
    return picks


def validate_equipment_package(character_class: str, package: str) -> list[str]:
    packages = EQUIPMENT_PACKAGES.get(character_class, {})
    if package not in packages:
        raise ValueError(f"Unknown equipment package '{package}' for {character_class}")
    return list(packages[package])


def _spell_options(character_class: str, level: int) -> tuple[str, ...]:
    return CLASS_SPELL_LISTS.get(character_class, {}).get(level, ())


def validate_spell_picks(
    character_class: str,
    cantrips: list[str],
    level_one: list[str],
) -> tuple[list[str], list[str]]:
    if character_class not in SPELL_PICK_LIMITS:
        if cantrips or level_one:
            raise ValueError(f"{character_class} does not learn spells at level 1 in this ruleset slice")
        return [], []

    limits = SPELL_PICK_LIMITS[character_class]
    cantrip_pool = frozenset(_spell_options(character_class, 0))
    level_one_pool = frozenset(_spell_options(character_class, 1))

    if len(cantrips) != limits["cantrips"]:
        raise ValueError(f"Choose exactly {limits['cantrips']} cantrips")
    if any(spell not in cantrip_pool for spell in cantrips):
        raise ValueError("Invalid cantrip choice")

    if character_class == "wizard":
        need = limits["level_one_known"]
        if len(level_one) != need:
            raise ValueError(f"Wizard must choose exactly {need} level-1 spells to know")
    else:
        need = limits.get("level_one_prepared", 0)
        if len(level_one) != need:
            raise ValueError(f"Choose exactly {need} level-1 spells to prepare")

    if any(spell not in level_one_pool for spell in level_one):
        raise ValueError("Invalid level-1 spell choice")
    duplicates = set(cantrips) & set(level_one)
    if duplicates:
        raise ValueError("Cantrips and level-1 picks must be distinct")

    return list(cantrips), list(level_one)


def default_class_skills(character_class: str, background_key: str) -> list[str]:
    if character_class not in CLASS_SKILL_PICKS:
        return []
    background = MVP_BACKGROUNDS[background_key]
    bg_skills = set(background["skill_proficiencies"])
    options, count = CLASS_SKILL_PICKS[character_class]
    return [skill for skill in options if skill not in bg_skills][:count]


def default_spell_picks(character_class: str) -> tuple[list[str], list[str]]:
    if character_class not in SPELL_PICK_LIMITS:
        return [], []
    limits = SPELL_PICK_LIMITS[character_class]
    cantrips = list(_spell_options(character_class, 0)[: limits["cantrips"]])
    if character_class == "wizard":
        level_one = list(_spell_options(character_class, 1)[: limits["level_one_known"]])
    else:
        level_one = list(_spell_options(character_class, 1)[: limits["level_one_prepared"]])
    return cantrips, level_one


def default_creation_choices(character_class: str) -> CreationChoices:
    background = DEFAULT_BACKGROUND_BY_CLASS.get(character_class, "folk_hero")
    return CreationChoices(
        background=background,
        class_skills=default_class_skills(character_class, background),
        equipment_package=DEFAULT_EQUIPMENT_PACKAGE.get(character_class, ""),
        cantrips=default_spell_picks(character_class)[0],
        level_one_spells=default_spell_picks(character_class)[1],
    )


def assemble_skill_proficiencies(
    race: str,
    character_class: str,
    background_key: str,
    class_skills: list[str],
) -> list[str]:
    background = MVP_BACKGROUNDS[background_key]
    skills: list[str] = list(background["skill_proficiencies"])
    skills.extend(class_skills)
    if race == "elf" and "Perception" not in skills:
        skills.append("Perception")
    return sorted(dict.fromkeys(skills))


def saving_throw_proficiencies(character_class: str) -> list[str]:
    spec = CLASS_SPECS.get(character_class)
    if spec is None:
        return []
    return list(spec.saving_throws)


def racial_speed(race: str) -> int:
    spec = RACE_SPECS.get(race)
    return spec.speed if spec else 30


def parse_starting_gold(equipment: list[str]) -> int:
    gold = 0
    kept = []
    for item in equipment:
        lowered = item.casefold()
        if "gp" in lowered:
            parts = lowered.replace("pouch with", "").replace("gp", "").strip().split()
            for part in parts:
                if part.isdigit():
                    gold += int(part)
                    break
        else:
            kept.append(item)
    return gold


def merge_inventory(class_items: list[str], background_equipment: list[str]) -> list[str]:
    merged: list[str] = []
    for item in class_items + background_equipment:
        if item not in merged:
            merged.append(item)
    return merged


def public_creation_reference() -> dict:
    from .ruleset_v1 import public_summary

    return {
        "ruleset": public_summary(),
        "standard_array": list(STANDARD_ARRAY),
        "ability_order": list(ABILITY_ORDER),
        "skill_abilities": SKILL_ABILITIES,
        "backgrounds": [
            {
                "key": key,
                "mvp_playable": True,
                **{k: v for k, v in spec.items() if k != "feature"},
                "feature": dict(spec["feature"]),
            }
            for key, spec in MVP_BACKGROUNDS.items()
        ],
        "class_skill_picks": {
            klass: {"options": list(options), "count": count}
            for klass, (options, count) in CLASS_SKILL_PICKS.items()
            if class_mvp_playable(klass)
        },
        "equipment_packages": EQUIPMENT_PACKAGES,
        "spell_pick_limits": SPELL_PICK_LIMITS,
        "spell_options": {
            klass: {
                "cantrips": list(_spell_options(klass, 0)),
                "level_one": list(_spell_options(klass, 1)),
            }
            for klass in SPELL_PICK_LIMITS
        },
        "personality_fields": ("alignment", "ideal", "bond", "flaw", "backstory"),
    }


def normalize_ability_scores(abilities: dict[str, int] | None, character_class: str) -> dict[str, int]:
    """Standard array for player builds; optimized arrays remain valid for presets/tests."""
    if abilities is None:
        return dict(standard_abilities(character_class))
    if set(abilities.keys()) != set(ABILITY_ORDER):
        raise ValueError("Ability scores must include each of: " + ", ".join(ABILITY_ORDER))
    if any(not 3 <= score <= 20 for score in abilities.values()):
        raise ValueError("Ability scores must be in range 3–20 before racial bonuses")
    try:
        validate_standard_array(abilities)
    except ValueError:
        pass
    return dict(abilities)


def resolve_creation_options(
    race: str,
    character_class: str,
    abilities: dict[str, int] | None,
    *,
    background: str | None = None,
    class_skills: list[str] | None = None,
    equipment_package: str | None = None,
    cantrips: list[str] | None = None,
    level_one_spells: list[str] | None = None,
    personality: CreationChoices | None = None,
) -> tuple[dict[str, int], CreationChoices, list[str], int]:
    """Validate creation inputs; return base scores (pre-racial), choices, inventory, gold."""
    base_scores = normalize_ability_scores(abilities, character_class)

    defaults = default_creation_choices(character_class)
    bg_key = background or defaults.background
    bg = validate_background(bg_key)

    picks = class_skills if class_skills is not None else defaults.class_skills
    if character_class in CLASS_SKILL_PICKS:
        validate_class_skills(character_class, picks, background_skills=bg["skill_proficiencies"])

    if character_class in EQUIPMENT_PACKAGES:
        package = equipment_package or defaults.equipment_package
        class_inventory = validate_equipment_package(character_class, package)
    else:
        from .equipment import STARTING_INVENTORY_BY_CLASS

        package = equipment_package or ""
        class_inventory = list(STARTING_INVENTORY_BY_CLASS.get(character_class, ["traveler's clothes"]))

    cantrip_in = cantrips if cantrips is not None else defaults.cantrips
    spell_in = level_one_spells if level_one_spells is not None else defaults.level_one_spells
    validated_cantrips, validated_spells = validate_spell_picks(character_class, cantrip_in, spell_in)

    choices = CreationChoices(
        background=bg_key,
        class_skills=list(picks),
        equipment_package=package,
        cantrips=validated_cantrips,
        level_one_spells=validated_spells,
        alignment=(personality.alignment if personality else ""),
        ideal=(personality.ideal if personality else ""),
        bond=(personality.bond if personality else ""),
        flaw=(personality.flaw if personality else ""),
        backstory=(personality.backstory if personality else ""),
    )

    inventory = merge_inventory(class_inventory, bg["equipment"])
    gold = parse_starting_gold(bg["equipment"])
    return base_scores, choices, inventory, gold
