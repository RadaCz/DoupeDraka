"""Main bell arc + vault first descent → level 3 without search grind (Sprint 15)."""
from __future__ import annotations

import random
from dataclasses import asdict

from app.engine.models import MonsterState
from app.engine.service import GameEngine

CLASSES = ("fighter", "rogue", "cleric", "wizard")
SEEDS = (0, 1, 7, 42, 99)


def _fight_to_clear(game: GameEngine, hero, monster: MonsterState | None, max_turns: int = 120) -> int:
    turns = 0
    while not hero.quest_flags.get("vault_first_descent_story_awarded") and turns < max_turns:
        if monster is None:
            hero.location = "The Sunken Corridor"
            _, monster = game._travel(hero, "travel to The Vault of Echoes")
            if monster is None:
                break
        if hero.hp <= 0:
            game._recover_from_combat_defeat(hero)
            hero.combatant = None
            monster = None
            continue
        name = monster.name
        _, monster = game.resolve_action(hero, f"attack {name}", monster)
        if not hero.in_combat:
            monster = None
        elif hero.combatant:
            monster = MonsterState(**hero.combatant)
        turns += 1
    return turns


def simulate_main_path(character_class: str, seed: int, *, include_crypt: bool = False) -> dict:
    game = GameEngine(random.Random(seed))
    hero = game.create_character(1, "Story", "human", character_class)

    hero.location = "The Shrine of the Forgotten"
    game.resolve_action(hero, "talk to Caldus about the shrine bell", None)
    hero.location = "The Goblin Market"
    game.resolve_action(hero, "talk to Nib about the shrine bell", None)
    hero.location = "The Shrine of the Forgotten"
    game.resolve_action(hero, "return the shrine bell to Caldus", None)
    game.resolve_action(hero, "talk to Caldus about the vault of echoes", None)

    if include_crypt:
        hero.location = "The Forgotten Crypt"
        game.resolve_action(hero, "search The Forgotten Crypt", None)
        hero.location = "The Sunken Corridor"

    hero.location = "The Sunken Corridor"
    _, monster = game._travel(hero, "travel to The Vault of Echoes")
    combat_turns = _fight_to_clear(game, hero, monster)

    return {
        "seed": seed,
        "class": character_class,
        "crypt": include_crypt,
        "level": hero.level,
        "xp": hero.xp,
        "combat_turns": combat_turns,
        "vault_story_awarded": bool(hero.quest_flags.get("vault_first_descent_story_awarded")),
        "vault_route_xp": bool(hero.quest_flags.get("story_xp_vault_route_awarded")),
    }


def main():
    print("=== Sprint 15 story path (no search grind) ===")
    for cls in CLASSES:
        for seed in SEEDS:
            row = simulate_main_path(cls, seed, include_crypt=False)
            ok = row["level"] >= 3 and row["vault_story_awarded"]
            status = "OK" if ok else "FAIL"
            print(status, row)
        row_crypt = simulate_main_path(cls, 42, include_crypt=True)
        print("crypt", row_crypt)


if __name__ == "__main__":
    main()
