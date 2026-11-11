"""Close player combat turns the way MVP UI does (explicit end turn when needed)."""

from dataclasses import asdict

from app.engine.combat_positioning import MELEE_REACH_FT, movement_remaining
from app.engine.combat_range import evaluate_player_attack_range
from app.engine.equipment import equipped_weapon
from app.engine.models import CharacterState, MonsterState
from app.engine.service import GameEngine


def monster_from_hero(hero: CharacterState) -> MonsterState | None:
    if not hero.combatant:
        return None
    return MonsterState(**hero.combatant)


def resolve_combat_action(
    game: GameEngine,
    hero: CharacterState,
    action: str,
    monster: MonsterState | None = None,
):
    active = monster if monster is not None else monster_from_hero(hero)
    return game.resolve_action(hero, action, active)


def _attack_in_range(hero: CharacterState, *, thrown: bool = False) -> bool:
    weapon = equipped_weapon(hero)
    return evaluate_player_attack_range(hero, weapon, thrown=thrown).allowed


def _advance_via_engine(game: GameEngine, hero: CharacterState, monster: MonsterState | None) -> None:
    """Use COMBAT_MOVE intent — same path as the UI chips."""
    if not hero.in_combat or hero.combat_turn != "player":
        return
    weapon = equipped_weapon(hero)
    if weapon.weapon_type != "melee" and _attack_in_range(hero):
        return
    while movement_remaining(hero) > 0 and not _attack_in_range(hero):
        distance = max(0, int(hero.combat_distance_ft or 0))
        if distance <= MELEE_REACH_FT:
            break
        step = min(movement_remaining(hero), distance - MELEE_REACH_FT)
        if step <= 0:
            break
        resolve_combat_action(game, hero, f"advance {step} ft", monster)


def resolve_combat_action_for_simulation(
    game: GameEngine,
    hero: CharacterState,
    action: str,
    monster: MonsterState | None = None,
):
    """Resolve combat like automated loops: pass the turn after a lone Action when Bonus remains."""
    if action.casefold().startswith("attack"):
        _advance_via_engine(game, hero, monster)
    result, active = resolve_combat_action(game, hero, action, monster)
    flags = hero.combat_flags or {}
    if (
        hero.in_combat
        and active is not None
        and hero.combat_turn == "player"
        and flags.get("action_used")
        and not flags.get("bonus_action_used")
    ):
        result, active = game.resolve_action(hero, "end turn", active)
    elif (
        hero.in_combat
        and active is not None
        and hero.combat_turn == "player"
        and action.casefold().startswith("attack")
        and not flags.get("action_used")
        and not _attack_in_range(hero)
        and movement_remaining(hero) == 0
    ):
        result, active = game.resolve_action(hero, "end turn", active)
    return result, active


def resolve_combat_action_and_end_turn(
    game: GameEngine,
    hero: CharacterState,
    action: str,
    monster: MonsterState | None = None,
):
    result, active = resolve_combat_action(game, hero, action, monster)
    if hero.in_combat and active is not None and hero.combat_turn == "player":
        result, active = game.resolve_action(hero, "end turn", active)
    return result, active


def sync_combatant(hero: CharacterState, active: MonsterState | None) -> None:
    hero.combatant = asdict(active) if active else None
