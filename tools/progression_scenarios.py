"""Read-only chapter-one XP grind simulation (Sprint 11.4 report helper)."""
from __future__ import annotations

import random
from dataclasses import asdict

from app.engine.models import MonsterState
from app.engine.service import GameEngine, XP_THRESHOLD


def _grind_loop(
    game: GameEngine,
    hero,
    *,
    location: str,
    max_turns: int,
    stop_at_level: int | None = 5,
) -> dict:
    fights = wins = defeats = explores = 0
    level_milestones: dict[int, dict[str, int]] = {}

    def turn(action: str):
        nonlocal fights, wins
        m = MonsterState(**hero.combatant) if hero.combatant else None
        r, mon = game.resolve_action(hero, action, m)
        hero.combatant = asdict(mon) if mon else None
        return r

    def snapshot_milestone():
        for lvl in (2, 3, 4, 5):
            if hero.level >= lvl and lvl not in level_milestones:
                level_milestones[lvl] = {
                    "explores": explores,
                    "fights": fights,
                    "wins": wins,
                    "defeats": defeats,
                }

    hero.location = location
    start_level = hero.level
    start_xp = hero.xp
    snapshot_milestone()

    for _ in range(max_turns):
        cap = stop_at_level if stop_at_level is not None else 5
        if hero.level >= cap:
            break
        if hero.hp <= 0:
            game._recover_from_combat_defeat(hero)
            hero.combatant = None
            defeats += 1
            continue
        if hero.in_combat and hero.combatant:
            fights += 1
            before_hp = MonsterState(**hero.combatant).hp
            name = MonsterState(**hero.combatant).name
            turn(f"attack {name}")
            if not hero.in_combat and before_hp > 0:
                wins += 1
            snapshot_milestone()
            continue
        explores += 1
        turn(f"search {hero.location}")
        snapshot_milestone()

    return {
        "start_level": start_level,
        "start_xp": start_xp,
        "level": hero.level,
        "xp": hero.xp,
        "explores": explores,
        "fights": fights,
        "wins": wins,
        "defeats": defeats,
        "level_milestones": level_milestones,
        "xp_threshold": XP_THRESHOLD,
    }


def simulate_pre_bell(seed: int, *, crypt_relic: bool = True, target_level: int = 3) -> dict:
    """From fresh hero at Whispering Cellar after bell return (+30 XP), grind to target_level."""
    game = GameEngine(random.Random(seed))
    hero = game.create_character(1, "Sim", "human", "fighter")
    game._grant_xp(hero, 30)
    if crypt_relic:
        hero.location = "The Forgotten Crypt"
        hero.quest_flags["crypt_relic_claimed"] = False
        game.resolve_action(hero, "search The Forgotten Crypt", None)
        hero.location = "The Whispering Cellar"
    stats = _grind_loop(
        game, hero, location="The Whispering Cellar", max_turns=600, stop_at_level=target_level
    )
    stats["seed"] = seed
    stats["crypt_relic"] = crypt_relic
    stats["target_level"] = target_level
    stats["reached_target"] = hero.level >= target_level
    return stats


def simulate_post_bell_grind(seed: int, max_turns: int = 400) -> dict:
    game = GameEngine(random.Random(seed))
    hero = game.create_character(1, "Sim", "human", "fighter")
    hero.quest_flags = {"vault_unlocked": True, "bell_quest_complete": True}
    game._grant_xp(hero, 30)
    stats = _grind_loop(game, hero, location="The Whispering Cellar", max_turns=max_turns, stop_at_level=5)
    stats["seed"] = seed
    return stats


def simulate_post_bell_to_boss_ready(seed: int) -> dict:
    """Post-bell return state (30 XP, usually L1) until level 3 (boss gate)."""
    return simulate_pre_bell(seed, crypt_relic=False, target_level=3)


if __name__ == "__main__":
    print("=== Pre-bell grind (30 XP bell return + optional crypt 10 XP) → level 3 ===")
    for label, seed in (("favorable", 0), ("typical", 42), ("harsh", 99)):
        with_crypt = simulate_pre_bell(seed, crypt_relic=True, target_level=3)
        no_crypt = simulate_pre_bell(seed, crypt_relic=False, target_level=3)
        print(label, "with_crypt", with_crypt)
        print(label, "no_crypt", no_crypt)

    print("\n=== Post-bell grind (30 XP, vault unlocked) → level 5 ===")
    for label, seed in (("favorable", 0), ("typical", 42), ("harsh", 99)):
        print(label, simulate_post_bell_grind(seed))
