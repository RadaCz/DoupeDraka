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


def resolve_combat_action_for_simulation(
    game: GameEngine,
    hero: CharacterState,
    action: str,
    monster: MonsterState | None = None,
):
    """Resolve combat like automated loops: pass the turn after a lone Action when Bonus remains."""
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
