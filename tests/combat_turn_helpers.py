"""Close player combat turns the way MVP UI does (explicit end turn when needed)."""

from dataclasses import asdict

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


def _spend_movement_to_close(hero: CharacterState) -> None:
    """Story/combat loops: burn movement toward melee before attacking (Sprint 27 distance)."""
    from app.engine.combat_positioning import MELEE_REACH_FT, apply_player_movement, movement_remaining
    from app.engine.combat_range import evaluate_player_attack_range
    from app.engine.equipment import equipped_weapon

    if not hero.in_combat or hero.combat_turn != "player":
        return
    weapon = equipped_weapon(hero)
    while movement_remaining(hero) > 0:
        ctx = evaluate_player_attack_range(hero, weapon)
        if ctx.allowed:
            return
        if weapon.weapon_type != "melee":
            return
        distance = max(0, int(hero.combat_distance_ft or 0))
        if distance <= MELEE_REACH_FT:
            return
        step = min(movement_remaining(hero), distance - MELEE_REACH_FT)
        apply_player_movement(hero, -step)


def resolve_combat_action_for_simulation(
    game: GameEngine,
    hero: CharacterState,
    action: str,
    monster: MonsterState | None = None,
):
    """Resolve combat like automated loops: pass the turn after a lone Action when Bonus remains."""
    if action.casefold().startswith("attack"):
        _spend_movement_to_close(hero)
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
    ):
        from app.engine.combat_positioning import movement_remaining

        if movement_remaining(hero) == 0:
            result, active = game.resolve_action(hero, "end turn", active)
    return result, active


def _attack_in_range(hero: CharacterState) -> bool:
    from app.engine.combat_range import evaluate_player_attack_range
    from app.engine.equipment import equipped_weapon

    return evaluate_player_attack_range(hero, equipped_weapon(hero)).allowed


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
