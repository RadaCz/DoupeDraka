"""Encounter catalog and difficulty scaling.

The engine owns every number here. Difficulty is applied by mutating a template's
stats, never by asking the model, so the same seed and difficulty always produce
the same fight.

Damage is kept as structured parts (`damage_dice`, `damage_bonus`) and only
rendered into the legacy "1d6+2" string for `MonsterState`, which keeps stored
`character.combatant` payloads backward compatible.
"""
from dataclasses import dataclass, replace

from .models import DIFFICULTIES, MonsterState


@dataclass(frozen=True)
class MonsterTemplate:
    key: str
    name: str
    tier: int
    hp: int
    armor_class: int
    attack_bonus: int
    damage_dice: str
    damage_bonus: int
    reward_xp: int


@dataclass(frozen=True)
class DifficultyProfile:
    """Multipliers and flat adjustments applied to a monster template."""

    key: str
    label: str
    hp_multiplier: float
    armor_class_delta: int
    attack_delta: int
    damage_delta: int
    xp_multiplier: float


DIFFICULTY_PROFILES = {
    # Gentler than 5e baseline: enemies hit less often for less damage.
    "easy": DifficultyProfile("easy", "Easy", 0.75, -1, -2, -2, 1.0),
    "normal": DifficultyProfile("normal", "Normal", 1.0, 0, 0, 0, 1.0),
    # Deadlier: tougher hide, better attack, heavier hits, and more XP to match.
    "hard": DifficultyProfile("hard", "Hard", 1.35, 2, 2, 2, 1.35),
}

MONSTERS = {
    "goblin": MonsterTemplate("goblin", "Goblin scout", 1, 7, 13, 4, "1d6", 2, 50),
    "kobold": MonsterTemplate("kobold", "Kobold skirmisher", 1, 5, 12, 3, "1d4", 1, 35),
    "wolf": MonsterTemplate("wolf", "Starving wolf", 1, 11, 13, 4, "1d6", 2, 60),
    "skeleton": MonsterTemplate("skeleton", "Rattling skeleton", 1, 13, 13, 4, "1d6", 2, 50),
    "bandit": MonsterTemplate("bandit", "Road bandit", 2, 11, 12, 3, "1d6", 1, 70),
    "hobgoblin": MonsterTemplate("hobgoblin", "Hobgoblin soldier", 2, 11, 18, 3, "1d8", 1, 85),
    "ghoul": MonsterTemplate("ghoul", "Cellar ghoul", 2, 22, 12, 4, "1d8", 2, 110),
    "orc": MonsterTemplate("orc", "Orc marauder", 2, 15, 13, 5, "1d12", 3, 100),
    "bandit_captain": MonsterTemplate(
        "bandit_captain", "Bandit captain", 3, 28, 15, 5, "1d8", 3, 150,
    ),
    "ogre": MonsterTemplate("ogre", "Cellar ogre", 3, 44, 11, 6, "2d8", 4, 200),
    "bell_warden": MonsterTemplate(
        "bell_warden", "Bell Warden", 3, 38, 15, 6, "1d10", 4, 180,
    ),
}

DEX_SAVE_MODIFIERS = {
    "goblin": 2,
    "kobold": 2,
    "wolf": 2,
    "skeleton": 2,
    "bandit": 1,
    "hobgoblin": 1,
    "ghoul": 2,
    "orc": 1,
    "bandit_captain": 2,
    "ogre": -1,
    "bell_warden": 0,
}

WIS_SAVE_MODIFIERS = {
    "wolf": 1,
    "kobold": -1,
}

# The default fight when a player attacks without naming a target.
DEFAULT_MONSTER = "goblin"


def parse_damage(damage: str) -> tuple[str, int]:
    """Split a legacy "1d6+2" damage string into (dice, bonus)."""
    dice, separator, bonus = damage.partition("+")
    return dice, int(bonus) if separator and bonus else 0


def format_damage(dice: str, bonus: int) -> str:
    return f"{dice}+{bonus}" if bonus else dice


def tier_allowed_for_level(template: MonsterTemplate, level: int) -> bool:
    """Gate encounter pool picks by character level (tier 1 at L1+, tier 2 at L2+, etc.)."""
    if template.tier <= 1:
        return level >= 1
    if template.tier == 2:
        return level >= 2
    if template.tier == 3:
        return level >= 3
    return level >= 4


def filter_encounter_pool(pool: tuple[str, ...] | list[str], level: int) -> list[str]:
    keys = [key for key in pool if key in MONSTERS and tier_allowed_for_level(MONSTERS[key], level)]
    return keys or [key for key in pool if key in MONSTERS]


def resolve_template(target: str | None) -> MonsterTemplate:
    """Find a monster template by key or by a word in its name."""
    if not target:
        return MONSTERS[DEFAULT_MONSTER]
    text = target.lower()
    for template in MONSTERS.values():
        if template.key == text:
            return template
    for template in MONSTERS.values():
        if template.key in text or template.name.split()[0].lower() in text:
            return template
    return MONSTERS[DEFAULT_MONSTER]


def build_monster(difficulty: str = "normal", target: str | None = None) -> MonsterState:
    """Build a scaled monster for the given difficulty and named target."""
    profile = DIFFICULTY_PROFILES.get(difficulty, DIFFICULTY_PROFILES["normal"])
    template = resolve_template(target)
    scaled = scale_template(template, profile)
    return MonsterState(
        name=scaled.name,
        hp=scaled.hp,
        max_hp=scaled.hp,
        armor_class=scaled.armor_class,
        attack_bonus=scaled.attack_bonus,
        damage=format_damage(scaled.damage_dice, scaled.damage_bonus),
        reward_xp=scaled.reward_xp,
        saving_throws={
            "dexterity": DEX_SAVE_MODIFIERS.get(scaled.key, 0),
            "wisdom": WIS_SAVE_MODIFIERS.get(scaled.key, 0),
        },
    )


def scale_template(template: MonsterTemplate, profile: DifficultyProfile) -> MonsterTemplate:
    """Apply a difficulty profile, keeping every stat inside sane bounds."""
    return replace(
        template,
        hp=max(1, round(template.hp * profile.hp_multiplier)),
        armor_class=max(5, template.armor_class + profile.armor_class_delta),
        attack_bonus=template.attack_bonus + profile.attack_delta,
        damage_bonus=max(0, template.damage_bonus + profile.damage_delta),
        reward_xp=max(1, round(template.reward_xp * profile.xp_multiplier)),
    )