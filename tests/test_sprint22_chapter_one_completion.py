"""Sprint 22 — chapter one completion, persistence, idempotent boss rewards."""

import random
from dataclasses import asdict

from app.engine.economy_balance import CHAPTER_BOSS_GOLD_GP
from app.engine.equipment import load_character_state
from app.engine.service import GameEngine


def _ready_for_boss_rewards(game: GameEngine):
    hero = game.create_character(1, "Hero", "human", "fighter")
    hero.location = "The Bell Warden's Pit"
    hero.quest_flags = {"vault_unlocked": True}
    for _ in range(3):
        game._grant_xp(hero, 100)
    hero.gold = 0
    return hero


def test_chapter_one_complete_idempotent_boss_gold():
    game = GameEngine(random.Random(22))
    hero = _ready_for_boss_rewards(game)
    lines1 = game._chapter_one_boss_rewards(hero, "bell_warden")
    assert lines1 and hero.quest_flags.get("chapter_one_complete")
    assert hero.gold == CHAPTER_BOSS_GOLD_GP
    lines2 = game._chapter_one_boss_rewards(hero, "bell_warden")
    assert not lines2
    assert hero.gold == CHAPTER_BOSS_GOLD_GP


def test_chapter_one_complete_survives_character_reload():
    game = GameEngine(random.Random(3))
    hero = _ready_for_boss_rewards(game)
    game._chapter_one_boss_rewards(hero, "bell_warden")
    restored = load_character_state(asdict(hero))
    assert restored.quest_flags.get("chapter_one_complete")
    assert restored.gold == CHAPTER_BOSS_GOLD_GP


def test_main_quest_return_bell_xp_idempotent():
    game = GameEngine(random.Random(5))
    hero = game.create_character(1, "Bell", "human", "cleric")
    hero.location = "The Shrine of the Forgotten"
    hero.quest_flags = {"bell_found": True, "bell_acquired": True}
    hero.inventory.append("Shrine bell")
    from app.engine.quests import resolve_main_quest_step

    first = resolve_main_quest_step(hero, "return", "return_bell", game._level_up)
    assert first and first.state_changed
    xp = hero.xp
    gold = hero.gold
    second = resolve_main_quest_step(hero, "return", "return_bell", game._level_up)
    assert second and not second.state_changed
    assert hero.xp == xp
    assert hero.gold == gold
