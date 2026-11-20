"""Structured combat/turn resolution beats for API clients (Combat V2, task 16)."""

from __future__ import annotations

from copy import deepcopy
from typing import Any

from .models import CharacterState, MonsterState, RollResult, TurnResult


def roll_beat(roll: RollResult | dict) -> dict[str, Any]:
    if isinstance(roll, RollResult):
        return {
            "dice": roll.dice,
            "rolls": list(roll.values),
            "modifier": roll.modifier,
            "total": roll.total,
            "critical": roll.critical,
        }
    return dict(roll)


def attack_outcome(*, natural: int, hit: bool) -> str:
    if natural == 1:
        return "critical_miss"
    if natural == 20:
        return "critical_hit" if hit else "miss"
    if hit:
        return "hit"
    return "miss"


def attach_participant_hp(
    beat: dict[str, Any],
    *,
    character: CharacterState | None = None,
    monster: MonsterState | None = None,
) -> dict[str, Any]:
    """Snapshot HP the engine already tracks — after the beat's mechanical effect."""
    if character is not None:
        beat["hero"] = {"hp_current": character.hp, "hp_max": character.max_hp}
    if monster is not None:
        beat["enemy"] = {
            "hp_current": monster.hp,
            "hp_max": monster.max_hp,
            "name": monster.name,
        }
    return beat


def beat_attack(
    *,
    actor: str,
    actor_name: str,
    natural: int,
    attack_modifier: int,
    attack_total: int,
    target_ac: int,
    outcome: str,
    character: CharacterState | None = None,
    monster: MonsterState | None = None,
    weapon: str | None = None,
    damage: RollResult | None = None,
    damage_dice: str | None = None,
    damage_type: str | None = None,
    opportunity: bool = False,
) -> dict[str, Any]:
    beat: dict[str, Any] = {
        "kind": "attack",
        "actor": actor,
        "actor_name": actor_name,
        "attack_roll": {
            "natural": natural,
            "modifier": attack_modifier,
            "total": attack_total,
        },
        "target_ac": target_ac,
        "outcome": outcome,
    }
    if weapon:
        beat["weapon"] = weapon
    if opportunity:
        beat["opportunity_attack"] = True
    if damage is not None:
        beat["damage"] = roll_beat(damage)
        if damage_dice:
            beat["damage"]["dice"] = damage_dice
        if damage_type:
            beat["damage"]["damage_type"] = damage_type
    return attach_participant_hp(beat, character=character, monster=monster)


def beat_enemy_attack_roll(
    *,
    monster_name: str,
    natural: int,
    attack_modifier: int,
    attack_total: int,
    target_ac: int,
    outcome: str,
    character: CharacterState | None = None,
    monster: MonsterState | None = None,
    label: str = "attack",
) -> dict[str, Any]:
    beat = {
        "kind": "attack",
        "actor": "enemy",
        "actor_name": monster_name,
        "attack_label": label,
        "attack_roll": {
            "natural": natural,
            "modifier": attack_modifier,
            "total": attack_total,
        },
        "target_ac": target_ac,
        "outcome": outcome,
    }
    return attach_participant_hp(beat, character=character, monster=monster)


def beat_damage_to_player(
    *,
    monster_name: str,
    attack_total: int,
    natural: int,
    target_ac: int,
    damage: RollResult,
    damage_dice: str,
    character: CharacterState,
    monster: MonsterState | None = None,
    label: str = "attack",
    outcome: str = "hit",
) -> dict[str, Any]:
    beat = {
        "kind": "attack",
        "actor": "enemy",
        "actor_name": monster_name,
        "attack_label": label,
        "attack_roll": {
            "natural": natural,
            "modifier": attack_total - natural,
            "total": attack_total,
        },
        "target_ac": target_ac,
        "outcome": outcome,
        "damage": {**roll_beat(damage), "dice": damage_dice},
    }
    return attach_participant_hp(beat, character=character, monster=monster)


def beat_movement(
    *,
    actor: str,
    distance_ft: dict[str, int],
    character: CharacterState | None = None,
    monster: MonsterState | None = None,
) -> dict[str, Any]:
    beat = {"kind": "movement", "actor": actor, "distance_ft": distance_ft}
    return attach_participant_hp(beat, character=character, monster=monster)


def beat_healing(
    *,
    actor: str,
    amount: int,
    character: CharacterState,
    monster: MonsterState | None = None,
) -> dict[str, Any]:
    beat = {
        "kind": "healing",
        "actor": actor,
        "healing": amount,
    }
    return attach_participant_hp(beat, character=character, monster=monster)


def beat_saving_throw(
    save_facts: dict,
    *,
    character: CharacterState | None = None,
    monster: MonsterState | None = None,
) -> dict[str, Any] | None:
    if not save_facts:
        return None
    actor_type = save_facts.get("actor_type") or "player"
    actor = "enemy" if actor_type == "enemy" else "hero"
    beat = {
        "kind": "saving_throw",
        "actor": actor,
        "actor_name": save_facts.get("actor_name") or "",
        "ability": save_facts.get("ability"),
        "dc": save_facts.get("dc"),
        "roll": {
            "natural": save_facts.get("d20_roll"),
            "modifier": save_facts.get("ability_modifier", 0) + save_facts.get("proficiency_bonus", 0),
            "total": save_facts.get("total"),
        },
        "success": save_facts.get("succeeded", save_facts.get("success")),
        "source": save_facts.get("source"),
        "source_id": save_facts.get("source_id"),
    }
    return attach_participant_hp(beat, character=character, monster=monster)


