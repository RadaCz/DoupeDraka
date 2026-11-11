"""SRD 5.1 saving throws — single authority for player saves."""

from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import TYPE_CHECKING, Callable

from .catalog import ABILITY_ORDER
from .models import CharacterState, RollResult

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

    def to_facts(self) -> dict:
        payload = asdict(self)
        payload["dice"] = "1d20"
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
    lines = [
        f"Saving throw — {result.ability.title()}. DC {result.dc}{adv}.",
        (
            f"Roll {result.d20_roll} + {result.ability_modifier} ability"
            f"{prof} = {result.total} — {outcome}.{result.lucky_note}"
        ),
    ]
    if context:
        lines.insert(0, context)
    return lines


def perform_saving_throw(
    engine: GameEngine,
    character: CharacterState,
    request: SavingThrowRequest,
    *,
    roll_d20: Callable[[], int] | None = None,
) -> SavingThrowResult:
    validate_saving_throw_request(request)
    ability_mod = _ability_modifier(character, request.ability)
    prof = _proficiency_bonus(character.level)
    proficient = request.ability in character.saving_throw_proficiencies
    modifier = ability_mod + (prof if proficient else 0)

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

    lucky_note = ""
    if character.race == "halfling" and natural == 1:
        reroll = pull_natural()
        lucky_note = f" Halfling Lucky: 1 → {reroll}."
        natural = reroll

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
    )


def roll_result_compat(result: SavingThrowResult) -> RollResult:
    """Legacy RollResult for callers still expecting a tuple API."""
    return RollResult("1d20", (result.d20_roll,), result.ability_modifier + result.proficiency_bonus, result.total)
