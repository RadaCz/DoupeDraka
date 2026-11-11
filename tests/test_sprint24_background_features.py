"""Sprint 24 — engine-authoritative MVP background features."""

from __future__ import annotations

import random
from dataclasses import asdict

import pytest

from app.engine.background_features import (
    FLAG_ACOLYTE,
    FLAG_CRIMINAL,
    FLAG_FOLK_HERO,
    FLAG_HERMIT,
    FLAG_SAGE,
    FLAG_SOLDIER,
    try_background_feature,
)
from app.engine.equipment import load_character_state
from app.engine.models import RollResult
from app.engine.service import GameEngine
from app.engine.skill_challenges import BANDIT_CAMP, FLAG_ALERTED


_CLASS_SKILLS: dict[str, list[str]] = {
    "acolyte": ["History", "Perception"],
    "criminal": ["Athletics", "Insight"],
    "folk_hero": ["Athletics", "Insight"],
    "sage": ["Athletics", "Insight"],
    "soldier": ["History", "Perception"],
    "hermit": ["Athletics", "Insight"],
}


def _hero(bg: str, location: str) -> tuple[GameEngine, object]:
    game = GameEngine(random.Random(24))
    hero = game.create_character(
        1,
        "Bg",
        "human",
        "fighter",
        background=bg,
        class_skills=_CLASS_SKILLS[bg],
    )
    hero.location = location
    return game, hero


@pytest.mark.parametrize(
    ("bg", "location", "action", "flag", "side_flag"),
    [
        ("acolyte", "The Shrine of the Forgotten", "seek shelter of the faithful", FLAG_ACOLYTE, "acolyte_shrine_sanctuary_lore"),
        ("criminal", "The Goblin Market", "use criminal contact", FLAG_CRIMINAL, "bell_market_rumor"),
        ("folk_hero", "The Sunken Corridor", "call on rustic hospitality", FLAG_FOLK_HERO, "mara_warned"),
        ("sage", "The Vault of Echoes", "use researcher training", FLAG_SAGE, "sage_vault_toll_lore"),
        ("soldier", "The Bandit Camp", "invoke military rank", FLAG_SOLDIER, "soldier_bandit_layout"),
        ("hermit", "The Underground River", "share hermit discovery", FLAG_HERMIT, "hermit_river_revelation"),
    ],
)
def test_each_background_succeeds_once(bg, location, action, flag, side_flag):
    _, hero = _hero(bg, location)
    before = hero.gold, hero.xp
    result = try_background_feature(hero, action)
    assert result is not None
    assert result.state_changed
    assert hero.quest_flags[flag]
    assert hero.quest_flags[side_flag]
    again = try_background_feature(hero, action)
    assert again is not None
    assert not again.state_changed
    assert (hero.gold, hero.xp) == before


@pytest.mark.parametrize(
    ("bg", "location", "action"),
    [
        ("acolyte", "The Shrine of the Forgotten", "seek shelter of the faithful"),
        ("criminal", "The Goblin Market", "use criminal contact"),
        ("folk_hero", "The Sunken Corridor", "call on rustic hospitality"),
        ("sage", "The Vault of Echoes", "use researcher training"),
        ("soldier", "The Bandit Camp", "invoke military rank"),
        ("hermit", "The Underground River", "share hermit discovery"),
    ],
)
def test_wrong_background_rejected(bg, location, action):
    wrong = "sage" if bg != "sage" else "acolyte"
    _, hero = _hero(wrong, location)
    result = try_background_feature(hero, action)
    assert result is not None
    assert not result.state_changed
    assert "Only" in result.events[0]


def test_wrong_location_no_flag():
    _, hero = _hero("criminal", "The Whispering Cellar")
    result = try_background_feature(hero, "use criminal contact")
    assert result is not None
    assert not result.state_changed
    assert FLAG_CRIMINAL not in hero.quest_flags


def test_unknown_phrase_no_match():
    _, hero = _hero("criminal", "The Goblin Market")
    assert try_background_feature(hero, "dance with goblins") is None


def test_resolve_action_integration_persistence():
    game, hero = _hero("criminal", "The Goblin Market")
    result, _ = game.resolve_action(hero, "use criminal contact", None)
    assert result.state_changed
    restored = load_character_state(asdict(hero))
    assert restored.quest_flags[FLAG_CRIMINAL]
    assert restored.quest_flags["bell_market_rumor"]


def test_resolve_action_wrong_bg_no_side_effects():
    game, hero = _hero("acolyte", "The Goblin Market")
    before = dict(hero.quest_flags), hero.gold
    result, _ = game.resolve_action(hero, "use criminal contact", None)
    assert not result.state_changed
    assert hero.quest_flags == before[0]
    assert hero.gold == before[1]


def test_stealth_disadvantage_uses_lower_roll_for_success(monkeypatch):
    game = GameEngine(random.Random(31))
    hero = game.create_character(1, "S", "human", "rogue")
    hero.location = BANDIT_CAMP
    hero.quest_flags[FLAG_ALERTED] = True
    rolls = [
        RollResult("1d20", (18,), 2, 20),
        RollResult("1d20", (5,), 2, 7),
    ]

    def fake(self, character, skill, dc):
        r = rolls.pop(0)
        return r, r.total >= dc, ""

    monkeypatch.setattr(GameEngine, "skill_check", fake)
    result, _ = game.resolve_action(hero, "sneak past the bandit sentries", None)
    assert result.state_changed
    assert "failure" in result.events[0].lower()
    assert not hero.quest_flags.get("bandit_shrine_evidence")


def test_stealth_disadvantage_first_high_second_low_fails_despite_first_success(monkeypatch):
    """Disadvantage must fail when the kept (lower) roll misses, even if the first roll passed."""
    game = GameEngine(random.Random(32))
    hero = game.create_character(1, "S", "human", "rogue")
    hero.location = BANDIT_CAMP
    hero.quest_flags[FLAG_ALERTED] = True
    rolls = [
        RollResult("1d20", (16,), 4, 20),
        RollResult("1d20", (3,), 4, 7),
    ]

    def fake(self, character, skill, dc):
        r = rolls.pop(0)
        return r, r.total >= dc, ""

    monkeypatch.setattr(GameEngine, "skill_check", fake)
    result, _ = game.resolve_action(hero, "sneak past the bandit sentries", None)
    assert result.state_changed
    assert "failure" in result.events[0].lower()
    assert "7" in result.events[0]
    assert not hero.quest_flags.get("bandit_shrine_evidence")
