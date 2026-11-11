"""SRD 5.1 MVP racial traits — engine authority for Human, Elf, Dwarf, Halfling."""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING, Callable

from .catalog import ABILITY_ORDER
from .ruleset_v1 import MVP_RACES

if TYPE_CHECKING:
    from .models import CharacterState
    from .saving_throws import SavingThrowRequest

TRANCE = "trance"
DARKVISION = "darkvision"
KEEN_SENSES = "keen_senses"
FEY_ANCESTRY = "fey_ancestry"
DWARVEN_RESILIENCE = "dwarven_resilience"
STONECUNNING = "stonecunning"
LUCKY = "lucky"
BRAVE = "brave"
HUMAN_VERSATILE = "versatile"

DEFERRED_TRAITS: frozenset[str] = frozenset({TRANCE, "halfling_nimbleness", "dwarven_combat_training"})


@dataclass(frozen=True)
class ModeledRaceTrait:
    trait_id: str
    name: str
    summary_en: str
    modeled: bool
    deferred: bool = False


def _trait(trait_id: str, name: str, summary_en: str, *, modeled: bool, deferred: bool = False) -> ModeledRaceTrait:
    return ModeledRaceTrait(trait_id, name, summary_en, modeled, deferred)


MVP_RACE_TRAITS: dict[str, tuple[ModeledRaceTrait, ...]] = {
    "human": (
        _trait(HUMAN_VERSATILE, "Versatile", "+1 to every ability score at creation.", modeled=True),
    ),
    "elf": (
        _trait(DARKVISION, "Darkvision", "60 ft. (ambient light data for future exploration).", modeled=True),
        _trait(KEEN_SENSES, "Keen Senses", "Perception skill proficiency.", modeled=True),
        _trait(FEY_ANCESTRY, "Fey Ancestry", "Advantage on saves vs. charm (tagged saves).", modeled=True),
        _trait(TRANCE, "Trance", "Four-hour meditation replaces sleep.", modeled=False, deferred=True),
    ),
    "dwarf": (
        _trait(DARKVISION, "Darkvision", "60 ft. (ambient light data for future exploration).", modeled=True),
        _trait(
            DWARVEN_RESILIENCE,
            "Dwarven Resilience",
            "Advantage on poison saves; resistance to poison damage.",
            modeled=True,
        ),
        _trait(
            STONECUNNING,
            "Stonecunning",
            "Double proficiency on History checks about stonework (tagged checks).",
            modeled=True,
        ),
        _trait("dwarven_combat_training", "Dwarven Combat Training", "Weapon proficiencies.", modeled=False, deferred=True),
    ),
    "halfling": (
        _trait(LUCKY, "Lucky", "Reroll natural 1 on attacks, ability checks, and saves.", modeled=True),
        _trait(BRAVE, "Brave", "Advantage on saves vs. frightened (tagged saves).", modeled=True),
        _trait("halfling_nimbleness", "Halfling Nimbleness", "Move through larger creatures' spaces.", modeled=False, deferred=True),
    ),
}


def mvp_race_trait_catalog(race: str) -> list[ModeledRaceTrait]:
    if race not in MVP_RACES:
        return []
    return list(MVP_RACE_TRAITS.get(race, ()))


def darkvision_range_ft(character: CharacterState) -> int | None:
    """Data contract for light/exploration systems — not a blanket skill bonus."""
    if character.race in {"elf", "dwarf"}:
        return 60
    return None


def ensure_race_proficiencies(character: CharacterState) -> None:
    """Idempotent backfill for legacy saves (Elf Perception)."""
    if character.race != "elf":
        return
    skills = list(character.skill_proficiencies)
    if "Perception" not in skills:
        character.skill_proficiencies = skills + ["Perception"]


def halfling_lucky_reroll(
    character: CharacterState,
    natural: int,
    pull_natural: Callable[[], int],
) -> tuple[int, str]:
    if character.race != "halfling" or natural != 1:
        return natural, ""
    reroll = pull_natural()
    return reroll, f" Halfling Lucky: 1 → {reroll}."


def saving_throw_racial_advantage(character: CharacterState, request: SavingThrowRequest) -> bool:
    tags = {tag.casefold() for tag in getattr(request, "tags", ()) or ()}
    source_id = request.source_id.casefold()
    if character.race == "dwarf" and (tags & {"poison", "poisoned"} or "poison" in source_id):
        return True
    if character.race == "elf" and (tags & {"charm", "charmed"} or "charm" in source_id):
        return True
    if character.race == "halfling" and (tags & {"fear", "frightened"} or "frighten" in source_id):
        return True
    return False


def apply_poison_damage_resistance(character: CharacterState, damage: int, *, damage_type: str) -> tuple[int, str]:
    if character.race != "dwarf" or damage <= 0:
        return damage, ""
    if damage_type.casefold() not in {"poison", "poisoned"}:
        return damage, ""
    reduced = max(0, damage // 2)
    note = f" Dwarven Resilience: poison damage {damage} → {reduced}."
    return reduced, note


def stonecunning_bonus(character: CharacterState, skill: str, *, stonework: bool) -> int:
    if character.race != "dwarf" or not stonework:
        return 0
    if skill != "History":
        return 0
    from .class_features import skill_proficiency_multiplier

    if skill_proficiency_multiplier(character, skill) <= 0:
        return 0
    return skill_proficiency_multiplier(character, skill)


def race_feature_facts(character: CharacterState) -> dict:
    """Journal/API-safe snapshot of active racial mechanics."""
    traits = mvp_race_trait_catalog(character.race)
    return {
        "race": character.race,
        "darkvision_ft": darkvision_range_ft(character),
        "traits": [
            {
                "id": t.trait_id,
                "name": t.name,
                "modeled": t.modeled and not t.deferred,
                "deferred": t.deferred,
            }
            for t in traits
        ],
    }


def enrich_character_dict(character: CharacterState) -> dict:
    from dataclasses import asdict

    payload = asdict(character)
    payload["race_features"] = race_feature_facts(character)
    return payload


def hydrate_race_on_load(character: CharacterState) -> None:
    ensure_race_proficiencies(character)


def public_race_reference_traits(race: str) -> list[dict]:
    from .reference import RACE_SPECS

    spec = RACE_SPECS.get(race)
    if spec is None:
        return []
    modeled_ids = {t.trait_id for t in mvp_race_trait_catalog(race) if t.modeled and not t.deferred}
    deferred_ids = DEFERRED_TRAITS | {t.trait_id for t in mvp_race_trait_catalog(race) if t.deferred}
    name_map = {t.name: t for t in mvp_race_trait_catalog(race)}
    out: list[dict] = []
    for trait in spec.traits:
        trait_id = trait.name.lower().replace(" ", "_")
        for modeled in mvp_race_trait_catalog(race):
            if modeled.name == trait.name:
                trait_id = modeled.trait_id
                break
        out.append(
            {
                "name": trait.name,
                "text": trait.text,
                "trait_id": trait_id,
                "modeled": trait_id in modeled_ids,
                "deferred": trait_id in deferred_ids,
            }
        )
    if race == "human" and not out:
        out.append(
            {
                "name": "Versatile",
                "text": "One extra language of your choice.",
                "trait_id": HUMAN_VERSATILE,
                "modeled": True,
                "deferred": False,
            }
        )
    _ = name_map
    return out
