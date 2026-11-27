"""Combat P0c — odmítnutí PŘED hodem nic nespotřebuje (docs/COMBAT_SPEC_B_C.md B1, audit D2).

Produkční kód se nemění. Selhání invariantu = xfail(strict=True) s odkazem na nález.
"""

from __future__ import annotations

import copy
import random
from dataclasses import dataclass
from typing import Any, Callable

import pytest

from app.engine.class_features import mark_player_turn_start
from app.engine.combat_action_economy import spend_action, spend_bonus_action
from app.engine.encounters import build_monster
from app.engine.models import CharacterState, MonsterState
from app.engine.service import GameEngine
from tests.test_spells import create_hero


def _game(seed: int = 17) -> GameEngine:
    return GameEngine(random.Random(seed))


def _goblin() -> MonsterState:
    return MonsterState(
        name="Goblin scout",
        hp=20,
        max_hp=20,
        armor_class=13,
        attack_bonus=4,
        damage="1d6+2",
        template_key="goblin",
    )


def _enter_player_turn(hero: CharacterState, *, distance_ft: int = 30, movement_ft: int = 30) -> None:
    hero.in_combat = True
    hero.combat_turn = "player"
    hero.combat_round = 1
    hero.combat_flags = {
        "action_used": False,
        "bonus_action_used": False,
        "reaction_used": False,
    }
    mark_player_turn_start(hero)
    hero.combat_distance_ft = distance_ft
    hero.combat_movement_remaining_ft = movement_ft


def _attach_combatant(hero: CharacterState, monster: MonsterState) -> None:
    from dataclasses import asdict

    hero.combatant = asdict(monster)


def _combat_snapshot(hero: CharacterState, monster: MonsterState | None) -> dict[str, Any]:
    return {
        "flags": dict(hero.combat_flags or {}),
        "movement_remaining_ft": hero.combat_movement_remaining_ft,
        "combat_distance_ft": hero.combat_distance_ft,
        "spell_slots": dict(hero.spell_slots or {}),
        "max_spell_slots": dict(hero.max_spell_slots or {}),
        "hp_hero": hero.hp,
        "hp_monster": monster.hp if monster is not None else None,
        "inventory": list(hero.inventory or []),
        "item_instances": copy.deepcopy(hero.item_instances or []),
        "combat_turn": hero.combat_turn,
        "combat_round": hero.combat_round,
        "in_combat": hero.in_combat,
        "action_surge_available": hero.action_surge_available,
        "second_wind_available": hero.second_wind_available,
        "channel_divinity_available": hero.channel_divinity_available,
    }


def _assert_rejection_unchanged(
    game: GameEngine,
    hero: CharacterState,
    monster: MonsterState,
    action: str,
    *,
    expect_state_changed: bool = False,
) -> None:
    before = _combat_snapshot(hero, monster)
    result, monster_after = game.resolve_action(hero, action, monster)
    assert result.state_changed is expect_state_changed
    after_first = _combat_snapshot(hero, monster_after)
    assert after_first == before, f"{action}: state mutated on first resolve"

    result2, monster_after2 = game.resolve_action(hero, action, monster_after)
    assert result2.state_changed is expect_state_changed
    after_second = _combat_snapshot(hero, monster_after2)
    assert after_second == before, f"{action}: idempotent repeat mutated state"


@dataclass(frozen=True)
class RejectBeforeRollCase:
    case_id: str
    action: str
    prepare: Callable[[GameEngine], tuple[CharacterState, MonsterState]]
    xfail_reason: str | None = None


def _prep_attack_out_of_range(game: GameEngine) -> tuple[CharacterState, MonsterState]:
    hero = game.create_character(1, "Melee", "human", "fighter")
    _enter_player_turn(hero, distance_ft=60)
    monster = _goblin()
    _attach_combatant(hero, monster)
    return hero, monster


def _prep_attack_no_ammo(game: GameEngine) -> tuple[CharacterState, MonsterState]:
    hero = game.create_character(
        1,
        "Archer",
        "human",
        "fighter",
        background="folk_hero",
        class_skills=["Athletics", "Perception"],
        equipment_package="archer",
    )
    _enter_player_turn(hero, distance_ft=40)
    hero.inventory = [i for i in hero.inventory if "arrow" not in i.casefold()]
    monster = _goblin()
    _attach_combatant(hero, monster)
    return hero, monster


