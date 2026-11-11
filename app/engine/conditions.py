"""Combat conditions — persisted engine state with mechanical effect."""

from __future__ import annotations

from copy import deepcopy
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .models import CharacterState, MonsterState
    from .service import GameEngine

from .saving_throws import SavingThrowRequest, format_saving_throw_lines, perform_saving_throw

PARALYZED_ID = "paralyzed"
DISADVANTAGE_NEXT_ATTACK = "disadvantage_next_attack"

REPEAT_SAVE_END_OF_TURN = frozenset({PARALYZED_ID})


def _conditions(character: CharacterState) -> list[dict]:
    raw = getattr(character, "conditions", None)
    if not raw:
        character.conditions = []
        return character.conditions
    return raw


def has_condition(character: CharacterState, condition_id: str) -> bool:
    return any(c.get("condition_id") == condition_id for c in _conditions(character))


def monster_conditions(monster: MonsterState) -> list[dict]:
    raw = getattr(monster, "conditions", None)
    if not raw:
        monster.conditions = []
        return monster.conditions
    return raw


def monster_has_condition(monster: MonsterState, condition_id: str) -> bool:
    return any(c.get("condition_id") == condition_id for c in monster_conditions(monster))


def apply_player_condition(
    character: CharacterState,
    condition_id: str,
    source_id: str,
    *,
    applied_at_round: int,
    duration_rounds: int | None = None,
    repeat_save_ability: str | None = None,
    repeat_save_dc: int | None = None,
) -> None:
    conditions = _conditions(character)
    conditions[:] = [c for c in conditions if c.get("condition_id") != condition_id]
    conditions.append(
        {
            "condition_id": condition_id,
            "source_id": source_id,
            "applied_at_round": applied_at_round,
            "duration_rounds": duration_rounds,
            "repeat_save_ability": repeat_save_ability,
            "repeat_save_dc": repeat_save_dc,
        }
    )


def apply_monster_condition(
    monster: MonsterState,
    condition_id: str,
    source_id: str,
    *,
    applied_at_round: int,
) -> None:
    conditions = monster_conditions(monster)
    conditions[:] = [c for c in conditions if c.get("condition_id") != condition_id]
    conditions.append(
        {
            "condition_id": condition_id,
            "source_id": source_id,
            "applied_at_round": applied_at_round,
        }
    )


def clear_condition(character: CharacterState, condition_id: str) -> bool:
    before = len(_conditions(character))
    character.conditions = [c for c in _conditions(character) if c.get("condition_id") != condition_id]
    return len(character.conditions) < before


def player_paralyzed(character: CharacterState) -> bool:
    return has_condition(character, PARALYZED_ID)


def player_save_forced_failure(character: CharacterState, ability: str) -> bool:
    if not player_paralyzed(character):
        return False
    return ability in {"strength", "dexterity"}


def player_action_blocked(character: CharacterState) -> bool:
    return player_paralyzed(character)


def attacks_against_player_have_advantage(character: CharacterState) -> bool:
    return player_paralyzed(character)


def monster_next_attack_disadvantage(monster: MonsterState) -> bool:
    return monster_has_condition(monster, DISADVANTAGE_NEXT_ATTACK)


def consume_monster_disadvantage(monster: MonsterState) -> bool:
    if not monster_has_condition(monster, DISADVANTAGE_NEXT_ATTACK):
        return False
    monster.conditions = [
        c for c in monster_conditions(monster) if c.get("condition_id") != DISADVANTAGE_NEXT_ATTACK
    ]
    return True


def condition_labels(character: CharacterState) -> list[str]:
    return [str(c.get("condition_id", "")) for c in _conditions(character) if c.get("condition_id")]


def tick_condition_durations(character: CharacterState) -> None:
    """Decrement round-based durations at end of relevant turns."""
    kept: list[dict] = []
    for cond in _conditions(character):
        remaining = cond.get("duration_rounds")
        if remaining is None:
            kept.append(cond)
            continue
        remaining = int(remaining) - 1
        if remaining > 0:
            cond = deepcopy(cond)
            cond["duration_rounds"] = remaining
            kept.append(cond)
    character.conditions = kept


def try_player_repeat_saves(engine: "GameEngine", character: CharacterState) -> list[str]:
    """End of player turn — repeat saves for conditions that allow them (SRD)."""
    events: list[str] = []
    for cond in list(_conditions(character)):
        cid = cond.get("condition_id")
        if cid not in REPEAT_SAVE_END_OF_TURN:
            continue
        ability = cond.get("repeat_save_ability")
        dc = cond.get("repeat_save_dc")
        if not ability or dc is None:
            continue
        request = SavingThrowRequest(
            ability=str(ability),
            dc=int(dc),
            source="condition",
            source_id=str(cond.get("source_id", cid)),
        )
        result = perform_saving_throw(engine, character, request)
        events.extend(
            format_saving_throw_lines(
                result,
                context=f"End of your turn — repeat save to end {cid}.",
            )
        )
        if result.success:
            clear_condition(character, str(cid))
            events.append(f"The {cid} effect ends.")
    return events


def apply_paralysis_on_failed_save(
    engine: "GameEngine",
    character: CharacterState,
    source_id: str,
) -> list[str]:
    apply_player_condition(
        character,
        PARALYZED_ID,
        source_id,
        applied_at_round=character.combat_round,
        duration_rounds=10,
        repeat_save_ability="constitution",
        repeat_save_dc=10,
    )
    return ["You fail the save. You are paralyzed (incapacitated)."]


def apply_mockery_disadvantage(monster: MonsterState, source_id: str, round_no: int) -> list[str]:
    apply_monster_condition(monster, DISADVANTAGE_NEXT_ATTACK, source_id, applied_at_round=round_no)
    return ["The target loses focus — disadvantage on its next attack roll."]
