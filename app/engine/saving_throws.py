"""SRD 5.1 saving throws — single authority for player saves."""

from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import TYPE_CHECKING, Callable

from .catalog import ABILITY_ORDER
from .models import CharacterState, MonsterState, RollResult

if TYPE_CHECKING:
    from .service import GameEngine

VALID_ABILITIES = frozenset(ABILITY_ORDER)
MIN_DC = 1
MAX_DC = 30


@dataclass(frozen=True)
class SavingThrowRequest:
    ability: str
    dc: int
    source: str
    source_id: str
    advantage: bool = False
    disadvantage: bool = False
    tags: tuple[str, ...] = ()


@dataclass(frozen=True)
class SavingThrowResult:
    ability: str
    dc: int
    d20_roll: int
    second_d20: int | None
    ability_modifier: int
    proficiency_bonus: int
    proficient: bool
    total: int
    success: bool
    advantage: bool
    disadvantage: bool
    source: str
    source_id: str
    lucky_note: str
    natural_1: bool
    natural_20: bool
    actor_type: str = "player"
    actor_name: str = ""
    automatic_failure: bool = False

    def to_facts(self) -> dict:
        payload = asdict(self)
        payload["dice"] = "1d20"
        payload["succeeded"] = self.success
        return payload


def _proficiency_bonus(level: int) -> int:
    return 2 + max(0, (level - 1) // 4)


def _ability_modifier(character: CharacterState, ability: str) -> int:
    return (character.abilities.get(ability, 10) - 10) // 2


def validate_saving_throw_request(request: SavingThrowRequest) -> None:
    if request.ability not in VALID_ABILITIES:
        raise ValueError(f"Unknown saving throw ability: {request.ability}")
    if not MIN_DC <= request.dc <= MAX_DC:
        raise ValueError(f"Invalid saving throw DC: {request.dc}")
    if not request.source.strip() or not request.source_id.strip():
        raise ValueError("Saving throw requires source and source_id.")


def format_saving_throw_lines(result: SavingThrowResult, *, context: str = "") -> list[str]:
    """Engine journal lines (English); frontend localizes for CS."""
    adv = ""
    if result.advantage and not result.disadvantage:
        adv = " (advantage)"
    elif result.disadvantage and not result.advantage:
        adv = " (disadvantage)"
    prof = f" +{result.proficiency_bonus} proficiency" if result.proficient else ""
    outcome = "success" if result.success else "failure"
    actor = result.actor_name.strip()
    if result.actor_type == "monster" and actor:
        header = f"{actor} saving throw — {result.ability.title()}. DC {result.dc}{adv}."
        mod = result.ability_modifier
        roll_line = f"Roll {result.d20_roll} + {mod} save = {result.total} — {outcome}.{result.lucky_note}"
    else:
        header = f"Saving throw — {result.ability.title()}. DC {result.dc}{adv}."
        roll_line = (
            f"Roll {result.d20_roll} + {result.ability_modifier} ability"
            f"{prof} = {result.total} — {outcome}.{result.lucky_note}"
        )
    if result.automatic_failure:
        roll_line = f"Automatic failure — {result.ability.title()} save.{result.lucky_note}"
    lines = [header, roll_line]
    if context:
        lines.insert(0, context)
    return lines


def spell_save_dc(character: CharacterState) -> int:
    return 8 + _proficiency_bonus(character.level) + _ability_modifier_for_spellcasting(character)


def _ability_modifier_for_spellcasting(character: CharacterState) -> int:
    from .spells import SPELLCASTING_ABILITIES

    ability_key = character.spellcasting_ability or SPELLCASTING_ABILITIES.get(character.character_class, "int")
    ability_name = {"int": "intelligence", "wis": "wisdom", "cha": "charisma"}.get(ability_key, ability_key)
    if ability_name not in VALID_ABILITIES:
        ability_name = "intelligence"
    return _ability_modifier(character, ability_name)


def perform_saving_throw(
    engine: GameEngine,
    character: CharacterState,
    request: SavingThrowRequest,
    *,
    roll_d20: Callable[[], int] | None = None,
) -> SavingThrowResult:
    validate_saving_throw_request(request)
    from .conditions import player_save_forced_failure

    if player_save_forced_failure(character, request.ability):
        return SavingThrowResult(
            ability=request.ability,
            dc=request.dc,
            d20_roll=1,
            second_d20=None,
            ability_modifier=_ability_modifier(character, request.ability),
            proficiency_bonus=0,
            proficient=request.ability in character.saving_throw_proficiencies,
            total=0,
            success=False,
            advantage=False,
            disadvantage=False,
            source=request.source,
            source_id=request.source_id,
            lucky_note="",
            natural_1=True,
            natural_20=False,
            actor_type="player",
            actor_name=character.name,
            automatic_failure=True,
        )
    ability_mod = _ability_modifier(character, request.ability)
    prof = _proficiency_bonus(character.level)
    proficient = request.ability in character.saving_throw_proficiencies
    modifier = ability_mod + (prof if proficient else 0)

    from .race_features import halfling_lucky_reroll, saving_throw_racial_advantage

    advantage = request.advantage or saving_throw_racial_advantage(character, request)
    disadvantage = request.disadvantage
    if advantage and disadvantage:
        advantage = False
        disadvantage = False

    def pull_natural() -> int:
        if roll_d20 is not None:
            return roll_d20()
        return engine.rng.randint(1, 20)

    second: int | None = None
    if advantage or disadvantage:
        first = pull_natural()
        other = pull_natural()
        if advantage:
            natural = max(first, other)
            second = min(first, other)
        else:
            natural = min(first, other)
            second = max(first, other)
    else:
        natural = pull_natural()

    natural, lucky_note = halfling_lucky_reroll(character, natural, pull_natural)

    total = natural + modifier
    success = total >= request.dc
    return SavingThrowResult(
        ability=request.ability,
        dc=request.dc,
        d20_roll=natural,
        second_d20=second,
        ability_modifier=ability_mod,
        proficiency_bonus=prof if proficient else 0,
        proficient=proficient,
        total=total,
        success=success,
        advantage=advantage,
        disadvantage=disadvantage,
        source=request.source,
        source_id=request.source_id,
        lucky_note=lucky_note,
        natural_1=natural == 1,
        natural_20=natural == 20,
        actor_type="player",
        actor_name=character.name,
    )


def perform_monster_saving_throw(
    engine: "GameEngine",
    monster: MonsterState,
    request: SavingThrowRequest,
    *,
    roll_d20: Callable[[], int] | None = None,
) -> SavingThrowResult:
    validate_saving_throw_request(request)
    save_bonus = int(monster.saving_throws.get(request.ability, 0))

    advantage = request.advantage
    disadvantage = request.disadvantage
    if advantage and disadvantage:
        advantage = False
        disadvantage = False

    def pull_natural() -> int:
        if roll_d20 is not None:
            return roll_d20()
        return engine.rng.randint(1, 20)

    second: int | None = None
    if advantage or disadvantage:
        first = pull_natural()
        other = pull_natural()
        if advantage:
            natural = max(first, other)
            second = min(first, other)
        else:
            natural = min(first, other)
            second = max(first, other)
    else:
        natural = pull_natural()

    total = natural + save_bonus
    success = total >= request.dc
    return SavingThrowResult(
        ability=request.ability,
        dc=request.dc,
        d20_roll=natural,
        second_d20=second,
        ability_modifier=save_bonus,
        proficiency_bonus=0,
        proficient=False,
        total=total,
        success=success,
        advantage=advantage,
        disadvantage=disadvantage,
        source=request.source,
        source_id=request.source_id,
        lucky_note="",
        natural_1=natural == 1,
        natural_20=natural == 20,
        actor_type="monster",
        actor_name=monster.name,
    )


def roll_result_compat(result: SavingThrowResult) -> RollResult:
    """Legacy RollResult for callers still expecting a tuple API."""
    return RollResult("1d20", (result.d20_roll,), result.ability_modifier + result.proficiency_bonus, result.total)