def _prep_attack_enemy_turn(game: GameEngine) -> tuple[CharacterState, MonsterState]:
    hero = game.create_character(1, "Wait", "human", "fighter")
    _enter_player_turn(hero, distance_ft=5)
    hero.combat_turn = "enemy"
    monster = _goblin()
    _attach_combatant(hero, monster)
    return hero, monster


def _prep_attack_paralyzed(game: GameEngine) -> tuple[CharacterState, MonsterState]:
    from app.engine.conditions import apply_player_condition

    hero = game.create_character(1, "Stiff", "human", "fighter")
    _enter_player_turn(hero, distance_ft=5)
    apply_player_condition(
        hero,
        "paralyzed",
        "test",
        applied_at_round=1,
        repeat_save_ability="constitution",
        repeat_save_dc=10,
    )
    monster = _goblin()
    _attach_combatant(hero, monster)
    return hero, monster


def _prep_move_over_budget(game: GameEngine) -> tuple[CharacterState, MonsterState]:
    hero = game.create_character(1, "Mover", "human", "fighter")
    _enter_player_turn(hero, distance_ft=40, movement_ft=10)
    monster = _goblin()
    _attach_combatant(hero, monster)
    return hero, monster


def _prep_move_enemy_turn(game: GameEngine) -> tuple[CharacterState, MonsterState]:
    hero = game.create_character(1, "Wait", "human", "fighter")
    _enter_player_turn(hero)
    hero.combat_turn = "enemy"
    monster = _goblin()
    _attach_combatant(hero, monster)
    return hero, monster


def _prep_move_paralyzed(game: GameEngine) -> tuple[CharacterState, MonsterState]:
    from app.engine.conditions import apply_player_condition

    hero = game.create_character(1, "Stiff", "human", "fighter")
    _enter_player_turn(hero)
    apply_player_condition(
        hero,
        "paralyzed",
        "test",
        applied_at_round=1,
        repeat_save_ability="constitution",
        repeat_save_dc=10,
    )
    monster = _goblin()
    _attach_combatant(hero, monster)
    return hero, monster


def _prep_cast_no_slots(game: GameEngine) -> tuple[CharacterState, MonsterState]:
    hero = create_hero("cleric", wisdom=16)
    hero.prepared_spells = ["Cure Wounds"]
    hero.known_spells = ["Cure Wounds", "Sacred Flame"]
    hero.spell_slots.clear()
    _enter_player_turn(hero)
    monster = _goblin()
    _attach_combatant(hero, monster)
    return hero, monster


def _prep_cast_enemy_turn(game: GameEngine) -> tuple[CharacterState, MonsterState]:
    hero = create_hero("wizard", intelligence=16)
    hero.prepared_spells = ["Fire Bolt"]
    _enter_player_turn(hero)
    hero.combat_turn = "enemy"
    monster = _goblin()
    _attach_combatant(hero, monster)
    return hero, monster


def _prep_cast_non_caster(game: GameEngine) -> tuple[CharacterState, MonsterState]:
    hero = game.create_character(1, "Fighter", "human", "fighter")
    hero.known_spells = ["Fire Bolt"]
    _enter_player_turn(hero)
    monster = _goblin()
    _attach_combatant(hero, monster)
    return hero, monster


def _prep_cast_action_spent(game: GameEngine) -> tuple[CharacterState, MonsterState]:
    hero = create_hero("cleric", wisdom=16)
    hero.prepared_spells = ["Sacred Flame"]
    hero.known_spells = ["Sacred Flame"]
    _enter_player_turn(hero)
    spend_action(hero)
    monster = _goblin()
    _attach_combatant(hero, monster)
    return hero, monster


def _prep_flee_enemy_turn(game: GameEngine) -> tuple[CharacterState, MonsterState]:
    hero = game.create_character(1, "Runner", "human", "rogue")
    _enter_player_turn(hero)
    hero.combat_turn = "enemy"
    monster = build_monster("normal", "goblin")
    _attach_combatant(hero, monster)
    return hero, monster


