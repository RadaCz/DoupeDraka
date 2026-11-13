"""Sprint 38 — full Chapter One via engine only (no UI claims)."""

from __future__ import annotations

import random
from dataclasses import asdict

from app.engine.economy_balance import CHAPTER_BOSS_GOLD_GP
from app.engine.equipment import load_character_state
from app.engine.locations import travel_allowed
from app.engine.models import MonsterState
from app.engine.quests import resolve_main_quest_step
from app.engine.service import GameEngine

from tests.combat_turn_helpers import resolve_combat_action_for_simulation


def _bell_arc_to_vault_unlocked(game: GameEngine, hero) -> None:
    def level_up(h):
        return game._level_up(h)

    hero.location = "The Shrine of the Forgotten"
    resolve_main_quest_step(hero, "talk", "accept_caldus", level_up)
    hero.location = "The Goblin Market"
    resolve_main_quest_step(hero, "talk", "ask_nib", level_up)
    hero.location = "The Shrine of the Forgotten"
    resolve_main_quest_step(hero, "return", "return_bell", level_up)
    resolve_main_quest_step(hero, "talk", "accept_caldus", level_up)


def _combat_turn(game: GameEngine, hero, action: str):
    monster = MonsterState(**hero.combatant) if hero.combatant else None
    result, active = resolve_combat_action_for_simulation(game, hero, action, monster)
    hero.combatant = asdict(active) if active else None
    return result, active


def test_engine_chapter_one_bell_vault_boss_persistence():
    """Quest flags, vault gate, boss rewards, and encode/decode — engine only."""
    game = GameEngine(random.Random(1))
    hero = game.create_character(1, "Engine Chapter", "human", "fighter")
    assert hero.location == "The Whispering Cellar"

    _bell_arc_to_vault_unlocked(game, hero)
    assert hero.quest_flags.get("bell_quest_complete")
    assert hero.quest_flags.get("vault_unlocked")
    assert travel_allowed("The Vault of Echoes", hero.quest_flags)
    gold_after_bell = hero.gold

    hero.location = "The Sunken Corridor"
    _, monster = game._travel(hero, "travel to The Vault of Echoes")
    stall = 0
    prior_foe_hp = None
    for round_i in range(48):
        if hero.quest_flags.get("vault_first_descent_story_awarded") and hero.level >= 3:
            break
        if hero.hp <= 0:
            game._recover_from_combat_defeat(hero)
            monster = None
            continue
        if monster is None:
            _, monster = game._travel(hero, "travel to The Vault of Echoes")
        if hero.in_combat and monster:
            foe_hp = monster.hp
            if prior_foe_hp is not None and foe_hp >= prior_foe_hp:
                stall += 1
            else:
                stall = 0
            prior_foe_hp = foe_hp
            assert stall < 16, f"vault stall round={round_i} foe_hp={foe_hp} dist={hero.combat_distance_ft}"
            _, monster = resolve_combat_action_for_simulation(
                game, hero, f"attack {monster.name}", monster,
            )
            if hero.combatant:
                monster = MonsterState(**hero.combatant)
            elif not hero.in_combat:
                monster = None

    assert hero.quest_flags.get("vault_first_descent_story_awarded"), hero.quest_flags
    assert hero.level >= 3, f"expected L3+, got L{hero.level} xp={hero.xp}"

    hero.location = "The Bell Warden's Pit"
    hero.hp = hero.max_hp
    hero.in_combat = False
    hero.combatant = None
    gold_before_boss = hero.gold
    xp_before_boss = hero.xp

    _combat_turn(game, hero, "attack the Bell Warden")
    stall = 0
    prior_foe_hp = None
    for round_i in range(120):
        if hero.quest_flags.get("chapter_one_complete"):
            break
        left_pit = "Pit" not in (hero.location or "") and "Bell Warden" not in (hero.location or "")
        if hero.hp <= 0 or (not hero.in_combat and left_pit):
            hero.location = "The Bell Warden's Pit"
            hero.hp = max(hero.max_hp // 2, 1)
            hero.death_state = "alive"
            hero.in_combat = False
            hero.combatant = None
            prior_foe_hp = None
            stall = 0
            _combat_turn(game, hero, "attack the Bell Warden")
            continue
        if hero.in_combat and hero.combatant:
            foe = MonsterState(**hero.combatant)
            if prior_foe_hp is not None and foe.hp >= prior_foe_hp:
                stall += 1
            else:
                stall = 0
            prior_foe_hp = foe.hp
            assert stall < 20, f"boss stall round={round_i} foe_hp={foe.hp} hero_hp={hero.hp}"
            _combat_turn(game, hero, f"attack {foe.name}")
        else:
            _combat_turn(game, hero, "attack the Bell Warden")

    assert hero.quest_flags.get("chapter_one_complete"), (
        f"missing chapter_one_complete level={hero.level} hp={hero.hp} "
        f"in_combat={hero.in_combat} flags={hero.quest_flags}"
    )
    assert not hero.in_combat
    assert hero.gold >= gold_before_boss
    assert hero.gold >= gold_after_bell
    assert hero.xp >= xp_before_boss
    assert hero.gold >= CHAPTER_BOSS_GOLD_GP or hero.gold > gold_before_boss

    restored = load_character_state(asdict(hero))
    assert restored.quest_flags.get("chapter_one_complete")
    assert restored.gold == hero.gold
    assert restored.xp == hero.xp