def beat_reaction_shield(
    *,
    cast: bool,
    declined: bool,
    ac: int | None = None,
    character: CharacterState | None = None,
    monster: MonsterState | None = None,
) -> dict[str, Any]:
    beat: dict[str, Any] = {
        "kind": "reaction",
        "actor": "hero",
        "name": "shield",
        "cast": cast,
        "declined": declined,
    }
    if ac is not None:
        beat["ac"] = ac
    return attach_participant_hp(beat, character=character, monster=monster)


def beat_reaction_opportunity(
    *,
    actor: str,
    character: CharacterState | None = None,
    monster: MonsterState | None = None,
) -> dict[str, Any]:
    beat = {"kind": "reaction", "actor": actor, "name": "opportunity_attack"}
    return attach_participant_hp(beat, character=character, monster=monster)


def beat_defend(
    *,
    character: CharacterState,
    monster: MonsterState | None = None,
    action: str = "dodge",
) -> dict[str, Any]:
    beat = {"kind": "defend", "actor": "hero", "action": action}
    return attach_participant_hp(beat, character=character, monster=monster)


def beat_disengage(
    *,
    character: CharacterState,
    monster: MonsterState | None = None,
    bonus_action: bool = False,
) -> dict[str, Any]:
    beat: dict[str, Any] = {"kind": "disengage", "actor": "hero", "action": "disengage"}
    if bonus_action:
        beat["bonus_action"] = True
    return attach_participant_hp(beat, character=character, monster=monster)


def beat_flee(
    *,
    success: bool,
    ability: str,
    dc: int,
    check: RollResult,
    character: CharacterState,
    monster: MonsterState | None = None,
) -> dict[str, Any]:
    beat = {
        "kind": "flee",
        "actor": "hero",
        "success": success,
        "ability": ability,
        "dc": dc,
        "roll": {
            "natural": check.values[0] if check.values else check.total - check.modifier,
            "modifier": check.modifier,
            "total": check.total,
        },
    }
    return attach_participant_hp(beat, character=character, monster=monster)


def beat_spell_auto_hit(
    *,
    spell_name: str,
    damage: int,
    darts: list[dict],
    character: CharacterState,
    monster: MonsterState | None = None,
) -> dict[str, Any]:
    beat: dict[str, Any] = {
        "kind": "spell_damage",
        "subtype": "auto_hit",
        "actor": "hero",
        "spell_name": spell_name,
        "auto_hit": True,
        "damage": damage,
        "darts": darts,
    }
    return attach_participant_hp(beat, character=character, monster=monster)


def beat_spell_save_damage(
    *,
    spell_name: str,
    save_facts: dict,
    damage: int,
    rolled_total: int | None = None,
    half_on_success: bool = False,
    character: CharacterState,
    monster: MonsterState | None = None,
) -> dict[str, Any]:
    beat: dict[str, Any] = {
        "kind": "spell_damage",
        "subtype": "saving_throw",
        "actor": "hero",
        "spell_name": spell_name,
        "damage": damage,
        "roll": {
            "natural": save_facts.get("d20_roll"),
            "modifier": save_facts.get("ability_modifier", 0) + save_facts.get("proficiency_bonus", 0),
            "total": save_facts.get("total"),
        },
        "ability": save_facts.get("ability"),
        "dc": save_facts.get("dc"),
        "success": save_facts.get("succeeded", save_facts.get("success")),
    }
    if rolled_total is not None:
        beat["damage_rolled"] = rolled_total
    if half_on_success:
        beat["half_damage_on_success"] = True
    return attach_participant_hp(beat, character=character, monster=monster)


def beats_from_save_facts(
    save_facts: dict,
    *,
    character: CharacterState | None = None,
    monster: MonsterState | None = None,
) -> list[dict[str, Any]]:
    beats: list[dict[str, Any]] = []
    inner = save_facts.get("save")
    if isinstance(inner, dict):
        # Spell saves are emitted as spell_damage beats in _cast_spell.
        if inner.get("source") == "spell":
            return beats
        beat = beat_saving_throw(inner, character=character, monster=monster)
        if beat:
            beats.append(beat)
    elif isinstance(save_facts, dict) and save_facts.get("ability"):
        beat = beat_saving_throw(save_facts, character=character, monster=monster)
        if beat:
            beats.append(beat)
    return beats


def finalize_turn_resolution(
    result: TurnResult,
    captured_beats: list[dict[str, Any]],
    *,
    character: CharacterState | None = None,
    monster: MonsterState | None = None,
) -> TurnResult:
    """Attach merged resolution to a turn without changing journal event strings."""
    beats = deepcopy(captured_beats)
    beats.extend(beats_from_save_facts(result.save_facts or {}, character=character, monster=monster))
    if result.class_facts.get("reaction_shield"):
        shield = result.class_facts["reaction_shield"]
        beats.append(
            beat_reaction_shield(
                cast=bool(shield.get("cast")),
                declined=bool(shield.get("declined")),
                ac=shield.get("ac"),
                character=character,
                monster=monster,
            )
        )
    if not beats:
        return result
    result.resolution = {"beats": beats}
    return result