def _prep_flee_action_spent(game: GameEngine) -> tuple[CharacterState, MonsterState]:
    hero = game.create_character(1, "Runner", "human", "rogue")
    _enter_player_turn(hero)
    spend_action(hero)
    monster = build_monster("normal", "goblin")
    _attach_combatant(hero, monster)
    return hero, monster


def _prep_sprint_action_spent(game: GameEngine) -> tuple[CharacterState, MonsterState]:
    hero = game.create_character(1, "Fighter", "human", "fighter")
    _enter_player_turn(hero)
    spend_action(hero)
    monster = _goblin()
    _attach_combatant(hero, monster)
    return hero, monster


def _prep_sprint_out_of_combat(game: GameEngine) -> tuple[CharacterState, MonsterState]:
    hero = game.create_character(1, "Fighter", "human", "fighter")
    hero.in_combat = False
    monster = _goblin()
    _attach_combatant(hero, monster)
    return hero, monster


def _prep_disengage_pools_spent(game: GameEngine) -> tuple[CharacterState, MonsterState]:
    hero = game.create_character(1, "Rogue", "human", "rogue")
    hero.level = 2
    _enter_player_turn(hero)
    spend_bonus_action(hero)
    spend_action(hero)
    monster = _goblin()
    _attach_combatant(hero, monster)
    return hero, monster


def _prep_action_surge_spent(game: GameEngine) -> tuple[CharacterState, MonsterState]:
    hero = game.create_character(1, "Fighter", "human", "fighter")
    hero.level = 2
    hero.action_surge_available = False
    _enter_player_turn(hero)
    spend_action(hero)
    monster = _goblin()
    _attach_combatant(hero, monster)
    return hero, monster


def _prep_action_surge_before_action(game: GameEngine) -> tuple[CharacterState, MonsterState]:
    hero = game.create_character(1, "Fighter", "human", "fighter")
    hero.level = 2
    hero.action_surge_available = True
    _enter_player_turn(hero)
    monster = _goblin()
    _attach_combatant(hero, monster)
    return hero, monster


def _prep_decline_reaction_no_window(game: GameEngine) -> tuple[CharacterState, MonsterState]:
    hero = create_hero("wizard", intelligence=16)
    _enter_player_turn(hero)
    monster = _goblin()
    _attach_combatant(hero, monster)
    return hero, monster


def _prep_shield_no_window(game: GameEngine) -> tuple[CharacterState, MonsterState]:
    hero = create_hero("wizard", intelligence=16)
    _enter_player_turn(hero)
    monster = _goblin()
    _attach_combatant(hero, monster)
    return hero, monster


def _prep_blocked_during_reaction_window(game: GameEngine) -> tuple[CharacterState, MonsterState]:
    hero = create_hero("wizard", intelligence=16)
    _enter_player_turn(hero)
    hero.combat_turn = "reaction"
    hero.combat_reaction_pending = {
        "kind": "shield_vs_attack",
        "monster_name": "Goblin scout",
        "monster_key": "goblin",
        "label": "attack",
        "melee": True,
        "natural": 15,
        "attack_total": 18,
        "critical": False,
        "damage_dice": "1d6",
        "damage_bonus": 2,
    }
    monster = _goblin()
    _attach_combatant(hero, monster)
    return hero, monster


def _prep_second_wind_non_fighter(game: GameEngine) -> tuple[CharacterState, MonsterState]:
    hero = create_hero("bard")
    _enter_player_turn(hero)
    monster = _goblin()
    _attach_combatant(hero, monster)
    return hero, monster


_REJECT_CASES: list[RejectBeforeRollCase] = [
    RejectBeforeRollCase("attack_out_of_range", "attack goblin", _prep_attack_out_of_range),
    RejectBeforeRollCase("attack_no_ammunition", "attack goblin", _prep_attack_no_ammo),
    RejectBeforeRollCase("attack_enemy_turn", "attack goblin", _prep_attack_enemy_turn),
    RejectBeforeRollCase(
        "attack_paralyzed",
        "attack goblin",
        _prep_attack_paralyzed,
        xfail_reason=(
            "COMBAT_SPEC_B_C.md B1 očekává state_changed=false před hodem; "
            "engine volá _finish_paralyzed_player_turn (service.py:513-532) a ukončí tah hráče."
        ),
    ),
    RejectBeforeRollCase("advance_over_movement_budget", "advance 25 ft", _prep_move_over_budget),
    RejectBeforeRollCase("retreat_over_movement_budget", "retreat 25 ft", _prep_move_over_budget),
    RejectBeforeRollCase("combat_move_enemy_turn", "advance 10 ft", _prep_move_enemy_turn),
    RejectBeforeRollCase(
        "combat_move_paralyzed",
        "advance 10 ft",
        _prep_move_paralyzed,
        xfail_reason=(
            "COMBAT_SPEC_B_C.md B1 — paralyzovaný pohyb končí v _finish_paralyzed_player_turn "
            "(service.py:1092-1094), ne čisté odmítnutí bez změny stavu."
        ),
    ),
    RejectBeforeRollCase("cast_no_spell_slots", "cast Cure Wounds", _prep_cast_no_slots),
    RejectBeforeRollCase("cast_enemy_turn", "cast Fire Bolt", _prep_cast_enemy_turn),
    RejectBeforeRollCase("cast_non_caster", "cast Fire Bolt", _prep_cast_non_caster),
    RejectBeforeRollCase("cast_action_already_used", "cast Sacred Flame", _prep_cast_action_spent),
    RejectBeforeRollCase("flee_enemy_turn", "flee", _prep_flee_enemy_turn),
    RejectBeforeRollCase("flee_action_already_used", "flee", _prep_flee_action_spent),
    RejectBeforeRollCase("sprint_action_spent", "sprint", _prep_sprint_action_spent),
    RejectBeforeRollCase("sprint_out_of_combat", "sprint", _prep_sprint_out_of_combat),
    RejectBeforeRollCase("disengage_rogue_pools_spent", "disengage", _prep_disengage_pools_spent),
    RejectBeforeRollCase("action_surge_spent", "action surge", _prep_action_surge_spent),
    RejectBeforeRollCase("action_surge_before_first_action", "action surge", _prep_action_surge_before_action),
    RejectBeforeRollCase("decline_reaction_no_window", "decline reaction", _prep_decline_reaction_no_window),
    RejectBeforeRollCase("shield_no_reaction_window", "cast Shield", _prep_shield_no_window),
    RejectBeforeRollCase(
        "attack_blocked_during_reaction_window",
        "attack goblin",
        _prep_blocked_during_reaction_window,
    ),
    RejectBeforeRollCase("second_wind_non_fighter", "second wind", _prep_second_wind_non_fighter),
]


def _reject_case_params() -> list[Any]:
    params: list[Any] = []
    for case in _REJECT_CASES:
        marks = []
        if case.xfail_reason:
            marks.append(pytest.mark.xfail(strict=True, reason=case.xfail_reason))
        params.append(pytest.param(case, id=case.case_id, marks=marks))
    return params


@pytest.mark.parametrize("case", _reject_case_params())
def test_combat_rejection_before_roll_leaves_state_unchanged(case: RejectBeforeRollCase) -> None:
    game = _game()
    hero, monster = case.prepare(game)
    _assert_rejection_unchanged(game, hero, monster, case.action)


def test_failed_flee_roll_still_consumes_action() -> None:
    """Kladná kontrola: neúspěšný hod Útěku spotřebuje akci (B8 / audit N3 — záměrně)."""
    game = _game(22)
    hero = game.create_character(1, "Runner", "human", "rogue")
    _enter_player_turn(hero, distance_ft=5)
    monster = build_monster("normal", "goblin")
    _attach_combatant(hero, monster)
    game.rng.randint = lambda _a, _b: 1

    before_flags = dict(hero.combat_flags or {})
    assert not before_flags.get("action_used")

    result, after = game.resolve_action(hero, "flee", monster)
    assert result.state_changed
    assert any("fail to break away" in e.casefold() for e in result.events)
    assert hero.combat_flags.get("action_used")
    assert after is monster
    assert hero.in_combat